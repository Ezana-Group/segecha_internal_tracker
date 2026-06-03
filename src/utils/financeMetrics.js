const DISPOSED_ASSET_STATUSES = new Set(["disposed", "sold", "written off"]);

export const COUNTABLE_JOURNEY_STATUSES = [
    "Accepted",
    "Loading",
    "In Transit",
    "Awaiting Start Verification",
    "Awaiting Verification",
    "Completed",
];

const n = (value) => Number(value || 0);

export const isInMonth = (dateValue, month) => {
    if (!month) return true;
    return String(dateValue || "").startsWith(month);
};

const monthFromDate = (value) => {
    const s = String(value || "");
    return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : "";
};

export function getLatestFinanceMonth(data) {
    const months = new Set();

    (data?.payroll || []).forEach((p) => {
        if (p?.month) months.add(String(p.month).slice(0, 7));
        if (p?.date) {
            const m = monthFromDate(p.date);
            if (m) months.add(m);
        }
    });
    (data?.fuel || []).forEach((f) => {
        const m = monthFromDate(f?.date);
        if (m) months.add(m);
    });
    (data?.expenses || []).forEach((e) => {
        const m = monthFromDate(e?.date);
        if (m) months.add(m);
    });
    (data?.journeys || []).forEach((j) => {
        const m = monthFromDate(j?.date);
        if (m) months.add(m);
    });
    (data?.invoices || []).forEach((i) => {
        const m = monthFromDate(i?.date || i?.issued);
        if (m) months.add(m);
    });

    const sorted = [...months].filter(Boolean).sort();
    return sorted.length > 0 ? sorted[sorted.length - 1] : new Date().toISOString().slice(0, 7);
}

export function calculateMonthlyDepreciation(assets = [], { excludeDisposed = true } = {}) {
    return (assets || []).reduce((sum, asset) => {
        const cost = n(asset.cost);
        if (cost <= 0) return sum;

        if (excludeDisposed) {
            const status = String(asset.status || "Active").toLowerCase();
            if (DISPOSED_ASSET_STATUSES.has(status)) return sum;
        }

        const salvage = Math.max(0, Math.min(n(asset.salvageValue), cost));
        const lifeYears = Math.max(1, n(asset.usefulLifeYears) || 5);
        const method = asset.depreciationMethod || "straight-line";

        if (method === "reducing-balance") {
            const annualRate = salvage > 0 && cost > 0 ? 1 - Math.pow(salvage / cost, 1 / lifeYears) : 0.2;
            return sum + (cost * annualRate) / 12;
        }

        return sum + (cost - salvage) / (lifeYears * 12);
    }, 0);
}

export function calculatePayrollCost(
    payrollRows = [],
    {
        month = "",
        mode = "gross", // gross | net
        status = "all", // all | paid
    } = {},
) {
    return (payrollRows || [])
        .filter((p) => (!month || p.month === month))
        .filter((p) => (status === "paid" ? p.status === "Paid" : true))
        .reduce((sum, p) => {
            if (mode === "net") {
                return sum + n(p.baseSalary) + n(p.allowance) - n(p.deductions);
            }
            return sum + (n(p.grossPay) || (n(p.baseSalary) + n(p.allowance)));
        }, 0);
}

export function calculatePeriodTotals(
    data,
    {
        month = "",
        payrollMode = "gross",
        payrollStatus = "all",
    } = {},
) {
    const journeys = Array.isArray(data?.journeys) ? data.journeys : [];
    const fuel = Array.isArray(data?.fuel) ? data.fuel : [];
    const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
    const payroll = Array.isArray(data?.payroll) ? data.payroll : [];
    const assets = Array.isArray(data?.assets) ? data.assets : [];

    const revenue = journeys
        .filter((j) => COUNTABLE_JOURNEY_STATUSES.includes(j.status) && isInMonth(j.date, month))
        .reduce((sum, j) => sum + n(j.revenue), 0);
    const fuelCost = fuel
        .filter((f) => isInMonth(f.date, month))
        .reduce((sum, f) => sum + n(f.litres) * n(f.pricePerL), 0);
    const otherExpenses = expenses
        .filter((e) => isInMonth(e.date, month) && e.cat !== "Fuel")
        .reduce((sum, e) => sum + n(e.amount), 0);
    const payrollCost = calculatePayrollCost(payroll, {
        month,
        mode: payrollMode,
        status: payrollStatus,
    });
    const depreciation = calculateMonthlyDepreciation(assets, { excludeDisposed: true });
    const totalExpenses = fuelCost + otherExpenses + payrollCost + depreciation;

    return {
        revenue,
        fuelCost,
        otherExpenses,
        payrollCost,
        depreciation,
        totalExpenses,
        netProfit: revenue - totalExpenses,
    };
}
