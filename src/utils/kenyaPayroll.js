const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function progressiveTax(amount, bands = []) {
    let remaining = Math.max(0, Number(amount || 0));
    let total = 0;
    let lower = 0;
    for (const band of bands) {
        const upper = Number.isFinite(Number(band.upTo)) ? Number(band.upTo) : Infinity;
        const rate = Number(band.rate || 0);
        const taxable = Math.max(0, Math.min(remaining, upper - lower));
        total += taxable * rate;
        remaining -= taxable;
        lower = upper;
        if (remaining <= 0) break;
    }
    return round2(total);
}

export function computePayrollKRA(input = {}, settings = {}) {
    const basicSalary = round2(input.basicSalary ?? input.baseSalary ?? 0);
    const allowance = round2(input.allowance ?? 0);
    const otherDeductions = round2(input.otherDeductions ?? input.deductions ?? 0);
    const pensionablePay = round2(input.pensionablePay ?? basicSalary);
    const grossPay = round2(basicSalary + allowance);

    const nssfTier1Base = Math.min(pensionablePay, 7000);
    const nssfTier2Base = Math.max(0, Math.min(pensionablePay, 36000) - 7000);
    const nssfEmployee = round2((nssfTier1Base * 0.06) + (nssfTier2Base * 0.06));
    const nssfEmployer = nssfEmployee;

    // SHIF baseline (2.75% of gross). Keep switchable in settings for policy updates.
    const shifEnabled = settings?.payrollUseShif !== false;
    const nhifOrShif = round2(shifEnabled ? grossPay * 0.0275 : 0);

    const housingLevyEmployee = round2(grossPay * 0.015);
    const housingLevyEmployer = round2(grossPay * 0.015);

    const taxablePay = round2(Math.max(0, grossPay - nssfEmployee));
    const taxBands = settings?.payeBands || [
        { upTo: 24000, rate: 0.10 },
        { upTo: 32333, rate: 0.25 },
        { upTo: 40667, rate: 0.30 },
        { upTo: 57333, rate: 0.325 },
        { upTo: Infinity, rate: 0.35 },
    ];
    const personalRelief = round2(Number(settings?.personalRelief ?? 2400));
    const payeBeforeRelief = progressiveTax(taxablePay, taxBands);
    const paye = round2(Math.max(0, payeBeforeRelief - personalRelief));

    const totalDeductions = round2(otherDeductions + paye + nhifOrShif + nssfEmployee + housingLevyEmployee);
    const netPay = round2(Math.max(0, grossPay - totalDeductions));
    const employerCost = round2(grossPay + nssfEmployer + housingLevyEmployer);

    return {
        basicSalary,
        allowance,
        grossPay,
        taxablePay,
        otherDeductions,
        paye,
        nhif: nhifOrShif,
        nssfEmployee,
        nssfEmployer,
        housingLevyEmployee,
        housingLevyEmployer,
        totalDeductions,
        netPay,
        employerCost,
    };
}
