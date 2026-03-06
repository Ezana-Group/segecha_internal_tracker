import { useState, useRef, useEffect } from "react";

function useWindowWidth() {
    const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
    useEffect(() => {
        const handler = () => setW(window.innerWidth);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return w;
}

const fmt = (n) => `KES ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
const fmtN = (n, d = 1) => Number(n || 0).toFixed(d);
const today = () => new Date().toISOString().split("T")[0];
const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
const monthLabel = (m) => new Date(m + "-01").toLocaleDateString("en-KE", { month: "long", year: "numeric" });

const SEED = {
    trucks: [
        { id: "T001", reg: "KCB 100A", make: "Isuzu FVR", year: 2020, type: "Rigid", capacity: 7, driver: "D001", status: "Active", odom: 142300, tyreOdom: 110000, tyreLimit: 60000 },
        { id: "T002", reg: "KDA 200B", make: "Mercedes Actros", year: 2019, type: "Semi-Trailer", capacity: 28, driver: "D002", status: "Active", odom: 310500, tyreOdom: 270000, tyreLimit: 60000 },
        { id: "T003", reg: "KDD 300C", make: "Man TGS", year: 2021, type: "Tipper", capacity: 20, driver: "D003", status: "Maintenance", odom: 87200, tyreOdom: 60000, tyreLimit: 60000 },
    ],
    drivers: [
        { id: "D001", name: "James Kamau", phone: "0712 345 678", license: "PSV/LIC/2019/00234", class: "Class G", status: "Active", truck: "T001", joined: "2021-03-10", salary: 45000, mpesa: "0712345678" },
        { id: "D002", name: "Peter Ochieng", phone: "0723 456 789", license: "PSV/LIC/2018/00891", class: "Class G", status: "Active", truck: "T002", joined: "2020-06-15", salary: 55000, mpesa: "0723456789" },
        { id: "D003", name: "Samuel Mwangi", phone: "0734 567 890", license: "PSV/LIC/2020/00412", class: "Class CE", status: "Active", truck: "T003", joined: "2022-01-20", salary: 50000, mpesa: "0734567890" },
    ],
    journeys: [
        { id: "J001", truck: "T001", driver: "D001", origin: "Nairobi", dest: "Mombasa", date: "2025-03-01", endDate: "2025-03-02", distance: 480, revenue: 85000, cargo: "Electronics", weight: 5.5, status: "Completed", notes: "Cleared SGR checkpoint" },
        { id: "J002", truck: "T002", driver: "D002", origin: "Nairobi", dest: "Kampala", date: "2025-03-03", endDate: "2025-03-05", distance: 680, revenue: 140000, cargo: "FMCG Goods", weight: 25, status: "Completed", notes: "Transit through Busia" },
        { id: "J003", truck: "T001", driver: "D001", origin: "Mombasa", dest: "Nairobi", date: "2025-03-05", endDate: "2025-03-06", distance: 480, revenue: 75000, cargo: "Spare Parts", weight: 6, status: "Completed", notes: "" },
        { id: "J004", truck: "T002", driver: "D002", origin: "Nairobi", dest: "Dar es Salaam", date: "2025-03-10", endDate: "", distance: 840, revenue: 175000, cargo: "Machinery", weight: 22, status: "In Transit", notes: "TAZARA border" },
        { id: "J005", truck: "T001", driver: "D001", origin: "Nairobi", dest: "Eldoret", date: "2025-03-12", endDate: "", distance: 315, revenue: 55000, cargo: "Cement", weight: 7, status: "Loading", notes: "" },
    ],
    fuel: [
        { id: "F001", truck: "T001", date: "2025-03-01", litres: 120, pricePerL: 175, station: "Total Mlolongo", journey: "J001", odom: 141900 },
        { id: "F002", truck: "T002", date: "2025-03-03", litres: 200, pricePerL: 173, station: "Shell Industrial Area", journey: "J002", odom: 310000 },
        { id: "F003", truck: "T001", date: "2025-03-05", litres: 100, pricePerL: 176, station: "Kobil Mombasa", journey: "J003", odom: 142200 },
        { id: "F004", truck: "T002", date: "2025-03-04", litres: 180, pricePerL: 172, station: "Total Naivasha", journey: "J002", odom: 310300 },
        { id: "F005", truck: "T001", date: "2025-03-12", litres: 90, pricePerL: 177, station: "Shell Westlands", journey: "J005", odom: 142250 },
    ],
    expenses: [
        { id: "E001", truck: "T001", cat: "Maintenance", amount: 28000, date: "2025-03-08", desc: "Oil change + air filter", journey: "" },
        { id: "E002", truck: "T002", cat: "Toll", amount: 4500, date: "2025-03-03", desc: "Nairobi Expressway + Kisumu road", journey: "J002" },
        { id: "E003", truck: "T003", cat: "Maintenance", amount: 95000, date: "2025-03-06", desc: "Gearbox overhaul", journey: "" },
        { id: "E004", truck: "T001", cat: "Permit", amount: 8500, date: "2025-03-01", desc: "Overweight permit KEBS", journey: "J001" },
        { id: "E005", truck: "T002", cat: "Allowance", amount: 12000, date: "2025-03-05", desc: "Driver allowance Kampala trip", journey: "J002" },
        { id: "E006", truck: "T002", cat: "Toll", amount: 6200, date: "2025-03-10", desc: "Kenya-Tanzania border fees", journey: "J004" },
        { id: "E007", truck: "T001", cat: "Tyre", amount: 32000, date: "2025-03-09", desc: "2x rear tyres replacement", journey: "" },
    ],
    invoices: [
        { id: "INV-001", client: "Bamburi Cement Ltd", phone: "0700111222", journey: "J001", amount: 85000, issued: "2025-03-02", due: "2025-03-16", status: "Paid", mpesaRef: "QJK2345678", paidDate: "2025-03-10", notes: "Payment via M-Pesa Paybill" },
        { id: "INV-002", client: "Bidco Africa", phone: "0700333444", journey: "J002", amount: 140000, issued: "2025-03-06", due: "2025-03-20", status: "Paid", mpesaRef: "QJK8901234", paidDate: "2025-03-18", notes: "" },
        { id: "INV-003", client: "East African Breweries", phone: "0700555666", journey: "J003", amount: 75000, issued: "2025-03-07", due: "2025-03-21", status: "Overdue", mpesaRef: "", paidDate: "", notes: "Follow up required" },
        { id: "INV-004", client: "Kapa Oil Refineries", phone: "0700777888", journey: "J004", amount: 175000, issued: "2025-03-11", due: "2025-03-25", status: "Pending", mpesaRef: "", paidDate: "", notes: "Awaiting delivery confirmation" },
    ],
    payroll: [
        { id: "PAY-001", driver: "D001", month: "2025-02", baseSalary: 45000, allowance: 8000, deductions: 2000, status: "Paid", mpesaRef: "PAY2345678", paidDate: "2025-02-28" },
        { id: "PAY-002", driver: "D002", month: "2025-02", baseSalary: 55000, allowance: 12000, deductions: 2500, status: "Paid", mpesaRef: "PAY8901234", paidDate: "2025-02-28" },
        { id: "PAY-003", driver: "D003", month: "2025-02", baseSalary: 50000, allowance: 5000, deductions: 2000, status: "Paid", mpesaRef: "PAY5678901", paidDate: "2025-02-28" },
        { id: "PAY-004", driver: "D001", month: "2025-03", baseSalary: 45000, allowance: 10000, deductions: 2000, status: "Pending", mpesaRef: "", paidDate: "" },
        { id: "PAY-005", driver: "D002", month: "2025-03", baseSalary: 55000, allowance: 15000, deductions: 2500, status: "Pending", mpesaRef: "", paidDate: "" },
        { id: "PAY-006", driver: "D003", month: "2025-03", baseSalary: 50000, allowance: 6000, deductions: 2000, status: "Pending", mpesaRef: "", paidDate: "" },
    ],
};

const CATS = ["Fuel", "Maintenance", "Toll", "Permit", "Tyre", "Allowance", "Salary", "Insurance", "Other"];
const TRUCK_TYPES = ["Rigid", "Semi-Trailer", "Tipper", "Flatbed", "Tanker", "Box Body"];
const STATUSES_JOURNEY = ["Loading", "In Transit", "Completed", "Cancelled"];
const STATUSES_TRUCK = ["Active", "Maintenance", "Off Road"];
const TYRE_WARN_KM = 5000; // warn when within 5000km of limit

const NAV = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "trucks", icon: "◉", label: "Fleet" },
    { id: "drivers", icon: "◎", label: "Drivers" },
    { id: "journeys", icon: "◐", label: "Journeys" },
    { id: "fuel", icon: "⬡", label: "Fuel Log" },
    { id: "expenses", icon: "◇", label: "Expenses" },
    { id: "invoices", icon: "◆", label: "Invoices" },
    { id: "payroll", icon: "◑", label: "Payroll" },
    { id: "tyres", icon: "◍", label: "Tyre Monitor" },
    { id: "pnl", icon: "▣", label: "P&L Report" },
];

const SC = {
    "Completed": "#10b981", "In Transit": "#3b82f6", "Loading": "#f59e0b",
    "Maintenance": "#f59e0b", "Active": "#10b981", "Off Road": "#ef4444",
    "Cancelled": "#ef4444", "Paid": "#10b981", "Pending": "#f59e0b",
    "Overdue": "#ef4444", "Due Soon": "#f97316",
};

export default function TruckERP() {
    const [data, setData] = useState(SEED);
    const [page, setPage] = useState("dashboard");
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({});
    const [filterTruck, setFilterTruck] = useState("ALL");
    const [invoicePreview, setInvoicePreview] = useState(null);
    const [sideOpen, setSideOpen] = useState(false);
    const printRef = useRef(null);
    const winW = useWindowWidth();
    const isMobile = winW < 640;
    const isTablet = winW >= 640 && winW < 1024;
    const isDesktop = winW >= 1024;
    const rcols = (d, t, m) => `repeat(${isDesktop ? d : isTablet ? t : m}, 1fr)`;
    const [dark, setDark] = useState(false);
    // Theme tokens
    const T = dark ? {
        bg: "#0c0e14", surface: "#10141f", sidebar: "#0e1220",
        border: "#1c2235", border2: "#131722",
        text: "#e2e8f0", textMid: "#c9d1e0", textDim: "#8892a4",
        textFaint: "#4a5568", textGhost: "#2d3748",
        inputBg: "#0c0e14", inputBorder: "#1c2235", inputText: "#e2e8f0",
        rowHover: "#1c2235", shadow: "#000a",
    } : {
        bg: "#f1f5f9", surface: "#ffffff", sidebar: "#ffffff",
        border: "#e2e8f0", border2: "#f1f5f9",
        text: "#0f172a", textMid: "#1e293b", textDim: "#475569",
        textFaint: "#94a3b8", textGhost: "#cbd5e1",
        inputBg: "#f8fafc", inputBorder: "#e2e8f0", inputText: "#0f172a",
        rowHover: "#f8fafc", shadow: "#0002",
    };

    // ─── Derived ──────────────────────────────────────────────────────────────
    const totalRevenue = data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0);
    const totalFuelCost = data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0);
    const totalOtherExp = data.expenses.reduce((s, e) => s + +e.amount, 0);
    const totalExpenses = totalFuelCost + totalOtherExp;
    const netProfit = totalRevenue - totalExpenses;
    const invoicesPaid = data.invoices.filter(i => i.status === "Paid").reduce((s, i) => s + +i.amount, 0);
    const invoicesPending = data.invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + +i.amount, 0);
    const payrollPending = data.payroll.filter(p => p.status === "Pending").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);

    const truckStats = (tid) => {
        const jrns = data.journeys.filter(j => j.truck === tid);
        const rev = jrns.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0);
        const fuelEntries = data.fuel.filter(f => f.truck === tid);
        const fuelCost = fuelEntries.reduce((s, f) => s + f.litres * f.pricePerL, 0);
        const totalLitres = fuelEntries.reduce((s, f) => s + f.litres, 0);
        const totalKm = jrns.filter(j => j.status === "Completed").reduce((s, j) => s + +j.distance, 0);
        const kmPerL = totalLitres > 0 ? totalKm / totalLitres : 0;
        const otherExp = data.expenses.filter(e => e.truck === tid).reduce((s, e) => s + +e.amount, 0);
        const exp = fuelCost + otherExp;
        return { rev, exp, profit: rev - exp, trips: jrns.length, totalKm, totalLitres, fuelCost, kmPerL };
    };

    const tyreStatus = (truck) => {
        const kmSinceChange = truck.odom - truck.tyreOdom;
        const remaining = truck.tyreLimit - kmSinceChange;
        const pct = (kmSinceChange / truck.tyreLimit) * 100;
        const status = remaining <= 0 ? "Overdue" : remaining <= TYRE_WARN_KM ? "Due Soon" : "OK";
        return { kmSinceChange, remaining, pct, status };
    };

    const driverName = (id) => data.drivers.find(d => d.id === id)?.name || "—";
    const truckReg = (id) => data.trucks.find(t => t.id === id)?.reg || "—";

    const openModal = (type, item = {}) => { setModal(type); setForm({ ...item }); };
    const closeModal = () => { setModal(null); setForm({}); };
    const saveItem = (col, item) => {
        setData(d => {
            const arr = [...d[col]];
            const i = arr.findIndex(x => x.id === item.id);
            if (i >= 0) arr[i] = item; else arr.push({ ...item, id: uid() });
            return { ...d, [col]: arr };
        });
        closeModal();
    };
    const delItem = (col, id) => setData(d => ({ ...d, [col]: d[col].filter(x => x.id !== id) }));

    const markPayrollPaid = (id) => {
        setData(d => ({
            ...d,
            payroll: d.payroll.map(p => p.id === id ? { ...p, status: "Paid", paidDate: today(), mpesaRef: "MPESA" + uid().slice(0, 8) } : p)
        }));
    };

    const markInvoicePaid = (id) => {
        setData(d => ({
            ...d,
            invoices: d.invoices.map(i => i.id === id ? { ...i, status: "Paid", paidDate: today(), mpesaRef: "QJK" + uid().slice(0, 7) } : i)
        }));
    };

    // ─── Styles ───────────────────────────────────────────────────────────────
    const S = {
        wrap: { fontFamily: "'IBM Plex Sans', sans-serif", background: T.bg, minHeight: "100vh", color: T.textMid, display: "flex", flexDirection: "column", transition: "background 0.2s, color 0.2s" },
        topbar: { height: 56, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 16px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, flexShrink: 0, boxShadow: dark ? "none" : "0 1px 6px #0001" },
        brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: T.text, letterSpacing: -0.3 },
        brandDot: { width: 28, height: 28, background: "linear-gradient(135deg, #f97316, #ef4444)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 },
        meta: { fontSize: 11, color: T.textFaint, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
        body: { display: "flex", flex: 1, position: "relative", overflow: "hidden" },
        side: (open) => ({ width: 200, background: T.sidebar, borderRight: `1px solid ${T.border}`, padding: "16px 0", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0, ...(isMobile ? { position: "fixed", top: 56, left: 0, height: "calc(100vh - 56px)", zIndex: 90, transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease", boxShadow: open ? `4px 0 20px ${T.shadow}` : "none" } : { position: "sticky", top: 56, height: "calc(100vh - 56px)" }) }),
        navGrp: { padding: "0 12px 8px", fontSize: 10, color: T.textGhost, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 },
        navBtn: (a) => ({ width: "calc(100% - 24px)", margin: "1px 12px", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, border: "none", background: a ? "#f9731618" : "transparent", color: a ? "#f97316" : T.textFaint, fontWeight: a ? 700 : 400, fontSize: 13, cursor: "pointer", textAlign: "left", borderLeft: a ? "2px solid #f97316" : "2px solid transparent" }),
        main: { flex: 1, padding: isMobile ? 14 : isTablet ? 20 : 28, overflowY: "auto", minWidth: 0, width: "100%" },
        ph: { fontSize: isMobile ? 18 : 22, fontWeight: 800, color: T.text, marginBottom: 20, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
        grid: (d, t, m) => ({ display: "grid", gridTemplateColumns: rcols(d, t || Math.min(d, 2), m || 1), gap: isMobile ? 10 : 16, marginBottom: isMobile ? 14 : 20 }),
        card: (accent) => ({ background: T.surface, border: `1px solid ${accent ? accent + "33" : T.border}`, borderRadius: 12, padding: 18, borderTop: accent ? `3px solid ${accent}` : undefined, boxShadow: dark ? "none" : "0 1px 4px #0001" }),
        kpi: { fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
        val: (c) => ({ fontSize: 26, fontWeight: 800, color: c || T.text, letterSpacing: -0.8, lineHeight: 1 }),
        sub: { fontSize: 11, color: T.textDim, marginTop: 5 },
        tbl: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
        th: { padding: "9px 12px", textAlign: "left", color: T.textFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${T.border}`, fontWeight: 700, background: T.surface },
        td: { padding: "11px 12px", borderBottom: `1px solid ${T.border2}`, color: T.textDim, verticalAlign: "middle" },
        badge: (s) => ({ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: (SC[s] || "#64748b") + "22", color: SC[s] || "#64748b", border: `1px solid ${(SC[s] || "#64748b")}44` }),
        btn: (v) => ({ padding: v === "sm" ? "5px 12px" : "9px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, fontSize: v === "sm" ? 11 : 13, background: v === "del" ? "#ef444415" : v === "ghost" ? (dark ? "#ffffff10" : "#00000010") : v === "green" ? "linear-gradient(135deg,#059669,#10b981)" : v === "orange" ? "linear-gradient(135deg,#d97706,#f97316)" : "linear-gradient(135deg, #f97316, #ef4444)", color: v === "del" ? "#ef4444" : v === "ghost" ? T.textDim : "#fff" }),
        inp: { background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 7, padding: "9px 12px", color: T.inputText, fontSize: 13, width: "100%", boxSizing: "border-box" },
        lbl: { fontSize: 11, color: T.textFaint, marginBottom: 5, display: "block", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
        fg: { marginBottom: 14 },
        fgg: (n) => ({ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${n}, 1fr)`, gap: 14 }),
        ovl: { position: "fixed", inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
        mbox: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? 16 : 28, width: isMobile ? "95vw" : "min(560px, 95vw)", maxHeight: "88vh", overflowY: "auto" },
        mtitle: { fontSize: 18, fontWeight: 800, marginBottom: 22, color: T.text },
        pill: (c) => ({ background: (c || "#f97316") + "18", color: c || "#f97316", border: `1px solid ${c || "#f97316"}33`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }),
        bar: () => ({ height: 6, borderRadius: 3, background: T.border, overflow: "hidden", flex: 1 }),
        barFill: (pct, c) => ({ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: c, borderRadius: 3, transition: "width 0.6s ease" }),
        alertBox: (c) => ({ background: c + (dark ? "12" : "18"), border: `1px solid ${c}44`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }),
    };

    // ─── Shared components ────────────────────────────────────────────────────
    const Modal = ({ title, onSave, children, wide }) => (
        <div style={S.ovl} onClick={closeModal}>
            <div style={{ ...S.mbox, width: wide ? "min(720px,95vw)" : "min(560px,95vw)" }} onClick={e => e.stopPropagation()}>
                <div style={S.mtitle}>{title}</div>
                {children}
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                    <button style={S.btn()} onClick={onSave}>Save</button>
                    <button style={S.btn("ghost")} onClick={closeModal}>Cancel</button>
                </div>
            </div>
        </div>
    );
    const F = ({ label, k, type = "text", options, full, placeholder }) => (
        <div style={{ ...S.fg, gridColumn: full ? "1/-1" : undefined }}>
            <label style={S.lbl}>{label}</label>
            {options ? (
                <select style={S.inp} value={form[k] || ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}>
                    <option value="">Select…</option>
                    {options.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
            ) : (
                <input style={S.inp} type={type} placeholder={placeholder} value={form[k] || ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            )}
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════════════════════════════════════════
    const Dashboard = () => {
        const tyreAlerts = data.trucks.filter(t => { const ts = tyreStatus(t); return ts.status !== "OK"; });
        const overdueInv = data.invoices.filter(i => i.status === "Overdue");
        const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : 0;
        const totalLitres = data.fuel.reduce((s, f) => s + f.litres, 0);
        const totalKm = data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.distance, 0);
        const overallKmPerL = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : 0;

        return (
            <div>
                <div style={S.ph}>◈ Operations Dashboard <span style={S.pill()}>March 2025</span></div>

                {(tyreAlerts.length > 0 || overdueInv.length > 0) && (
                    <div style={{ marginBottom: 20 }}>
                        {tyreAlerts.map(t => {
                            const ts = tyreStatus(t);
                            return (
                                <div key={t.id} style={S.alertBox(ts.status === "Overdue" ? "#ef4444" : "#f97316")}>
                                    <span style={{ fontSize: 18 }}>🔴</span>
                                    <div>
                                        <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>Tyre Alert — {t.reg}</div>
                                        <div style={{ fontSize: 12, color: T.textDim }}>
                                            {ts.status === "Overdue" ? `Tyres overdue by ${Math.abs(ts.remaining).toLocaleString()} km` : `Tyres due in ${ts.remaining.toLocaleString()} km`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {overdueInv.map(i => (
                            <div key={i.id} style={S.alertBox("#ef4444")}>
                                <span style={{ fontSize: 18 }}>💰</span>
                                <div>
                                    <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>Overdue Invoice — {i.id}</div>
                                    <div style={{ fontSize: 12, color: T.textDim }}>{i.client} · {fmt(i.amount)} · Due {i.due}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={S.grid(4, 3, 1)}>
                    {[
                        { l: "Net Profit", v: fmt(netProfit), c: netProfit >= 0 ? "#3b82f6" : "#ef4444", s: `${margin}% margin` },
                        { l: "Revenue Collected", v: fmt(invoicesPaid), c: "#10b981", s: `${fmt(invoicesPending)} outstanding` },
                        { l: "Payroll Due", v: fmt(payrollPending), c: "#f59e0b", s: "Unpaid this month" },
                        { l: "Fleet Efficiency", v: `${overallKmPerL} km/L`, c: "#a78bfa", s: `${totalLitres.toLocaleString()}L used` },
                    ].map((k, i) => (
                        <div key={i} style={S.card(k.c)}>
                            <div style={S.kpi}>{k.l}</div>
                            <div style={S.val(k.c)}>{k.v}</div>
                            <div style={S.sub}>{k.s}</div>
                        </div>
                    ))}
                </div>

                <div style={S.grid(2, 1, 1)}>
                    <div style={S.card()}>
                        <div style={{ fontWeight: 700, marginBottom: 16, color: T.text, fontSize: 14 }}>🚛 Per-Truck Summary</div>
                        {data.trucks.map(t => {
                            const st = truckStats(t.id);
                            const ts = tyreStatus(t);
                            const margin = st.rev > 0 ? (st.profit / st.rev * 100).toFixed(1) : 0;
                            return (
                                <div key={t.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border2}` }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <span style={{ fontWeight: 700, color: T.text }}>{t.reg}</span>
                                            {ts.status !== "OK" && <span style={S.pill(SC[ts.status])}>🔴 Tyres</span>}
                                        </div>
                                        <span style={S.badge(t.status)}>{t.status}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: T.textFaint, marginBottom: 8 }}>
                                        <span>Rev: <b style={{ color: "#10b981" }}>{fmt(st.rev)}</b></span>
                                        <span>Exp: <b style={{ color: "#f59e0b" }}>{fmt(st.exp)}</b></span>
                                        <span>Net: <b style={{ color: st.profit >= 0 ? "#3b82f6" : "#ef4444" }}>{fmt(st.profit)}</b></span>
                                        <span>{fmtN(st.kmPerL, 2)} km/L</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <div style={S.bar()}><div style={S.barFill(Math.max(0, +margin), +margin >= 0 ? "#10b981" : "#ef4444")} /></div>
                                        <span style={{ fontSize: 10, color: T.textFaint, whiteSpace: "nowrap" }}>{margin}% margin</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={S.card()}>
                        <div style={{ fontWeight: 700, marginBottom: 16, color: T.text, fontSize: 14 }}>📋 Invoice & Payroll Status</div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Invoices</div>
                            {["Paid", "Pending", "Overdue"].map(s => {
                                const total = data.invoices.filter(i => i.status === s).reduce((sum, i) => sum + +i.amount, 0);
                                const count = data.invoices.filter(i => i.status === s).length;
                                return (
                                    <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border2}`, fontSize: 12 }}>
                                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={S.badge(s)}>{s}</span><span style={{ color: T.textFaint }}>({count})</span></span>
                                        <span style={{ fontWeight: 700, color: SC[s] }}>{fmt(total)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Payroll — March 2025</div>
                            {data.drivers.map(d => {
                                const paySlip = data.payroll.find(p => p.driver === d.id && p.month === "2025-03");
                                const net = paySlip ? +paySlip.baseSalary + +paySlip.allowance - +paySlip.deductions : 0;
                                return (
                                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border2}`, fontSize: 12 }}>
                                        <span style={{ color: T.textMid }}>{d.name}</span>
                                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <span style={{ fontWeight: 700, color: "#f59e0b" }}>{fmt(net)}</span>
                                            {paySlip && <span style={S.badge(paySlip.status)}>{paySlip.status}</span>}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // FLEET
    // ══════════════════════════════════════════════════════════════════════════
    const Fleet = () => (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◉ Fleet Management</div>
                <button style={S.btn()} onClick={() => openModal("truck", { status: "Active", tyreLimit: 60000 })}>+ Add Truck</button>
            </div>
            <div style={S.grid(3, 2, 1)}>
                {data.trucks.map(t => {
                    const st = truckStats(t.id);
                    const ts = tyreStatus(t);
                    const drv = data.drivers.find(d => d.id === t.driver);
                    return (
                        <div key={t.id} style={{ ...S.card(SC[t.status]) }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 18, color: T.text }}>{t.reg}</div>
                                    <div style={{ fontSize: 12, color: T.textFaint }}>{t.make} · {t.year} · {t.type}</div>
                                </div>
                                <span style={S.badge(t.status)}>{t.status}</span>
                            </div>
                            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 4 }}>👤 {drv?.name || "No driver"}</div>
                            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 10 }}>⚖️ {t.capacity}T · 🛣️ {(t.odom || 0).toLocaleString()} km</div>
                            <div style={{ fontSize: 11, color: ts.status === "OK" ? "#10b981" : SC[ts.status], marginBottom: 10, fontWeight: 600 }}>
                                🔵 Tyres: {ts.status === "Overdue" ? `Overdue ${Math.abs(ts.remaining).toLocaleString()}km` : ts.status === "Due Soon" ? `Due in ${ts.remaining.toLocaleString()}km` : `OK — ${ts.remaining.toLocaleString()}km left`}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                                {[{ l: "Revenue", v: fmt(st.rev), c: "#10b981" }, { l: "Expenses", v: fmt(st.exp), c: "#f59e0b" }, { l: "Profit", v: fmt(st.profit), c: st.profit >= 0 ? "#3b82f6" : "#ef4444" }].map(s => (
                                    <div key={s.l} style={{ background: dark ? T.bg : "#f8fafc", borderRadius: 8, padding: 10, textAlign: "center", border: `1px solid ${T.border}` }}>
                                        <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 3, textTransform: "uppercase" }}>{s.l}</div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: s.c }}>{s.v}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button style={S.btn("sm")} onClick={() => openModal("truck", t)}>Edit</button>
                                <button style={S.btn("del")} onClick={() => delItem("trucks", t.id)}>Remove</button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {modal === "truck" && (
                <Modal title={form.id ? "Edit Truck" : "Add Truck"} onSave={() => saveItem("trucks", form)}>
                    <div style={S.fgg(2)}>
                        <F label="Registration No." k="reg" /><F label="Make / Model" k="make" />
                        <F label="Year" k="year" type="number" /><F label="Capacity (tonnes)" k="capacity" type="number" />
                        <F label="Type" k="type" options={TRUCK_TYPES} /><F label="Status" k="status" options={STATUSES_TRUCK} />
                        <F label="Odometer (km)" k="odom" type="number" /><F label="Assigned Driver" k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} />
                        <F label="Odometer at last tyre change (km)" k="tyreOdom" type="number" /><F label="Tyre change interval (km)" k="tyreLimit" type="number" />
                    </div>
                </Modal>
            )}
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════════
    // DRIVERS
    // ══════════════════════════════════════════════════════════════════════════
    const Drivers = () => (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={S.ph}>◎ Driver Management</div>
                <button style={S.btn()} onClick={() => openModal("driver", { status: "Active", joined: today() })}>+ Add Driver</button>
            </div>
            <div style={{ ...S.card(), overflowX: "auto" }}>
                <table style={{ ...S.tbl, minWidth: isMobile ? 600 : undefined }}>
                    <thead><tr>{["Driver", "Phone / M-Pesa", "License", "Class", "Truck", "Salary", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {data.drivers.map(d => (
                            <tr key={d.id}>
                                <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{d.name}</td>
                                <td style={S.td}><div>{d.phone}</div><div style={{ fontSize: 10, color: T.textFaint }}>💚 {d.mpesa}</div></td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{d.license}</td>
                                <td style={S.td}>{d.class}</td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(d.truck)}</td>
                                <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(d.salary)}/mo</td>
                                <td style={S.td}><span style={S.badge(d.status)}>{d.status}</span></td>
                                <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("driver", d)}>Edit</button><button style={S.btn("del")} onClick={() => delItem("drivers", d.id)}>✕</button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modal === "driver" && (
                <Modal title={form.id ? "Edit Driver" : "Add Driver"} onSave={() => saveItem("drivers", form)}>
                    <div style={S.fgg(2)}>
                        <F label="Full Name" k="name" full /><F label="Phone" k="phone" /><F label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" />
                        <F label="License No." k="license" /><F label="License Class" k="class" options={["Class G", "Class CE", "Class C", "Class B"]} />
                        <F label="Monthly Salary (KES)" k="salary" type="number" /><F label="Date Joined" k="joined" type="date" />
                        <F label="Assigned Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} />
                        <F label="Status" k="status" options={["Active", "Inactive", "Suspended"]} />
                    </div>
                </Modal>
            )}
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════════
    // JOURNEYS
    // ══════════════════════════════════════════════════════════════════════════
    const Journeys = () => {
        const filtered = filterTruck === "ALL" ? data.journeys : data.journeys.filter(j => j.truck === filterTruck);
        const totalKm = data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.distance, 0);
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={S.ph}>◐ Journey Log</div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <select style={{ ...S.inp, width: 160 }} value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
                            <option value="ALL">All Trucks</option>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                        </select>
                        <button style={S.btn()} onClick={() => openModal("journey", { date: today(), status: "Loading" })}>+ Log Journey</button>
                    </div>
                </div>
                <div style={S.grid(4, 3, 1)}>
                    {[{ l: "Total Journeys", v: data.journeys.length, c: "#38bdf8" }, { l: "Completed", v: data.journeys.filter(j => j.status === "Completed").length, c: "#10b981" }, { l: "In Transit", v: data.journeys.filter(j => j.status === "In Transit").length, c: "#3b82f6" }, { l: "Total Distance", v: `${totalKm.toLocaleString()} km`, c: "#a78bfa" }].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
                </div>
                <div style={S.card()}>
                    <table style={S.tbl}>
                        <thead><tr>{["Route", "Truck", "Driver", "Date", "Cargo", "Weight", "Distance", "Revenue", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(j => (
                                <tr key={j.id}>
                                    <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{j.origin} → {j.dest}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(j.truck)}</td>
                                    <td style={S.td}>{driverName(j.driver)}</td>
                                    <td style={S.td}>{j.date}</td>
                                    <td style={S.td}>{j.cargo || "—"}</td>
                                    <td style={S.td}>{j.weight ? `${j.weight}T` : "—"}</td>
                                    <td style={S.td}>{j.distance} km</td>
                                    <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(j.revenue)}</td>
                                    <td style={S.td}><span style={S.badge(j.status)}>{j.status}</span></td>
                                    <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("journey", j)}>Edit</button><button style={S.btn("del")} onClick={() => delItem("journeys", j.id)}>✕</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {modal === "journey" && (
                    <Modal title={form.id ? "Edit Journey" : "Log Journey"} onSave={() => saveItem("journeys", form)}>
                        <div style={S.fgg(2)}>
                            <F label="Origin" k="origin" /><F label="Destination" k="dest" />
                            <F label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} />
                            <F label="Driver" k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} />
                            <F label="Departure Date" k="date" type="date" /><F label="Arrival Date" k="endDate" type="date" />
                            <F label="Distance (km)" k="distance" type="number" /><F label="Revenue (KES)" k="revenue" type="number" />
                            <F label="Cargo Description" k="cargo" /><F label="Weight (Tonnes)" k="weight" type="number" />
                            <F label="Status" k="status" options={STATUSES_JOURNEY} /><F label="Notes" k="notes" />
                        </div>
                    </Modal>
                )}
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // FUEL
    // ══════════════════════════════════════════════════════════════════════════
    const FuelLog = () => {
        const totalL = data.fuel.reduce((s, f) => s + f.litres, 0);
        const totalCost = data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0);
        const avgPrice = totalL > 0 ? (totalCost / totalL).toFixed(1) : 0;
        const filtered = filterTruck === "ALL" ? data.fuel : data.fuel.filter(f => f.truck === filterTruck);
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={S.ph}>⬡ Fuel Log</div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <select style={{ ...S.inp, width: 160 }} value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
                            <option value="ALL">All Trucks</option>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                        </select>
                        <button style={S.btn()} onClick={() => openModal("fuel", { date: today() })}>+ Fuel Entry</button>
                    </div>
                </div>
                <div style={S.grid(4, 3, 1)}>
                    {[{ l: "Total Fuel Cost", v: fmt(totalCost), c: "#f97316" }, { l: "Total Litres", v: `${totalL.toLocaleString()} L`, c: "#f59e0b" }, { l: "Avg Price/Litre", v: `KES ${avgPrice}`, c: "#a78bfa" }, { l: "Fill-ups", v: data.fuel.length, c: "#38bdf8" }].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
                </div>
                <div style={S.grid(3, 2, 1)}>
                    {data.trucks.map(t => {
                        const st = truckStats(t.id);
                        return (
                            <div key={t.id} style={S.card("#f97316")}>
                                <div style={{ fontWeight: 700, color: T.text, marginBottom: 10 }}>{t.reg}</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    {[{ l: "Fuel Cost", v: fmt(st.fuelCost), c: "#f97316" }, { l: "Litres", v: `${st.totalLitres.toLocaleString()} L`, c: "#f59e0b" }, { l: "Km Covered", v: `${st.totalKm.toLocaleString()} km`, c: "#38bdf8" }, { l: "Efficiency", v: `${fmtN(st.kmPerL, 2)} km/L`, c: "#10b981" }].map(s => (
                                        <div key={s.l} style={{ background: dark ? T.bg : '#f8fafc', borderRadius: 7, padding: 10, border: `1px solid ${T.border}` }}>
                                            <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{s.l}</div>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={S.card()}>
                    <table style={S.tbl}>
                        <thead><tr>{["Date", "Truck", "Station", "Litres", "Price/L", "Total Cost", "Odometer", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(f => (
                                <tr key={f.id}>
                                    <td style={S.td}>{f.date}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(f.truck)}</td>
                                    <td style={S.td}>{f.station}</td>
                                    <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700 }}>{f.litres} L</td>
                                    <td style={S.td}>KES {f.pricePerL}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{fmt(f.litres * f.pricePerL)}</td>
                                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{(f.odom || 0).toLocaleString()} km</td>
                                    <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("fuel", f)}>Edit</button><button style={S.btn("del")} onClick={() => delItem("fuel", f.id)}>✕</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {modal === "fuel" && (
                    <Modal title={form.id ? "Edit Fuel Entry" : "Log Fuel Fill-up"} onSave={() => saveItem("fuel", form)}>
                        <div style={S.fgg(2)}>
                            <F label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} />
                            <F label="Date" k="date" type="date" />
                            <F label="Litres" k="litres" type="number" /><F label="Price per Litre (KES)" k="pricePerL" type="number" />
                            <F label="Station Name" k="station" /><F label="Odometer Reading (km)" k="odom" type="number" />
                            <F label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} full />
                        </div>
                    </Modal>
                )}
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // EXPENSES
    // ══════════════════════════════════════════════════════════════════════════
    const Expenses = () => {
        const filtered = filterTruck === "ALL" ? data.expenses : data.expenses.filter(e => e.truck === filterTruck);
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={S.ph}>◇ Expense Tracker</div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <select style={{ ...S.inp, width: 160 }} value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
                            <option value="ALL">All Trucks</option>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                        </select>
                        <button style={S.btn()} onClick={() => openModal("expense", { date: today() })}>+ Add Expense</button>
                    </div>
                </div>
                <div style={S.grid(4, 3, 1)}>
                    {["Maintenance", "Toll", "Permit", "Tyre"].map(cat => {
                        const tot = data.expenses.filter(e => e.cat === cat).reduce((s, e) => s + +e.amount, 0);
                        return <div key={cat} style={S.card("#f59e0b")}><div style={S.kpi}>{cat}</div><div style={S.val("#f59e0b")}>{fmt(tot)}</div></div>;
                    })}
                </div>
                <div style={S.card()}>
                    <table style={S.tbl}>
                        <thead><tr>{["Date", "Truck", "Category", "Description", "Amount", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                                <tr key={e.id}>
                                    <td style={S.td}>{e.date}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(e.truck)}</td>
                                    <td style={S.td}><span style={S.badge("Loading")}>{e.cat}</span></td>
                                    <td style={S.td}>{e.desc}</td>
                                    <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700 }}>{fmt(e.amount)}</td>
                                    <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("expense", e)}>Edit</button><button style={S.btn("del")} onClick={() => delItem("expenses", e.id)}>✕</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {modal === "expense" && (
                    <Modal title={form.id ? "Edit Expense" : "Add Expense"} onSave={() => saveItem("expenses", form)}>
                        <div style={S.fgg(2)}>
                            <F label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} />
                            <F label="Category" k="cat" options={CATS} />
                            <F label="Amount (KES)" k="amount" type="number" /><F label="Date" k="date" type="date" />
                            <F label="Description" k="desc" full />
                            <F label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest}` }))]} full />
                        </div>
                    </Modal>
                )}
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // INVOICES
    // ══════════════════════════════════════════════════════════════════════════
    const InvoiceView = ({ inv }) => {
        const journey = data.journeys.find(j => j.id === inv.journey);
        const truck = journey ? data.trucks.find(t => t.id === journey.truck) : null;
        const driver = journey ? data.drivers.find(d => d.id === journey.driver) : null;
        const vat = Math.round(inv.amount * 0.16);
        const subtotal = inv.amount - vat;
        return (
            <div style={{ background: T.surface, color: T.text, padding: 40, borderRadius: 12, fontFamily: "Arial, sans-serif", minWidth: 0, width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: "#e85d04" }}>INVOICE</div>
                        <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{inv.id}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: T.text }}>Segecha Group Ltd</div>
                        <div style={{ fontSize: 12, color: "#666" }}>Nairobi, Kenya</div>
                        <div style={{ fontSize: 12, color: "#666" }}>Tel: +254 700 000 000</div>
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28, background: dark ? "#ffffff0a" : "#f9f9f9", padding: 20, borderRadius: 8 }}>
                    <div>
                        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Billed To</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{inv.client}</div>
                        <div style={{ fontSize: 13, color: "#555" }}>📞 {inv.phone}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "#666" }}>Date Issued: <b>{inv.issued}</b></div>
                        <div style={{ fontSize: 12, color: "#666" }}>Due Date: <b>{inv.due}</b></div>
                        <div style={{ marginTop: 8 }}>
                            <span style={{ background: inv.status === "Paid" ? "#d1fae5" : inv.status === "Overdue" ? "#fee2e2" : "#fef3c7", color: inv.status === "Paid" ? "#065f46" : inv.status === "Overdue" ? "#991b1b" : "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{inv.status}</span>
                        </div>
                    </div>
                </div>
                {journey && (
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                        <thead>
                            <tr style={{ background: "#f97316", color: "#fff" }}>
                                {["Description", "Route", "Truck", "Driver", "Amount"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "12px 14px", fontSize: 13 }}>Freight Services — {journey.cargo}</td>
                                <td style={{ padding: "12px 14px", fontSize: 13 }}>{journey.origin} → {journey.dest}</td>
                                <td style={{ padding: "12px 14px", fontSize: 13 }}>{truck?.reg || "—"}</td>
                                <td style={{ padding: "12px 14px", fontSize: 13 }}>{driver?.name || "—"}</td>
                                <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700 }}>KES {subtotal.toLocaleString()}</td>
                            </tr>
                            <tr style={{ background: dark ? "#ffffff08" : "#f9fafb" }}>
                                <td colSpan={4} style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", color: "#666" }}>VAT (16%)</td>
                                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>KES {vat.toLocaleString()}</td>
                            </tr>
                            <tr style={{ background: "#f97316", color: "#fff" }}>
                                <td colSpan={4} style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800, textAlign: "right" }}>TOTAL DUE</td>
                                <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800 }}>KES {Number(inv.amount).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                )}
                {inv.status === "Paid" && inv.mpesaRef && (
                    <div style={{ background: dark ? "#10b98120" : "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>✅ Payment Received via M-Pesa</div>
                        <div style={{ fontSize: 12, color: "#047857" }}>Reference: {inv.mpesaRef} · Date: {inv.paidDate}</div>
                    </div>
                )}
                <div style={{ fontSize: 11, color: T.textDim, textAlign: "center", borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                    Payment via M-Pesa Paybill · Bank Transfer · Cheque · Thank you for your business!
                </div>
            </div>
        );
    };

    const Invoices = () => (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={S.ph}>◆ M-Pesa Invoices</div>
                <button style={S.btn()} onClick={() => openModal("invoice", { issued: today(), due: today(), status: "Pending" })}>+ New Invoice</button>
            </div>
            <div style={S.grid(4, 3, 1)}>
                {[
                    { l: "Total Invoiced", v: fmt(data.invoices.reduce((s, i) => s + +i.amount, 0)), c: "#38bdf8" },
                    { l: "Paid", v: fmt(invoicesPaid), c: "#10b981" },
                    { l: "Pending", v: fmt(data.invoices.filter(i => i.status === "Pending").reduce((s, i) => s + +i.amount, 0)), c: "#f59e0b" },
                    { l: "Overdue", v: fmt(data.invoices.filter(i => i.status === "Overdue").reduce((s, i) => s + +i.amount, 0)), c: "#ef4444" },
                ].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
            </div>
            <div style={{ ...S.card(), overflowX: "auto" }}>
                <table style={{ ...S.tbl, minWidth: isMobile ? 600 : undefined }}>
                    <thead><tr>{["Invoice", "Client", "Journey", "Issued", "Due", "Amount", "M-Pesa Ref", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {data.invoices.sort((a, b) => b.issued.localeCompare(a.issued)).map(inv => (
                            <tr key={inv.id}>
                                <td style={{ ...S.td, fontFamily: "monospace", color: "#38bdf8" }}>{inv.id}</td>
                                <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{inv.client}</td>
                                <td style={S.td}>{inv.journey ? `${data.journeys.find(j => j.id === inv.journey)?.origin}→${data.journeys.find(j => j.id === inv.journey)?.dest}` : "—"}</td>
                                <td style={S.td}>{inv.issued}</td>
                                <td style={S.td}>{inv.due}</td>
                                <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(inv.amount)}</td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "#10b981" }}>{inv.mpesaRef || "—"}</td>
                                <td style={S.td}><span style={S.badge(inv.status)}>{inv.status}</span></td>
                                <td style={S.td}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button style={S.btn("sm")} onClick={() => setInvoicePreview(inv)}>View</button>
                                        {inv.status !== "Paid" && <button style={S.btn("green")} onClick={() => markInvoicePaid(inv.id)} >✓ Paid</button>}
                                        <button style={S.btn("sm")} onClick={() => openModal("invoice", inv)}>Edit</button>
                                        <button style={S.btn("del")} onClick={() => delItem("invoices", inv.id)}>✕</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {invoicePreview && (
                <div style={S.ovl} onClick={() => setInvoicePreview(null)}>
                    <div style={{ maxWidth: 720, width: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                        <InvoiceView inv={invoicePreview} />
                        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                            <button style={S.btn()} onClick={() => window.print()}>🖨️ Print / Save PDF</button>
                            <button style={S.btn("ghost")} onClick={() => setInvoicePreview(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            {modal === "invoice" && (
                <Modal title={form.id ? "Edit Invoice" : "New Invoice"} onSave={() => { if (!form.id) form.id = "INV-" + uid().slice(0, 5); saveItem("invoices", form); }}>
                    <div style={S.fgg(2)}>
                        <F label="Client Name" k="client" full /><F label="Client Phone" k="phone" />
                        <F label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} />
                        <F label="Amount (KES)" k="amount" type="number" /><F label="Date Issued" k="issued" type="date" />
                        <F label="Due Date" k="due" type="date" /><F label="Status" k="status" options={["Pending", "Paid", "Overdue"]} />
                        <F label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567" /><F label="Date Paid" k="paidDate" type="date" />
                        <F label="Notes" k="notes" full />
                    </div>
                </Modal>
            )}
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════════
    // PAYROLL
    // ══════════════════════════════════════════════════════════════════════════
    const Payroll = () => {
        const months = [...new Set(data.payroll.map(p => p.month))].sort().reverse();
        const [selMonth, setSelMonth] = useState(months[0] || "2025-03");
        const monthPayroll = data.payroll.filter(p => p.month === selMonth);
        const totalNet = monthPayroll.reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={S.ph}>◑ Driver Payroll</div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <select style={{ ...S.inp, width: 180 }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
                            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select>
                        <button style={S.btn()} onClick={() => openModal("payroll", { month: selMonth, status: "Pending" })}>+ Add Pay Record</button>
                    </div>
                </div>
                <div style={S.grid(4, 3, 1)}>
                    {[
                        { l: "Total Payroll", v: fmt(totalNet), c: "#f59e0b" },
                        { l: "Paid", v: fmt(monthPayroll.filter(p => p.status === "Paid").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)), c: "#10b981" },
                        { l: "Pending", v: fmt(monthPayroll.filter(p => p.status === "Pending").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)), c: "#ef4444" },
                        { l: "Drivers", v: monthPayroll.length, c: "#38bdf8" },
                    ].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
                </div>
                <div style={S.card()}>
                    <table style={S.tbl}>
                        <thead><tr>{["Driver", "M-Pesa No.", "Base Salary", "Allowances", "Deductions", "Net Pay", "M-Pesa Ref", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {monthPayroll.map(p => {
                                const drv = data.drivers.find(d => d.id === p.driver);
                                const net = +p.baseSalary + +p.allowance - +p.deductions;
                                return (
                                    <tr key={p.id}>
                                        <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{drv?.name || p.driver}</td>
                                        <td style={{ ...S.td, fontFamily: "monospace", color: "#10b981", fontSize: 11 }}>💚 {drv?.mpesa || "—"}</td>
                                        <td style={S.td}>{fmt(p.baseSalary)}</td>
                                        <td style={{ ...S.td, color: "#10b981" }}>+{fmt(p.allowance)}</td>
                                        <td style={{ ...S.td, color: "#ef4444" }}>-{fmt(p.deductions)}</td>
                                        <td style={{ ...S.td, color: "#f59e0b", fontWeight: 800 }}>{fmt(net)}</td>
                                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: p.mpesaRef ? "#10b981" : T.textFaint }}>{p.mpesaRef || "—"}</td>
                                        <td style={S.td}><span style={S.badge(p.status)}>{p.status}</span></td>
                                        <td style={S.td}>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                {p.status === "Pending" && <button style={S.btn("green")} onClick={() => markPayrollPaid(p.id)}>✓ Pay via M-Pesa</button>}
                                                <button style={S.btn("sm")} onClick={() => openModal("payroll", p)}>Edit</button>
                                                <button style={S.btn("del")} onClick={() => delItem("payroll", p.id)}>✕</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {monthPayroll.some(p => p.status === "Pending") && (
                        <div style={{ marginTop: 16, padding: 14, background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, fontSize: 13, color: "#f97316" }}>
                            💡 <b>M-Pesa Integration:</b> To send salaries via M-Pesa, use Safaricom Business Pay Bill or M-Pesa Business API. Each driver's M-Pesa number is shown above. Mark payments as paid after confirmation.
                        </div>
                    )}
                </div>
                {modal === "payroll" && (
                    <Modal title={form.id ? "Edit Pay Record" : "Add Pay Record"} onSave={() => saveItem("payroll", form)}>
                        <div style={S.fgg(2)}>
                            <F label="Driver" k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} />
                            <F label="Month (YYYY-MM)" k="month" placeholder="2025-03" />
                            <F label="Base Salary (KES)" k="baseSalary" type="number" /><F label="Allowances (KES)" k="allowance" type="number" />
                            <F label="Deductions (KES)" k="deductions" type="number" /><F label="Status" k="status" options={["Pending", "Paid"]} />
                            <F label="M-Pesa Reference" k="mpesaRef" placeholder="e.g. PAY1234567" /><F label="Date Paid" k="paidDate" type="date" />
                        </div>
                    </Modal>
                )}
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // TYRE MONITOR
    // ══════════════════════════════════════════════════════════════════════════
    const TyreMonitor = () => (
        <div>
            <div style={S.ph}>◍ Tyre Health Monitor</div>
            <div style={S.grid(3, 2, 1)}>
                {data.trucks.map(t => {
                    const ts = tyreStatus(t);
                    const alertColor = ts.status === "Overdue" ? "#ef4444" : ts.status === "Due Soon" ? "#f97316" : "#10b981";
                    return (
                        <div key={t.id} style={S.card(alertColor)}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 17, color: T.text }}>{t.reg}</div>
                                    <div style={{ fontSize: 12, color: T.textFaint }}>{t.make} · {t.type}</div>
                                </div>
                                <span style={S.badge(ts.status)}>{ts.status}</span>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: T.textFaint }}>Tyre usage</span>
                                    <span style={{ color: alertColor, fontWeight: 700 }}>{ts.kmSinceChange.toLocaleString()} / {t.tyreLimit.toLocaleString()} km</span>
                                </div>
                                <div style={{ ...S.bar(), height: 10 }}><div style={S.barFill(ts.pct, alertColor)} /></div>
                                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 5, textAlign: "right" }}>{fmtN(ts.pct, 1)}% worn</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                {[
                                    { l: "Km Since Change", v: `${ts.kmSinceChange.toLocaleString()} km`, c: T.text },
                                    { l: "Remaining", v: ts.remaining <= 0 ? `${Math.abs(ts.remaining).toLocaleString()} km over!` : `${ts.remaining.toLocaleString()} km`, c: alertColor },
                                    { l: "Changed At", v: `${t.tyreOdom.toLocaleString()} km`, c: T.textDim },
                                    { l: "Current Odom", v: `${t.odom.toLocaleString()} km`, c: T.textDim },
                                ].map(s => (
                                    <div key={s.l} style={{ background: dark ? T.bg : '#f8fafc', borderRadius: 7, padding: 10, border: `1px solid ${T.border}` }}>
                                        <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{s.l}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</div>
                                    </div>
                                ))}
                            </div>
                            {ts.status !== "OK" && (
                                <div style={{ background: alertColor + (dark ? "18" : "22"), border: `1px solid ${alertColor}66`, borderRadius: 8, padding: 10, fontSize: 12, color: alertColor, fontWeight: 600 }}>
                                    {ts.status === "Overdue" ? "⛔ Tyres must be changed immediately!" : "⚠️ Schedule tyre change soon."}
                                </div>
                            )}
                            <button style={{ ...S.btn("sm"), marginTop: 12 }} onClick={() => openModal("truck", t)}>Update Odometer / Tyre Info</button>
                        </div>
                    );
                })}
            </div>
            <div style={S.card()}>
                <div style={{ fontWeight: 700, color: T.text, marginBottom: 16, fontSize: 14 }}>📊 Tyre Cost History</div>
                <table style={S.tbl}>
                    <thead><tr>{["Date", "Truck", "Description", "Cost"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {data.expenses.filter(e => e.cat === "Tyre").sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                            <tr key={e.id}>
                                <td style={S.td}>{e.date}</td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(e.truck)}</td>
                                <td style={S.td}>{e.desc}</td>
                                <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700 }}>{fmt(e.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════════
    // P&L REPORT
    // ══════════════════════════════════════════════════════════════════════════
    const PnL = () => {
        const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : 0;
        const catBreakdown = CATS.filter(c => c !== "Fuel").map(c => ({ cat: c, total: data.expenses.filter(e => e.cat === c).reduce((s, e) => s + +e.amount, 0) })).filter(x => x.total > 0);
        const totalSalaries = data.payroll.filter(p => p.status === "Paid").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);
        const handlePrint = () => {
            const printContent = document.getElementById("pnl-print-area");
            const w = window.open("", "_blank");
            w.document.write(`<html><head><title>Segecha Group P&L Report</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111;}table{width:100%;border-collapse:collapse;}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;}th{background:#f3f4f6;font-weight:700;}h1{color:#e85d04;}h2{color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;}.total-row{background:#e85d04;color:#fff;font-weight:800;}.sub-header{background:#f9fafb;color:#374151;}</style></head><body>${printContent.innerHTML}</body></html>`);
            w.document.close();
            w.print();
        };
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={S.ph}>▣ P&L Report</div>
                    <button style={S.btn("orange")} onClick={handlePrint}>🖨️ Print / Export PDF</button>
                </div>
                <div style={S.grid(3, 2, 1)}>
                    {[
                        { l: "Gross Revenue", v: fmt(totalRevenue), c: "#10b981", s: `${data.journeys.filter(j => j.status === "Completed").length} completed trips` },
                        { l: "Total Costs", v: fmt(totalExpenses), c: "#f59e0b", s: "Fuel + all operations" },
                        { l: "Net Profit / Loss", v: fmt(netProfit), c: netProfit >= 0 ? "#3b82f6" : "#ef4444", s: `${margin}% profit margin` },
                    ].map((k, i) => <div key={i} style={{ ...S.card(k.c), padding: 24 }}><div style={S.kpi}>{k.l}</div><div style={{ ...S.val(k.c), fontSize: 30 }}>{k.v}</div><div style={{ ...S.sub, fontSize: 12, marginTop: 6 }}>{k.s}</div></div>)}
                </div>
                <div style={S.grid(2, 1, 1)}>
                    <div style={S.card()}>
                        <div style={{ fontWeight: 700, color: T.text, marginBottom: 16, fontSize: 14 }}>Per-Truck P&L</div>
                        <table style={S.tbl}>
                            <thead><tr>{["Truck", "Revenue", "Fuel", "Other", "Net", "Margin", "km/L"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {data.trucks.map(t => {
                                    const st = truckStats(t.id);
                                    const m = st.rev > 0 ? (st.profit / st.rev * 100).toFixed(1) : "0.0";
                                    return (
                                        <tr key={t.id}>
                                            <td style={{ ...S.td, fontWeight: 800, color: "#f97316" }}>{t.reg}</td>
                                            <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(st.rev)}</td>
                                            <td style={{ ...S.td, color: "#f97316" }}>{fmt(st.fuelCost)}</td>
                                            <td style={{ ...S.td, color: "#f59e0b" }}>{fmt(st.exp - st.fuelCost)}</td>
                                            <td style={{ ...S.td, color: st.profit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: 800 }}>{fmt(st.profit)}</td>
                                            <td style={{ ...S.td, color: +m >= 0 ? "#10b981" : "#ef4444" }}>{m}%</td>
                                            <td style={{ ...S.td, color: "#a78bfa" }}>{fmtN(st.kmPerL, 2)}</td>
                                        </tr>
                                    );
                                })}
                                <tr style={{ background: T.border }}>
                                    <td style={{ ...S.td, fontWeight: 800, color: T.text }}>TOTAL</td>
                                    <td style={{ ...S.td, color: "#10b981", fontWeight: 800 }}>{fmt(totalRevenue)}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 800 }}>{fmt(totalFuelCost)}</td>
                                    <td style={{ ...S.td, color: "#f59e0b", fontWeight: 800 }}>{fmt(totalOtherExp)}</td>
                                    <td style={{ ...S.td, color: netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: 800 }}>{fmt(netProfit)}</td>
                                    <td style={{ ...S.td, fontWeight: 800, color: +margin >= 0 ? "#10b981" : "#ef4444" }}>{margin}%</td>
                                    <td style={S.td}>—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style={S.card()}>
                        <div style={{ fontWeight: 700, color: T.text, marginBottom: 16, fontSize: 14 }}>Cost Breakdown</div>
                        {[{ cat: "Fuel", total: totalFuelCost }, ...catBreakdown, { cat: "Payroll Paid", total: totalSalaries }].map((e, i) => {
                            const colors = ["#f97316", "#f59e0b", "#a78bfa", "#10b981", "#3b82f6", "#f87171", "#34d399", "#fb923c"];
                            const c = colors[i % colors.length];
                            const pct = totalExpenses > 0 ? (e.total / totalExpenses * 100).toFixed(1) : 0;
                            return (
                                <div key={e.cat} style={{ marginBottom: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                                        <span style={{ color: T.textDim }}>{e.cat}</span>
                                        <span style={{ color: c, fontWeight: 700 }}>{fmt(e.total)} <span style={{ color: T.textFaint, fontWeight: 400 }}>({pct}%)</span></span>
                                    </div>
                                    <div style={S.bar()}><div style={S.barFill(+pct, c)} /></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Printable P&L */}
                <div id="pnl-print-area" style={{ ...S.card("#10b981"), padding: 28, background: dark ? undefined : "#f0fdf4", border: dark ? undefined : "1px solid #bbf7d0" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#10b981", marginBottom: 4 }}>📋 Segecha Group — Profit & Loss Statement</div>
                    <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 20 }}>Generated: {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
                        <div>
                            <div style={{ color: T.textFaint, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Income</div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                                <span style={{ color: T.textDim }}>Freight Revenue</span>
                                <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(totalRevenue)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                                <span style={{ color: T.textDim }}>Invoices Collected (M-Pesa)</span>
                                <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(invoicesPaid)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 800, fontSize: 14 }}>
                                <span style={{ color: T.text }}>Total Income</span><span style={{ color: "#10b981" }}>{fmt(totalRevenue)}</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ color: T.textFaint, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Expenditure</div>
                            {[{ l: "Fuel", v: totalFuelCost }, ...catBreakdown, { l: "Payroll (Paid)", v: totalSalaries }].map(e => (
                                <div key={e.cat || e.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border2}`, fontSize: 13 }}>
                                    <span style={{ color: T.textDim }}>{e.cat || e.l}</span>
                                    <span style={{ color: "#f59e0b", fontWeight: 600 }}>{fmt(e.total || e.v)}</span>
                                </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 800, fontSize: 14 }}>
                                <span style={{ color: T.text }}>Total Expenses</span><span style={{ color: "#f59e0b" }}>{fmt(totalExpenses)}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ borderTop: "2px solid #10b981", marginTop: 20, paddingTop: 20, display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 800 }}>
                        <span style={{ color: T.text }}>NET {netProfit >= 0 ? "PROFIT" : "LOSS"}</span>
                        <span style={{ color: netProfit >= 0 ? "#10b981" : "#ef4444" }}>{fmt(Math.abs(netProfit))}</span>
                    </div>
                </div>
            </div>
        );
    };

    const PAGES = { dashboard: Dashboard, trucks: Fleet, drivers: Drivers, journeys: Journeys, fuel: FuelLog, expenses: Expenses, invoices: Invoices, payroll: Payroll, tyres: TyreMonitor, pnl: PnL };
    const PageComp = PAGES[page] || Dashboard;
    const tyreAlertCount = data.trucks.filter(t => tyreStatus(t).status !== "OK").length;

    return (
        <div style={S.wrap}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.82; }
        .tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .tbl-wrap table { min-width: 500px; }
        select option { background: #10141f; color: #e2e8f0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #94a3b830; border-radius: 4px; }
        @media print { body { background: white; } }
      `}</style>
            {isMobile && sideOpen && <div style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 89 }} onClick={() => setSideOpen(false)} />}
            <header style={S.topbar}>
                <div style={S.brand}>
                    {isMobile && <button onClick={() => setSideOpen(o => !o)} style={{ background: "none", border: "none", color: T.text, fontSize: 22, cursor: "pointer", padding: "0 6px 0 0", lineHeight: 1 }}>☰</button>}
                    <div style={S.brandDot}>🚛</div>
                    {!isMobile && "Segecha Group"}
                    {isMobile && <span style={{ fontSize: 14, fontWeight: 800 }}>Segecha</span>}
                </div>
                <div style={S.meta}>
                    {!isMobile && <span>📍 Nairobi, KE</span>}
                    {!isMobile && <span>{new Date().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>}
                    {tyreAlertCount > 0 && <span style={S.pill("#ef4444")}>🔴 {tyreAlertCount}</span>}
                    <span style={S.pill("#10b981")}>{data.trucks.filter(t => t.status === "Active").length}/{data.trucks.length} {!isMobile && "Active"}</span>
                    <button
                        onClick={() => setDark(d => !d)}
                        title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        style={{ background: dark ? "#ffffff18" : "#00000012", border: `1px solid ${dark ? "#ffffff22" : "#00000018"}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 13, color: dark ? "#fbbf24" : "#6366f1", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
                    >
                        {dark ? "☀️" : "🌙"}{!isMobile && <span style={{ fontSize: 11 }}>{dark ? " Light" : " Dark"}</span>}
                    </button>
                </div>
            </header>
            <div style={S.body}>
                <nav style={S.side(sideOpen)}>
                    <div style={S.navGrp}>Navigation</div>
                    {NAV.map(n => (
                        <button key={n.id} style={S.navBtn(page === n.id)} onClick={() => { setPage(n.id); if (isMobile) setSideOpen(false); }}>
                            <span>{n.icon}</span>
                            <span>{n.label}</span>
                            {n.id === "tyres" && tyreAlertCount > 0 && <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{tyreAlertCount}</span>}
                        </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <div style={{ padding: "12px 16px", borderTop: "1px solid #1c2235", fontSize: 11, color: T.textGhost }}>Segecha Group v2.0</div>
                </nav>
                <main style={S.main}><PageComp /></main>
            </div>
        </div>
    );
}
