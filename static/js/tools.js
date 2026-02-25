/* ==========================================================================
   TOOLS & CALCULATORS
   Description: Logic for Budget, EMI, and Area Conversion tools.
   Author: PropertyPlus Dev Team
   ========================================================================== */

/* =========================================
   TOOLS & CALCULATORS LOGIC
   ========================================= */

document.addEventListener('DOMContentLoaded', function() {
    // Budget Calculator Elements
    const budgetSavings = document.getElementById('budgetSavings');
    const budgetEmi = document.getElementById('budgetEmi');
    const budgetTenure = document.getElementById('budgetTenure');

    if (budgetSavings) {
        budgetSavings.addEventListener('input', calculateBudget);
        budgetEmi.addEventListener('input', calculateBudget);
        budgetTenure.addEventListener('input', calculateBudget);
        calculateBudget(); // Initial call
    }

    // EMI Calculator Elements
    const emiAmount = document.getElementById('emiAmount');
    const emiRate = document.getElementById('emiRate');
    const emiTenure = document.getElementById('emiTenure');

    if (emiAmount) {
        emiAmount.addEventListener('input', calculateEmi);
        emiRate.addEventListener('input', calculateEmi);
        emiTenure.addEventListener('input', calculateEmi);
        calculateEmi(); // Initial call
    }

    // Area Converter: Set initial state
    const sqftInput = document.getElementById('unit-sqft');
    if (sqftInput) {
        convertArea('sqft');
    }
});

/**
 * INDIAN CURRENCY FORMATTING
 * @param {number} num
 * @param {boolean} full - precise or short (Lakh/Cr)
 */
function formatIndianCurrency(num, full = false) {
    if (!num) return "0";

    if (full) {
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 0,
            style: 'currency',
            currency: 'INR'
        }).format(num).replace('INR', '₹');
    }

    if (num >= 10000000) {
        return "₹ " + (num / 10000000).toFixed(2) + " Cr";
    } else if (num >= 100000) {
        return "₹ " + (num / 100000).toFixed(2) + " Lakh";
    } else if (num >= 1000) {
        return "₹ " + (num / 1000).toFixed(1) + " K";
    }
    return "₹ " + num.toLocaleString('en-IN');
}

/**
 * BUDGET CALCULATOR LOGIC
 */
function calculateBudget() {
    const savings = parseFloat(document.getElementById('budgetSavings').value);
    const emi = parseFloat(document.getElementById('budgetEmi').value);
    const years = parseFloat(document.getElementById('budgetTenure').value);
    const rate = 8.5 / 100 / 12; // Monthly interest rate
    const n = years * 12; // months

    // Display values
    document.getElementById('budgetSavingsVal').innerText = formatIndianCurrency(savings);
    document.getElementById('budgetEmiVal').innerText = formatIndianCurrency(emi, true) + "/mo";
    document.getElementById('budgetTenureVal').innerText = years + " Years";

    // P = E * ((1 + r)^n - 1) / (r * (1 + r)^n)
    const loanAmount = emi * (Math.pow(1 + rate, n) - 1) / (rate * Math.pow(1 + rate, n));
    const totalBudget = savings + loanAmount;

    document.getElementById('budgetResult').innerText = formatIndianCurrency(totalBudget);
}

/**
 * EMI CALCULATOR LOGIC
 */
function calculateEmi() {
    const principal = parseFloat(document.getElementById('emiAmount').value);
    const annualRate = parseFloat(document.getElementById('emiRate').value);
    const years = parseFloat(document.getElementById('emiTenure').value);

    // Display values
    document.getElementById('emiAmountVal').innerText = formatIndianCurrency(principal);
    document.getElementById('emiRateVal').innerText = annualRate + "%";
    document.getElementById('emiTenureVal').innerText = years + " Years";

    const r = annualRate / 12 / 100;
    const n = years * 12;

    // EMI = [P x r x (1+r)^n] / [(1+r)^n - 1]
    const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

    const totalPayable = emi * n;
    const totalInterest = totalPayable - principal;
    const interestRatio = (totalInterest / totalPayable) * 100;

    // Update Results
    document.getElementById('emiMonthlyResult').innerText = formatIndianCurrency(emi, true);
    document.getElementById('emiTotalInterest').innerText = formatIndianCurrency(totalInterest);
    document.getElementById('emiTotalPayable').innerText = formatIndianCurrency(totalPayable);

    // Update Chart (CSS conic-gradient)
    // Principal (Red/Accent) start at 0% to (100-ratio)
    // Interest (Blue) start at (100-ratio) to 100%
    const principalPercent = 100 - interestRatio;
    const chart = document.getElementById('emiChart');
    if (chart) {
        chart.style.background = `conic-gradient(var(--tool-accent) 0% ${principalPercent}%, #4cc9f0 ${principalPercent}% 100%)`;
    }
}

/**
 * AREA CONVERTER LOGIC
 */
const AREA_UNITS = {
    sqft: 1,
    sqm: 10.7639104,
    sqyd: 9,
    gajam: 9,
    sqinch: 0.00694444444,
    acre: 43560,
    hectare: 107639.104,
    ares: 1076.39104,
    sqkm: 10763910.4,
    sqmile: 27878400,
    bigha: 27225,
    biswa: 1361.25,
    biswakacha: 675,
    katha: 1361.25,
    nali: 2160,
    guntha: 1089,
    ground: 2400,
    ankanam: 72,
    cent: 435.6,
    dismil: 435.6,
    decimal: 435.6,
    marla: 272.25,
    kanal: 5445,
    killa: 43560,
    dhur: 68.0625,
    lessa: 68.0625,
    perch: 272.25,
    sqkaram: 27.225,
    pura: 28800
};

function convertArea(sourceUnit) {
    const sourceVal = parseFloat(document.getElementById('unit-' + sourceUnit).value);

    // Clear all if empty
    if (isNaN(sourceVal)) {
        for (let unit in AREA_UNITS) {
            if (unit !== sourceUnit) {
                const input = document.getElementById('unit-' + unit);
                if (input) input.value = '';
            }
        }
        return;
    }

    // Convert source to sqft (base unit)
    const sqftBase = sourceVal * AREA_UNITS[sourceUnit];

    // Convert sqft to all other units
    for (let unit in AREA_UNITS) {
        if (unit === sourceUnit) continue;
        const result = sqftBase / AREA_UNITS[unit];

        const input = document.getElementById('unit-' + unit);
        if (input) {
            // Decimals based on magnitude
            let precision = 2;
            if (result < 0.001) precision = 8;
            else if (result < 0.1) precision = 6;
            else if (result > 10000) precision = 0;

            // Format naturally
            let val = result.toFixed(precision);
            // Remove trailing zeros after decimal
            if (val.includes('.')) {
                val = val.replace(/\.?0+$/, "");
            }
            input.value = val;
        }
    }
}

/**
 * AREA FILTER LOGIC
 */
function filterAreaUnits() {
    const query = document.getElementById('areaSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.area-input-card');

    cards.forEach(card => {
        const label = card.querySelector('label').innerText.toLowerCase();
        if (label.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}
