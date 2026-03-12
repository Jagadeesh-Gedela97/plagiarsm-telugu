document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("inputText");
    const charCount = document.getElementById("charCount");
    const clearBtn = document.getElementById("clearBtn");
    const checkBtn = document.getElementById("checkBtn");
    const resultsList = document.getElementById("resultsList");
    const resultsEmpty = document.getElementById("resultsEmpty");
    const sortSelect = document.getElementById("sortSelect");
    const thresholdRange = document.getElementById("thresholdRange");
    const thresholdValue = document.getElementById("thresholdValue");
    const fileInput = document.getElementById("fileInput");
    const fileInfo = document.getElementById("fileInfo");
    const fileName = fileInfo.querySelector(".file-name");
    const removeFile = document.getElementById("removeFile");

    if (!input) return;

    let uploadedFile = null;

    input.addEventListener("input", () => {
        const len = input.value.length;
        charCount.textContent = `${len} characters`;
    });

    clearBtn.addEventListener("click", () => {
        input.value = "";
        charCount.textContent = "0 characters";
        resultsList.innerHTML = "";
        resultsEmpty.classList.remove("hidden");
    });

    sortSelect.addEventListener("change", renderResults);

    checkBtn.addEventListener("click", async () => {
        const text = input.value.trim();
        if (!text) {
            window.showToast("Please paste some Telugu text before checking.");
            return;
        }
        await runCheck(text);
    });

    // File input handlers
    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadedFile = file;
            fileName.textContent = file.name;
            fileInfo.classList.remove("hidden");
            
            // Extract text from file
            try {
                const text = await extractTextFromFile(file);
                input.value = text;
                input.dispatchEvent(new Event("input"));
                window.showToast(`Text extracted from ${file.name}`);
            } catch (error) {
                window.showToast("Error extracting text from file");
                console.error(error);
            }
        }
    });

    removeFile.addEventListener("click", () => {
        uploadedFile = null;
        fileInput.value = "";
        fileInfo.classList.add("hidden");
        input.value = "";
        input.dispatchEvent(new Event("input"));
    });

    async function extractTextFromFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/extract-text', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to extract text');
        }
        
        const data = await response.json();
        return data.extracted_text || '';
    }

    let latestResults = [];

    async function runCheck(text) {
        setButtonLoading(true);
        window.showLoader(true);
        resultsList.innerHTML = "";
        resultsEmpty.classList.add("hidden");

        try {
            const res = await fetch("/plag-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            if (!res.ok) {
                throw new Error("API error: " + res.status);
            }

            const data = await res.json();
            latestResults = data.matches || [];

            sessionStorage.setItem("plagResults", JSON.stringify(data));

            renderResults();
            smoothScrollTo(resultsList);
        } catch (err) {
            console.error(err);
            window.showToast("Failed to run plagiarism check. Please try again.");
            resultsList.innerHTML = "";
            resultsEmpty.classList.remove("hidden");
        } finally {
            window.showLoader(false);
            setButtonLoading(false);
        }
    }

    function setButtonLoading(isLoading) {
        const label = checkBtn.querySelector(".btn-label");
        const spinner = checkBtn.querySelector(".btn-spinner");
        if (isLoading) {
            checkBtn.disabled = true;
            spinner.style.display = "inline-block";
            label.textContent = "Checking…";
        } else {
            checkBtn.disabled = false;
            spinner.style.display = "none";
            label.textContent = "Check plagiarism";
        }
    }

    function renderResults() {
        resultsList.innerHTML = "";

        if (!latestResults.length) {
            resultsEmpty.classList.remove("hidden");
            return;
        }

        resultsEmpty.classList.add("hidden");

        const sortBy = sortSelect.value;

        let items = [...latestResults];

        items.sort((a, b) => {
            if (sortBy === "semantic") {
                return (b.semantic_score ?? 0) - (a.semantic_score ?? 0);
            }
            return (b.final_score ?? 0) - (a.final_score ?? 0);
        });

        items.forEach((item, idx) => {
            const card = document.createElement("article");
            card.className = "result-card";
            card.style.animationDelay = `${idx * 40}ms`;

            const finalScore = (item.final_score ?? 0);
            const semantic = (item.semantic_score ?? 0);
            const jaccard = (item.jaccard_score ?? 0);

            card.innerHTML = `
                <div class="result-sentence">${escapeHtml(item.sentence || "")}</div>
                <div class="result-meta">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer">Source link</a>
                    <span class="result-badge">Final score: ${finalScore.toFixed(2)}</span>
                </div>
                <div class="progress-group">
                    <div class="progress-row">
                        <span class="progress-label">Semantic</span>
                        <div class="progress-track">
                            <div class="progress-fill" data-target="${clamp01(semantic)}"></div>
                        </div>
                        <span class="progress-value">${semantic.toFixed(2)}</span>
                    </div>
                    <div class="progress-row">
                        <span class="progress-label">Jaccard</span>
                        <div class="progress-track">
                            <div class="progress-fill" data-target="${clamp01(jaccard)}"></div>
                        </div>
                        <span class="progress-value">${jaccard.toFixed(2)}</span>
                    </div>
                </div>
            `;

            resultsList.appendChild(card);
        });

        requestAnimationFrame(() => {
            resultsList.querySelectorAll(".progress-fill").forEach(fill => {
                const t = parseFloat(fill.dataset.target || "0");
                fill.style.width = `${Math.max(0, Math.min(1, t)) * 100}%`;
            });
        });
    }

    function smoothScrollTo(targetEl) {
        if (!targetEl) return;
        const offset = 80;
        const top = targetEl.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
    }

    function clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[c]));
    }
});

