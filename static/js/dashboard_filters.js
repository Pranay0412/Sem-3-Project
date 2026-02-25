/* ==========================================================================
   DASHBOARD FILTERS
   Description: Logic for property filtering (State, City, Budget, Type).
   Author: PropertyPlus Dev Team
   ========================================================================== */

/**
 * Dashboard Filtering Logic
 * Handles State/City dependent dropdowns, Category/Type selection,
 * Rent/Buy toggle, and Budget range logic.
 */
document.addEventListener('DOMContentLoaded', function () {
    const locationData = JSON.parse(document.getElementById('locationDataJson').textContent || '{}');
    const filterForm = document.getElementById('ppFilterForm');
    const stateSelect = document.getElementById('filterState');
    const citySelect = document.getElementById('filterCity');
    const categorySelect = document.getElementById('filterCategory');
    const typeSelect = document.getElementById('filterType');
    const budgetSelect = document.getElementById('filterBudgetSelect');
    const listingToggleBtns = document.querySelectorAll('.pp-listing-btn');
    const listingTypeInput = document.getElementById('filterListingType');
    const searchInput = document.getElementById('ppSearchInput');

    // Current filter state from URL
    const urlParams = new URLSearchParams(window.location.search);

    // Initialize City dropdown (Direct select enabled)
    const initialState = stateSelect ? stateSelect.value : (urlParams.get('state') || 'All');
    const initialCity = urlParams.get('city') || 'All';
    updateCities(initialState, initialCity);

    // Initialize Listing Type Toggle
    const initialListingType = urlParams.get('type') || 'Sale';
    if (listingTypeInput) listingTypeInput.value = initialListingType;
    listingToggleBtns.forEach(btn => {
        if (btn.dataset.value === initialListingType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Initialize Budget Dropdown
    updateBudgetOptions(initialListingType, urlParams.get('max_price'));

    // State Change Event
    if (stateSelect) {
        stateSelect.addEventListener('change', function () {
            updateCities(this.value);
        });
    }

    // City Change Event - Auto-select State
    if (citySelect) {
        citySelect.addEventListener('change', function () {
            const selectedCity = this.value;
            if (selectedCity === 'All') return;

            // Find which state this city belongs to
            for (let state in locationData) {
                if (locationData[state].cities.includes(selectedCity)) {
                    if (stateSelect && stateSelect.value !== state) {
                        stateSelect.value = state;
                        // Refresh city list to show only this state's cities but keep selection
                        updateCities(state, selectedCity);
                    }
                    break;
                }
            }
        });
    }

    function updateCities(state, selectedCity = 'All') {
        if (!citySelect) return;

        citySelect.innerHTML = '<option value="All">All Cities</option>';

        if (state && state !== 'All' && locationData[state]) {
            // Show cities for selected state
            const cities = locationData[state].cities.sort();
            cities.forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                if (city === selectedCity) opt.selected = true;
                citySelect.appendChild(opt);
            });
        } else {
            // "Direct Select" - Show all cities from all states
            let allCities = [];
            for (let st in locationData) {
                allCities = allCities.concat(locationData[st].cities);
            }
            // Remove duplicates and sort
            allCities = [...new Set(allCities)].sort();

            allCities.forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                if (city === selectedCity) opt.selected = true;
                citySelect.appendChild(opt);
            });
        }
    }

    // Listing Type Toggle (Rent/Buy)
    listingToggleBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            listingToggleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            listingTypeInput.value = this.dataset.value;

            // Update budget options when switching between Rent/Buy
            updateBudgetOptions(this.dataset.value);
        });
    });

    function updateBudgetOptions(type, selectedValue = 'All') {
        if (!budgetSelect) return;

        budgetSelect.innerHTML = '<option value="All">Any Budget</option>';

        const rentOptions = [
            { label: 'Under ₹5,000', value: '5000' },
            { label: 'Under ₹10,000', value: '10000' },
            { label: 'Under ₹15,000', value: '15000' },
            { label: 'Under ₹20,000', value: '20000' },
            { label: 'Under ₹25,000', value: '25000' },
            { label: 'Under ₹30,000', value: '30000' },
            { label: 'Under ₹40,000', value: '40000' },
            { label: 'Under ₹50,000', value: '50000' },
            { label: 'Under ₹75,000', value: '75000' },
            { label: 'Under ₹1 Lakh', value: '100000' },
            { label: 'Under ₹2 Lakhs', value: '200000' }
        ];

        const saleOptions = [
            { label: 'Under ₹5 Lakhs', value: '500000' },
            { label: 'Under ₹10 Lakhs', value: '1000000' },
            { label: 'Under ₹20 Lakhs', value: '2000000' },
            { label: 'Under ₹30 Lakhs', value: '3000000' },
            { label: 'Under ₹40 Lakhs', value: '4000000' },
            { label: 'Under ₹50 Lakhs', value: '5000000' },
            { label: 'Under ₹60 Lakhs', value: '6000000' },
            { label: 'Under ₹70 Lakhs', value: '7000000' },
            { label: 'Under ₹80 Lakhs', value: '8000000' },
            { label: 'Under ₹90 Lakhs', value: '9000000' },
            { label: 'Under ₹1 Crore', value: '10000000' },
            { label: 'Under ₹2 Crores', value: '20000000' },
            { label: 'Under ₹5 Crores', value: '50000000' },
            { label: 'Under ₹10 Crores', value: '100000000' }
        ];

        const options = (type === 'Rent') ? rentOptions : saleOptions;

        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.label;
            if (opt.value === selectedValue) el.selected = true;
            budgetSelect.appendChild(el);
        });
    }

    // Apply Filters
    window.applyDashboardFilters = function () {
        const params = new URLSearchParams();

        if (searchInput && searchInput.value) params.set('q', searchInput.value);
        if (stateSelect && stateSelect.value !== 'All') params.set('state', stateSelect.value);
        if (citySelect && citySelect.value !== 'All') params.set('city', citySelect.value);
        if (categorySelect && categorySelect.value !== 'All') params.set('category', categorySelect.value);
        if (typeSelect && typeSelect.value !== 'All') params.set('property_type', typeSelect.value);
        if (listingTypeInput && listingTypeInput.value !== 'All') params.set('type', listingTypeInput.value);
        if (budgetSelect && budgetSelect.value !== 'All') params.set('max_price', budgetSelect.value);

        window.location.search = params.toString();
    };

    // Reset Filters
    window.resetDashboardFilters = function () {
        const role = document.body.classList.contains('pp-seller') ? 'seller' : 'buyer';
        window.location.href = `/dashboard/${role}`;
    };

    // --- Vanishing Filter Logic (Improved) ---
    const filterContainer = document.querySelector('.pp-filter-container');
    const toggleFilterBtn = document.getElementById('ppToggleFilterBtn');

    if (filterContainer && toggleFilterBtn) {
        let lastScrollTop = 0;
        let ticking = false;
        let isToggling = false; // Cooldown flag to prevent shaking loops

        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

                    // If we are in the middle of a toggle transition, update lastScrollTop and ignore logic
                    if (isToggling) {
                        lastScrollTop = scrollTop;
                        ticking = false;
                        return;
                    }

                    // Prevent buffer/bounce issues at top
                    if (scrollTop < 0) {
                        ticking = false;
                        return;
                    }

                    const delta = scrollTop - lastScrollTop;
                    const hideStartOffset = 50; // Increased to avoid premature hiding
                    const scrollUpThreshold = 40; // Increased threshold to prevent jitter/shake (was 10)

                    if (scrollTop > hideStartOffset) {
                        // SCROLL DOWN -> Hide Filter
                        if (delta > 10) { // Require significant scroll down too
                            if (!filterContainer.classList.contains('vanished') && !filterContainer.classList.contains('manually-shown')) {
                                filterContainer.classList.add('vanished');
                                toggleFilterBtn.style.display = 'flex';

                                // Lock scroll logic to prevent immediate reversal
                                isToggling = true;
                                setTimeout(() => { isToggling = false; }, 500); // Slightly longer than CSS transition
                            }
                        }
                        // SCROLL UP -> Show Filter
                        else if (delta < -scrollUpThreshold) {
                            if (filterContainer.classList.contains('vanished')) {
                                filterContainer.classList.remove('vanished');
                                toggleFilterBtn.style.display = 'none';
                                filterContainer.classList.remove('manually-shown');

                                // Lock scroll logic
                                isToggling = true;
                                setTimeout(() => { isToggling = false; }, 500);
                            }
                        }
                    } else {
                        // Top of page -> Always show
                        if (filterContainer.classList.contains('vanished')) {
                            filterContainer.classList.remove('vanished');
                            toggleFilterBtn.style.display = 'none';
                        }
                    }

                    lastScrollTop = scrollTop;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        toggleFilterBtn.addEventListener('click', function () {
            // Manual toggle also sets cooldown
            isToggling = true;
            setTimeout(() => { isToggling = false; }, 400);

            if (filterContainer.classList.contains('vanished')) {
                filterContainer.classList.remove('vanished');
                filterContainer.classList.add('manually-shown');
                this.querySelector('span').textContent = 'Hide';
            } else {
                filterContainer.classList.add('vanished');
                filterContainer.classList.remove('manually-shown');
                this.querySelector('span').textContent = 'Filters';
            }
        });
    }
});
