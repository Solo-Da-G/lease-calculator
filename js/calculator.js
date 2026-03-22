if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            localStorage.setItem('leaseCalcTheme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
        });
    }

    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            calculateFlat();
            calculateReducing();
        });
    });

    // Live comma formatting for monetary inputs
    document.querySelectorAll('.comma-input').forEach(input => {
        input.addEventListener('input', function () {
            formatCommaInput(this);
        });
    });
});

// Strip commas and return a number
function getNum(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return Number(el.value.replace(/,/g, '')) || 0;
}

// Format an input's value with commas, preserving cursor position
function formatCommaInput(el) {
    const raw = el.value.replace(/,/g, '');
    // Allow empty, trailing dot, or partial decimal entry
    if (raw === '' || raw === '.' || /\.\d*$/.test(raw) && raw.endsWith('0') === false) {
        // For decimals, format the integer part only
        if (raw.includes('.')) {
            const parts = raw.split('.');
            const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            const cursorPos = el.selectionStart;
            el.value = intPart + '.' + parts[1];
            el.setSelectionRange(cursorPos, cursorPos);
        }
        return;
    }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const cursorPos = el.selectionStart;
    const oldLen = el.value.length;
    if (raw.includes('.')) {
        const parts = raw.split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        el.value = intPart + '.' + parts[1];
    } else {
        el.value = num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    const newLen = el.value.length;
    const newCursor = cursorPos + (newLen - oldLen);
    el.setSelectionRange(newCursor, newCursor);
}

// Helper to set a comma-input field's value with formatting
function setCommaValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (val === 0 || val === '') {
        el.value = '';
        return;
    }
    el.value = Number(val).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function updateUI(id, val, isPercent = false) {
    const el = document.getElementById(id);
    if (!el) return;

    if (val === 0 || isNaN(val) || !isFinite(val)) {
        el.innerText = "-";
        return;
    }

    if (isPercent) {
        el.innerText = val.toFixed(2) + "%";
    } else {
        el.innerText = val.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

function calculateFlat() {
    const price = getNum('f_price');
    const plate = getNum('f_plate');
    const hmo = getNum('f_heal');
    const tech = getNum('f_tech');
    const months = Number(document.getElementById('f_months').value) || 0;
    const flatRate = Number(document.getElementById('f_interest').value) || 0;

    if (price > 0 && months > 0) {
        const principal = price + plate + hmo + tech;
        const totalInterest = (flatRate / 100) * principal * months;
        const grandTotal = principal + totalInterest;
        const monthlyRental = grandTotal / months;

        updateUI('f_resInterest', totalInterest);
        updateUI('f_resTotal', grandTotal);
        updateUI('f_resMonthly', monthlyRental);

        const extrasTotal = plate + hmo + tech;
        setCommaValue('r_price', price === 0 ? '' : price);
        setCommaValue('r_extras', extrasTotal === 0 ? '' : extrasTotal);
        document.getElementById('r_months').value = months === 0 ? "" : months;

        // Ensure monthlyRental is strictly greater than principal / months to solve for rate
        let annualAPR = 0;
        if (monthlyRental * months > principal && principal > 0) {
            const periodicRate = solveForRate(principal, monthlyRental, months);
            annualAPR = periodicRate * 12 * 100;
        }

        if (annualAPR > 0) {
            document.getElementById('r_interest').value = annualAPR.toFixed(2);
            document.getElementById('apr_box').style.display = 'block';
            updateUI('f_resAPR', annualAPR, true);
        } else {
            // Edge case: flat rate is 0%, meaning 0% TVM rate
            document.getElementById('r_interest').value = "0";
            document.getElementById('apr_box').style.display = 'block';
            updateUI('f_resAPR', 0, true);
        }
        
        // Trigger reducing calculation when mapping over
        calculateReducing();
    } else {
        document.getElementById('apr_box').style.display = 'none';
        ['f_resInterest','f_resTotal','f_resMonthly', 'f_resAPR'].forEach(id => updateUI(id, 0));
    }
}

function solveForRate(pv, pmt, n) {
    if (pmt * n <= pv) return 0; // Prevent infinite loops or negative rates
    
    let i = 0.01;
    for (let j = 0; j < 100; j++) {
        let f = pmt * (1 - Math.pow(1 + i, -n)) / i - pv;
        let df = pmt * (n * Math.pow(1 + i, -n - 1) * i - (1 - Math.pow(1 + i, -n))) / Math.pow(i, 2);
        let nextI = i - f / df;
        if (Math.abs(nextI - i) < 0.0000001) return Math.max(0, nextI);
        i = nextI;
    }
    return Math.max(0, i);
}

function calculateReducing() {
    const price = getNum('r_price');
    const extras = getNum('r_extras');
    const insPer = Number(document.getElementById('r_ins_per').value) || 0;
    const admPer = Number(document.getElementById('r_adm_per').value) || 0;
    const months = Number(document.getElementById('r_months').value) || 0;
    const advanceQty = Number(document.getElementById('r_advance').value) || 0;
    const annualRate = Number(document.getElementById('r_interest').value) || 0;
    const vatPer = Number(document.getElementById('r_vat_per').value) || 0;

    if (price > 0 && months > 0) {
        const assetCost = price + extras;
        const monthlyRate = (annualRate / 100) / 12;

        // 1. Initial Fees
        const initialFees = ((insPer / 100) * assetCost) + ((admPer / 100) * assetCost);

        let pmt = 0;
        if (monthlyRate > 0) {
            // Discounted PMT Formula
            const factor = ((1 - Math.pow(1 + monthlyRate, -(months - advanceQty))) / monthlyRate) + advanceQty;
            pmt = assetCost / factor;
        } else {
            // 0% interest fallback
            pmt = assetCost / months;
        }

        // 3. Advance Amount
        const advanceAmount = pmt * advanceQty;

        // 4. Interest & VAT spread
        let totalInterest = (pmt * months) - assetCost;
        if (totalInterest < 0) totalInterest = 0; // Prevent precision negatives
        const totalVat = (vatPer / 100) * totalInterest;
        const monthlyWithVat = pmt + (totalVat / months);

        updateUI('r_resInitial', initialFees + advanceAmount);
        updateUI('r_resInterest', totalInterest);
        updateUI('r_resMonthly', monthlyWithVat);
    } else {
        ['r_resInitial','r_resInterest','r_resMonthly'].forEach(id => updateUI(id, 0));
    }
}

function generateSchedule(type) {
    const data = {
        price: getNum('r_price'),
        extras: getNum('r_extras'),
        months: Number(document.getElementById('r_months').value) || 0,
        annualRate: Number(document.getElementById('r_interest').value) || 0,
        vatPer: Number(document.getElementById('r_vat_per').value) || 0,
        insPer: Number(document.getElementById('r_ins_per').value) || 0,
        admPer: Number(document.getElementById('r_adm_per').value) || 0,
        advanceQty: Number(document.getElementById('r_advance').value) || 0,
        type: type
    };

    if (data.price <= 0 || data.months <= 0) {
        alert("Please enter Asset Cost and Tenor first on the Reducing Balance plan.");
        return;
    }

    sessionStorage.setItem('leaseData', JSON.stringify(data));
    window.location.href = 'schedule.html';
}
