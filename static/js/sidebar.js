/* ==========================================================================
   SIDEBAR & THEME CONTROLLER
   Description: Standalone logic for layout and theming.
   Note: Used when dashboard_base.js is not loaded.
   ========================================================================== */

/* =========================================
   SIDEBAR & LAYOUT LOGIC
   ========================================= */

// 1. Mobile Toggle
function toggleMobileSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const btn = document.getElementById('mobileMenuBtn');

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Close and click outside logic
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (e.target === overlay) {
        toggleMobileSidebar();
    }
});

/* =========================================
   THEME TOGGLE (Light/Dark)
   Note: Uses CSS variables from variables.css
   ========================================= */

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Sync switch (if present)
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        themeSwitch.checked = (theme === 'dark');
    }

    // Update status text (if present)
    const themeStatus = document.getElementById('themeStatus');
    if (themeStatus) {
        themeStatus.textContent = (theme === 'dark') ? 'Dark mode' : 'Light mode';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Initialize theme on every page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    applyTheme(savedTheme ? savedTheme : 'light');

    // Hook switch change (if present)
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        themeSwitch.addEventListener('change', toggleTheme);
    }
});
