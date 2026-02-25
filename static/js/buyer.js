/* ==========================================================================
   BUYER DASHBOARD LOGIC
   Description: Specific logic for buyer dashboard interactions.
   ========================================================================== */

// --- 1. Tab Switching Logic ---
// Note: dashboard_base.js also contains openTab logic.
// If this file runs in isolation, this function is needed.
function openTab(tabId) {
    if (window.openTab) return window.openTab(tabId, event ? event.currentTarget : null);

    // Hide all tabs
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(el => el.style.display = 'none');

    // Remove active class from buttons
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => btn.classList.remove('active'));

    // Show specific tab
    document.getElementById(tabId).style.display = 'block';

    // Add active class to clicked button
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}

// --- 2. Sidebar Toggle ---
function toggleSidebar() {
    if (window.toggleMobileSidebar) return window.toggleMobileSidebar();

    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

// --- 3. Theme Toggle Logic ---
// Delegates to global applyTheme if available
function toggleTheme() {
    if (window.applyTheme) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        window.applyTheme(newTheme);
        return;
    }

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update Icon
    const btn = document.getElementById('theme-toggle');
    if(btn) {
        btn.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

// --- 4. Init Theme on Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Only run if dashboard_base hasn't already handled it
    if (!document.documentElement.hasAttribute('data-theme')) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const btn = document.getElementById('theme-toggle');
        if(btn) {
            btn.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }
    }
});

// --- 5. Filter Listings Logic ---
function filterListings() {
    const searchText = document.getElementById("searchArea").value.toLowerCase().trim();
    const selectedType = document.getElementById("searchType").value.toLowerCase().trim();
    const selectedBudget = document.getElementById("searchBudget").value.toLowerCase().trim();

    const cards = document.querySelectorAll(".listing-card");

    cards.forEach(card => {
        const cardArea = (card.getAttribute("data-area") || "").toLowerCase();
        const cardType = (card.getAttribute("data-type") || "").toLowerCase();
        const cardBudget = (card.getAttribute("data-budget") || "").toLowerCase();

        const matchesArea = searchText === "" || cardArea.includes(searchText);
        const matchesType = selectedType === "" || cardType === selectedType;
        const matchesBudget = selectedBudget === "" || cardBudget === selectedBudget;

        if (matchesArea && matchesType && matchesBudget) {
            // show
            card.classList.remove("filtered-out");
            card.classList.remove("hidden");
        } else {
            // fade out first, then hide
            card.classList.add("filtered-out");
            setTimeout(() => {
                card.classList.add("hidden");
            }, 250);
        }
    });
    const visibleCards = Array.from(cards).filter(c => !c.classList.contains("hidden"));
    document.getElementById("noResultsMsg").style.display = visibleCards.length === 0 ? "block" : "none";
}

// Run filter when user types or changes dropdowns
document.addEventListener("DOMContentLoaded", () => {
    const areaInput = document.getElementById("searchArea");
    const typeInput = document.getElementById("searchType");
    const budgetInput = document.getElementById("searchBudget");

    if (areaInput) areaInput.addEventListener("keyup", filterListings);
    if (typeInput) typeInput.addEventListener("change", filterListings);
    if (budgetInput) budgetInput.addEventListener("change", filterListings);
});
