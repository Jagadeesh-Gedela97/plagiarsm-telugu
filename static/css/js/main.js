document.addEventListener("DOMContentLoaded", () => {
    if (window.AOS) {
        AOS.init({
            once: true,
            duration: 700,
            easing: "ease-out-quart"
        });
    }

    initNavbar();
    initHeroSlider();
    initCounters();
    initCustomCursor();
});

function initNavbar() {
    const navbar = document.getElementById("navbar");
    const navToggle = document.getElementById("navToggle");
    const navLinks = document.querySelector(".nav-links");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 10) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    if (navToggle && navLinks) {
        navToggle.addEventListener("click", () => {
            navLinks.classList.toggle("open");
        });

        navLinks.addEventListener("click", (e) => {
            if (e.target.matches(".nav-link")) {
                navLinks.classList.remove("open");
            }
        });
    }
}

function initHeroSlider() {
    const slider = document.getElementById("heroSlider");
    if (!slider) return;

    const track = slider.querySelector(".slider-track");
    const slides = Array.from(track.querySelectorAll(".slide"));
    const dotsContainer = document.getElementById("heroSliderDots");
    let idx = 0;
    let timer;

    function renderDots() {
        dotsContainer.innerHTML = "";
        slides.forEach((_, i) => {
            const dot = document.createElement("button");
            dot.className = "slider-dot";
            if (i === idx) dot.classList.add("active");
            dot.addEventListener("click", () => goTo(i, true));
            dotsContainer.appendChild(dot);
        });
    }

    function goTo(i, stopAuto) {
        idx = (i + slides.length) % slides.length;
        slides.forEach((s, k) => {
            s.classList.toggle("active", k === idx);
        });
        Array.from(dotsContainer.children).forEach((d, k) => {
            d.classList.toggle("active", k === idx);
        });
        if (stopAuto) resetTimer();
    }

    function resetTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(() => goTo(idx + 1, false), 4000);
    }

    renderDots();
    resetTimer();
}

function initCounters() {
    const cards = document.querySelectorAll(".metric-card");
    if (!cards.length) return;

    let started = false;
    function start() {
        if (started) return;
        const top = window.scrollY + window.innerHeight;
        const trigger = cards[0].getBoundingClientRect().top + window.scrollY;
        if (top >= trigger - 80) {
            started = true;
            cards.forEach(card => {
                const target = parseFloat(card.dataset.target || "0");
                const label = card.querySelector(".metric-value");
                animateNumber(label, target, 800);
            });
            window.removeEventListener("scroll", start);
        }
    }

    window.addEventListener("scroll", start);
    start();
}

function animateNumber(el, target, duration) {
    const isFloat = !Number.isInteger(target);
    const start = 0;
    const startTime = performance.now();

    function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const value = start + (target - start) * eased;
        el.textContent = isFloat ? value.toFixed(1) : Math.round(value);
        if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

function initCustomCursor() {
    const dot = document.querySelector(".cursor-dot");
    const outline = document.querySelector(".cursor-outline");
    if (!dot || !outline) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let outlineX = x;
    let outlineY = y;

    document.addEventListener("pointermove", (e) => {
        x = e.clientX;
        y = e.clientY;
        dot.style.transform = `translate(${x}px, ${y}px)`;
    });

    function loop() {
        outlineX += (x - outlineX) * 0.16;
        outlineY += (y - outlineY) * 0.16;
        outline.style.transform = `translate(${outlineX}px, ${outlineY}px)`;
        requestAnimationFrame(loop);
    }
    loop();
}

window.showLoader = function (show) {
    const el = document.getElementById("globalLoader");
    if (!el) return;
    if (show) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
};

window.showToast = function (message) {
    const toast = document.getElementById("toast");
    const msg = document.getElementById("toastMessage");
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3500);
};

