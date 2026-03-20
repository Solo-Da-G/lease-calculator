document.addEventListener('DOMContentLoaded', () => {
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            calculateFlat();
            calculateReducing();
        });
    });
});

function updateUI(id, val, isPercent = false) {
    const el = document.getElementById(id);
    if (!el) return;

    if (val === 0 || isNaN(val)) {
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
    const price = Number(document.getElementById('f_price').value) || 0;
    const plate = Number(document.getElementById('f_plate').value) || 0;
    const hmo = Number(document.getElementById('f_heal').value) || 0;
    const tech = Number(document.getElementById('f_tech').value) || 0;
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
        document.getElementById('r_price').value = price;
        document.getElementById('r_extras').value = extrasTotal;
        document.getElementById('r_months').value = months;

        const periodicRate = solveForRate(principal, monthlyRental, months);
        const annualAPR = periodicRate * 12 * 100;

        document.getElementById('r_interest').value = annualAPR.toFixed(2);
        document.getElementById('apr_box').style.display = 'block';
        updateUI('f_resAPR', annualAPR, true);
    } else {
        document.getElementById('apr_box').style.display = 'none';
        ['f_resInterest','f_resTotal','f_resMonthly'].forEach(id => updateUI(id, 0));
    }
}

function solveForRate(pv, pmt, n) {
    let i = 0.01;
    for (let j = 0; j < 100; j++) {
        let f = pmt * (1 - Math.pow(1 + i, -n)) / i - pv;
        let df = pmt * (n * Math.pow(1 + i, -n - 1) * i - (1 - Math.pow(1 + i, -n))) / Math.pow(i, 2);
        let nextI = i - f / df;
        if (Math.abs(nextI - i) < 0.0000001) return nextI;
        i = nextI;
    }
    return i;
}

function calculateReducing() {
    const price = Number(document.getElementById('r_price').value) || 0;
    const extras = Number(document.getElementById('r_extras').value) || 0;
    const insPer = Number(document.getElementById('r_ins_per').value) || 0;
    const admPer = Number(document.getElementById('r_adm_per').value) || 0;
    const months = Number(document.getElementById('r_months').value) || 0;
    const advanceQty = Number(document.getElementById('r_advance').value) || 0;
    const annualRate = Number(document.getElementById('r_interest').value) || 0;
    const vatPer = Number(document.getElementById('r_vat_per').value) || 0;

    if (price > 0 && months > 0 && annualRate > 0) {
        const assetCost = price + extras;
        const monthlyRate = (annualRate / 100) / 12;

        // 1. Initial Fees
        const initialFees = ((insPer / 100) * assetCost) + ((admPer / 100) * assetCost);

        // 2. Discounted PMT Formula
        const factor = ((1 - Math.pow(1 + monthlyRate, -(months - advanceQty))) / monthlyRate) + advanceQty;
        const pmt = assetCost / factor;

        // 3. Advance Amount
        const advanceAmount = pmt * advanceQty;

        // 4. Interest & VAT spread
        const totalInterest = (pmt * months) - assetCost;
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
        price: Number(document.getElementById('r_price').value) || 0,
        extras: Number(document.getElementById('r_extras').value) || 0,
        months: Number(document.getElementById('r_months').value) || 0,
        annualRate: Number(document.getElementById('r_interest').value) || 0,
        vatPer: Number(document.getElementById('r_vat_per').value) || 0,
        advanceQty: Number(document.getElementById('r_advance').value) || 0,
        type: type
    };

    if (data.price <= 0 || data.months <= 0) {
        alert("Please enter Asset Cost and Tenor first.");
        return;
    }

    sessionStorage.setItem('leaseData', JSON.stringify(data));
    window.location.href = 'schedule.html';
}