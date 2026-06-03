import { DEFAULT_PAYROLL_SETTINGS } from "./settingsStore.js";

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
    const cfg = {
        ...DEFAULT_PAYROLL_SETTINGS,
        ...(settings?.payrollSettings || {}),
        // Backward compatibility for already-saved top-level settings keys.
        payeBands: settings?.payeBands || settings?.payrollSettings?.payeBands || DEFAULT_PAYROLL_SETTINGS.payeBands,
        personalRelief: settings?.personalRelief ?? settings?.payrollSettings?.personalRelief ?? DEFAULT_PAYROLL_SETTINGS.personalRelief,
    };
    const basicSalary = round2(input.basicSalary ?? input.baseSalary ?? 0);
    const allowance = round2(input.allowance ?? 0);
    const otherDeductions = round2(input.otherDeductions ?? input.deductions ?? 0);
    const pensionablePay = round2(input.pensionablePay ?? basicSalary);
    const grossPay = round2(basicSalary + allowance);

    const tier1Ceiling = Number(cfg.nssfTier1Ceiling || 0);
    const tier2Ceiling = Number(cfg.nssfTier2Ceiling || 0);
    const nssfEmployeeRate = Number(cfg.nssfEmployeeRate || 0) / 100;
    const nssfEmployerRate = Number(cfg.nssfEmployerRate || 0) / 100;
    const nssfTier1Base = Math.min(pensionablePay, tier1Ceiling);
    const nssfTier2Base = Math.max(0, Math.min(pensionablePay, tier2Ceiling) - tier1Ceiling);
    const nssfEmployee = round2((nssfTier1Base * nssfEmployeeRate) + (nssfTier2Base * nssfEmployeeRate));
    const nssfEmployer = round2((nssfTier1Base * nssfEmployerRate) + (nssfTier2Base * nssfEmployerRate));

    const shifEnabled = cfg.shifEnabled !== false && settings?.payrollUseShif !== false;
    const shifRate = Number(cfg.shifRatePercent || 0) / 100;
    const nhifOrShif = round2(shifEnabled ? grossPay * shifRate : 0);

    const housingLevyEmployee = round2(grossPay * (Number(cfg.housingLevyEmployeeRate || 0) / 100));
    const housingLevyEmployer = round2(grossPay * (Number(cfg.housingLevyEmployerRate || 0) / 100));

    const taxablePay = round2(Math.max(0, grossPay - nssfEmployee));
    const taxBands = (cfg.payeBands || []).map((band) => ({
        upTo: band.upperLimit == null ? Infinity : Number(band.upperLimit),
        rate: Number(band.ratePercent || 0) / 100,
    }));
    const personalRelief = round2(Number(cfg.personalRelief || 0));
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
