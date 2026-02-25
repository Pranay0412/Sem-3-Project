/* ==========================================================================
   LANDING PAGE CONTROLLER
   Description: Animation, navigation, and interactions for the landing page.
   Author: PropertyPlus Dev Team
   ========================================================================== */

/* Landing Page JavaScript - High-End 3D Carousel & Smooth Animations */

document.addEventListener('DOMContentLoaded', function () {

    // =====================================================
    // 0. INFINITE LOOP TYPING
    // =====================================================
    const typingLoopElement = document.querySelector('.typing-text-loop');
    if (typingLoopElement) {
        const phrases = ["Zero Brokerage.", "Premium Listings.", "Fastest Service."];
        let phraseIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeSpeed = 100;

        function typeLoop() {
            const currentPhrase = phrases[phraseIndex];

            if (isDeleting) {
                typingLoopElement.textContent = currentPhrase.substring(0, charIndex - 1);
                charIndex--;
                typeSpeed = 40;
            } else {
                typingLoopElement.textContent = currentPhrase.substring(0, charIndex + 1);
                charIndex++;
                typeSpeed = 120;
            }

            if (!isDeleting && charIndex === currentPhrase.length) {
                isDeleting = true;
                typeSpeed = 2500; // Pause at end of phrase
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                typeSpeed = 400;
            }

            setTimeout(typeLoop, typeSpeed);
        }

        setTimeout(typeLoop, 1000);
    }

    // 1. CAROUSEL (Self-Initializing by Bootstrap 5)
    // No custom JS needed here, using data-bs-ride="carousel" in HTML.

    // =====================================================
    // 2. MOBILE NAVIGATION TOGGLE
    // =====================================================
    const hamburger = document.getElementById('hamburger');
    const closeNav = document.getElementById('closeNav');
    const navLinks = document.getElementById('navLinks');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            navLinks.classList.add('active');
        });
    }

    if (closeNav && navLinks) {
        closeNav.addEventListener('click', function () {
            navLinks.classList.remove('active');
        });
    }

    // Close menu when a link is clicked
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(link => {
        link.addEventListener('click', function () {
            if (navLinks) {
                navLinks.classList.remove('active');
            }
        });
    });

    // =====================================================
    // 3. SMOOTH SCROLL FOR ANCHOR LINKS
    // =====================================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && document.querySelector(href)) {
                e.preventDefault();
                const target = document.querySelector(href);
                const offsetTop = target.offsetTop - 80; // Adjusted for taller navbar

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // =====================================================
    // 4. NAVBAR SCROLL EFFECT
    // =====================================================
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // =====================================================
    // 5. THEME TOGGLE (Simple & Perfect)
    // =====================================================
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;
    const themeIcon = themeBtn ? themeBtn.querySelector('i') : null;

    const setDarkMode = (isDark) => {
        if (isDark) {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            if (themeIcon) {
                themeIcon.classList.replace('fa-moon', 'fa-sun');
            }
        } else {
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            if (themeIcon) {
                themeIcon.classList.replace('fa-sun', 'fa-moon');
            }
        }
    };

    // Initial load
    if (localStorage.getItem('theme') === 'dark') {
        setDarkMode(true);
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = body.getAttribute('data-theme') === 'dark';
            setDarkMode(!isDark);
        });
    }

    // =====================================================
    // 6. REVEAL ANIMATIONS (Intersection Observer)
    // =====================================================
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealTargets = document.querySelectorAll(
        '.contact-card-simple, .feature-box, .section-header-fresh, .carousel-container, .reveal-item, .prop-card'
    );

    revealTargets.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s cubic-bezier(0.165, 0.84, 0.44, 1), transform 0.8s cubic-bezier(0.165, 0.84, 0.44, 1)';
        revealObserver.observe(el);
    });

    const style = document.createElement('style');
    style.innerHTML = `
        .reveal-active {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

});
