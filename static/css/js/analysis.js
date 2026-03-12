document.addEventListener("DOMContentLoaded", () => {
    const emptyEl = document.getElementById("analysisEmpty");
    const contentEl = document.getElementById("analysisContent");
    const raw = sessionStorage.getItem("plagResults");

    if (!raw) {
        emptyEl.classList.remove("hidden");
        contentEl.classList.add("hidden");
        return;
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        emptyEl.classList.remove("hidden");
        contentEl.classList.add("hidden");
        return;
    }

    const matches = data.matches || [];
    if (!matches.length) {
        emptyEl.classList.remove("hidden");
        contentEl.classList.add("hidden");
        return;
    }

    emptyEl.classList.add("hidden");
    contentEl.classList.remove("hidden");

    const finalScores = matches.map(m => m.final_score ?? 0);
    const labels = matches.map((m, i) => `S${i + 1}`);
    const semantic = matches.map(m => m.semantic_score ?? 0);
    const jaccard = matches.map(m => m.jaccard_score ?? 0);

    const sorted = [...matches].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0)).slice(0, 10);
    const barLabels = sorted.map((m, i) => `S${matches.indexOf(m) + 1}`);
    const barData = sorted.map(m => m.final_score ?? 0);

    const barCtx = document.getElementById("barChart").getContext("2d");
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    const lineCtx = document.getElementById("lineChart").getContext("2d");

    new Chart(barCtx, {
        type: "bar",
        data: {
            labels: barLabels,
            datasets: [{
                label: "Final score",
                data: barData,
                backgroundColor: "rgba(139,92,246,0.7)",
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 800 },
            scales: {
                y: { beginAtZero: true, max: 1 },
                x: { grid: { display: false } }
            }
        }
    });

    const low = finalScores.filter(v => v < 0.3).length;
    const mid = finalScores.filter(v => v >= 0.3 && v < 0.6).length;
    const high = finalScores.filter(v => v >= 0.6).length;

    new Chart(pieCtx, {
        type: "pie",
        data: {
            labels: ["Low (<0.3)", "Medium (0.3–0.6)", "High (≥0.6)"],
            datasets: [{
                data: [low, mid, high],
                backgroundColor: [
                    "rgba(37,99,235,0.7)",
                    "rgba(234,179,8,0.8)",
                    "rgba(220,38,38,0.8)"
                ]
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 900 }
        }
    });

    new Chart(lineCtx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Final score",
                    data: finalScores,
                    borderColor: "rgba(139,92,246,1)",
                    backgroundColor: "rgba(139,92,246,0.25)",
                    tension: 0.25,
                    fill: true
                },
                {
                    label: "Semantic",
                    data: semantic,
                    borderColor: "rgba(34,197,94,1)",
                    backgroundColor: "rgba(34,197,94,0.12)",
                    tension: 0.25,
                    fill: true
                },
                {
                    label: "Jaccard",
                    data: jaccard,
                    borderColor: "rgba(56,189,248,1)",
                    backgroundColor: "rgba(56,189,248,0.14)",
                    tension: 0.25,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 800 },
            scales: {
                y: { beginAtZero: true, max: 1 }
            }
        }
    });
});

