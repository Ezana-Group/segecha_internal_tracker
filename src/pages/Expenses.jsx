import React, { useState } from "react";
import {
    CreditCard,
    Truck,
    Search as SearchIcon,
    Plus,
    AlertCircle,
    Wrench,
    FileText,
    CircleDollarSign,
    Download,
    TrendingUp,
    Wallet,
    Pencil,
    Trash2,
    Locate,
    CheckCircle2,
    History,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fmt, today, fmtDate } from "../utils/formatters";
import { CATS } from "../constants/nav";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function Expenses({
    data, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem,
    truckReg, setVerifyModal, pendingVerifications, customerName, verifySubmission
}) {
    const navigate = useNavigate();
    const [panelTruckId, setPanelTruckId] = useState(null);
    const [activeTab, setActiveTab] = useState('all');

    const refinedExpenses = data.expenses.map(e => ({
        ...e,
        _vehicle: truckReg(e.truck),
        _trailer: (() => { const t = (data.trailers || []).find(t => t.id === (e.trailer_id || e.trailer)); return t ? `${t.reg} (${t.type})` : ''; })(),
        _amount: Number(e.amount || 0)
    }));

    const {
        filteredRows: sortedItems,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: expenseFilters,
        applyFilter: handleExpenseFilterChange,
        getUniqueValues: getExpenseUniqueValues,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedExpenses, {
        namespace: "exp",
        initialSort: { col: "date", dir: "desc" },
        searchColumns: ["uId", "desc", "cat", "_vehicle"]
    });

    const getCatIcon = (cat) => {
        switch (cat) {
            case "Maintenance": return Wrench;
            case "Toll": return Locate;
            case "Permit": return FileText;
            case "Fuel": return CircleDollarSign;
            case "Allowance": return Wallet;
            default: return CreditCard;
        }
    };

    const getCatColor = (cat) => {
        switch (cat) {
            case "Maintenance": return "#f59e0b";
            case "Fuel": return "#f97316";
            case "Toll": return "#0ea5e9";
            case "Permit": return "#8b5cf6";
            case "Allowance": return "#10b981";
            default: return "#6366f1";
        }
    };

    const totalExpenseFiltered = sortedItems.reduce((s, e) => s + +e.amount, 0);
    const totalMaintenanceFiltered = sortedItems.filter(e => e.cat === "Maintenance").reduce((s, e) => s + +e.amount, 0);

    const DEFAULT_SCHEDULE = [
        { task: 'Oil Change', intervalKm: 10000 },
        { task: 'Tyre Rotation', intervalKm: 10000 },
        { task: 'Brake Pad Replacement', intervalKm: 15000 },
        { task: 'Fuel Filter Replacement', intervalKm: 20000 },
    ];

    const getTruckStats = (truckId) => {
        const truck = data.trucks.find(t => t.id === truckId);
        if (!truck) return null;

        const mainHistory = data.expenses.filter(e => e.truck === truckId && e.cat === 'Maintenance');
        const totalCost = mainHistory.reduce((s, e) => s + +e.amount, 0);
        const odom = +truck.odom || 0;

        const overdue = DEFAULT_SCHEDULE.filter(s => {
            const taskHistory = mainHistory.filter(e => e.desc?.toLowerCase().includes(s.task.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
            const lastOdom = taskHistory.length > 0 ? +(taskHistory[0].odom || 0) : 0;
            return (odom - lastOdom) >= s.intervalKm;
        });

        return { truck, totalCost, mainHistory, overdue };
    };

    const stats = panelTruckId ? getTruckStats(panelTruckId) : null;

    // Category filter tabs
    const catCounts = CATS.reduce((acc, c) => {
        acc[c] = data.expenses.filter(e => e.cat === c).length;
        return acc;
    }, {});

    const pendingCount = pendingVerifications?.filter(v => v._itemType === 'expense').length || 0;

    return (
        <div className="page-shell">
            <PageHeader
                icon={Wallet}
                title="Expenses"
                description="Operational spend, maintenance, and overheads by category."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>Export summary</Button>
                        <Button variant="premium" icon={Plus} onClick={() => openModal("expense", { date: today() })}>
                            Add Expense
                        </Button>
                    </>
                }
            />

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <Card style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", marginBottom: 12 }}>
                        <TrendingUp size={18} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total (Filtered)</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalExpenseFiltered)}</div>
                </Card>
                <Card
                    style={{ padding: 20, background: "var(--bg-card)", border: expenseFilters.cat?.has("Maintenance") ? "2px solid #f59e0b" : "1px solid var(--border-subtle)", borderRadius: 16, cursor: "pointer" }}
                    onClick={() => handleExpenseFilterChange("cat", new Set(["Maintenance"]))}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                            <Wrench size={18} />
                        </div>
                        {expenseFilters.cat?.has("Maintenance") && <Badge status="Active" text="Filtering" />}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Maintenance (Filtered)</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalMaintenanceFiltered)}</div>
                </Card>
                <Card style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0ea5e9", marginBottom: 12 }}>
                        <FileText size={18} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Filtered Items</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                        {sortedItems.length} <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Entries</span>
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <button
                    style={{ padding: '11px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === 'all' ? 800 : 600, color: activeTab === 'all' ? 'var(--brand-primary)' : 'var(--text-dim)', borderBottom: activeTab === 'all' ? '2px solid var(--brand-primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('all')}
                >
                    All Expenses
                </button>
                <button
                    style={{ padding: '11px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === 'awaiting' ? 800 : 600, color: activeTab === 'awaiting' ? 'var(--brand-primary)' : 'var(--text-dim)', borderBottom: activeTab === 'awaiting' ? '2px solid var(--brand-primary)' : '2px solid transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => setActiveTab('awaiting')}
                >
                    Awaiting Approval
                    {pendingCount > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Category Filter Chips */}
            {activeTab === 'all' && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    <button
                        onClick={() => handleExpenseFilterChange("cat", new Set())}
                        style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border-subtle)", background: !expenseFilters.cat?.size ? "var(--brand-primary)" : "var(--surface-subtle)", color: !expenseFilters.cat?.size ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                        All
                    </button>
                    {CATS.map(cat => {
                        const Icon = getCatIcon(cat);
                        const color = getCatColor(cat);
                        const isActive = expenseFilters.cat?.has(cat);
                        return (
                            <button
                                key={cat}
                                onClick={() => handleExpenseFilterChange("cat", new Set([cat]))}
                                style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${isActive ? color : 'var(--border-subtle)'}`, background: isActive ? `${color}15` : "var(--surface-subtle)", color: isActive ? color : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                            >
                                <Icon size={12} />
                                {cat}
                                {catCounts[cat] > 0 && <span style={{ opacity: 0.6 }}>({catCounts[cat]})</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Table */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 20 }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                    <SearchIcon size={16} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search expenses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                    />
                </div>
                <div className="table-container">
                    <table className="table-modern">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={expenseFilters}
                            onFilterChange={handleExpenseFilterChange}
                            getUniqueValues={getExpenseUniqueValues}
                            columns={[
                                { key: "date", label: "Date", sortable: true },
                                { key: "cat", label: "Category", sortable: true },
                                { key: "desc", label: "Description", sortable: true },
                                { key: "_vehicle", label: "Truck", sortable: true },
                                { key: "_trailer", label: "Trailer", sortable: true },
                                { key: "_amount", label: "Amount", sortable: true, align: "right" },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {activeTab === 'awaiting' ? (
                                pendingCount === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 64, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 12 }}><CheckCircle2 size={40} opacity={0.2} color="#10b981" /></div>
                                            <div style={{ fontWeight: 600 }}>No expenses awaiting approval.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    pendingVerifications?.filter(v => v._itemType === 'expense').map(v => {
                                        const Icon = getCatIcon(v.cat);
                                        const color = getCatColor(v.cat);
                                        return (
                                            <tr key={v.id} onClick={() => setVerifyModal(v)} style={{ cursor: "pointer" }} className="hover-scale">
                                                <td className="sticky-col" style={{ fontWeight: 700 }}>{fmtDate(v.date)}</td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                                                            <Icon size={13} />
                                                        </div>
                                                        <span style={{ fontWeight: 700, fontSize: 13 }}>{v.cat}</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{v.desc || v.cat}</td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                                                        <Truck size={13} color="var(--brand-primary)" />
                                                        {truckReg(v.truck)}
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                    {(() => { const t = (data.trailers || []).find(t => t.id === (v.trailer_id || v.trailer)); return t ? `${t.reg} (${t.type})` : '—'; })()}
                                                </td>
                                                <td style={{ fontWeight: 900, textAlign: "right" }}>{fmt(v.amount)}</td>
                                                <td><Badge status="Warning" text="Pending Review" /></td>
                                                <td style={{ textAlign: "right" }}>
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); setVerifyModal(v); }}>Review</Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )
                            ) : sortedItems.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: 64, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 12 }}><AlertCircle size={40} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No expense records found.</div>
                                    </td>
                                </tr>
                            ) : sortedItems.map(e => {
                                const Icon = getCatIcon(e.cat);
                                const color = getCatColor(e.cat);
                                return (
                                    <tr key={e.id} onClick={() => openModal("expense", e)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td className="sticky-col" style={{ fontWeight: 700 }}>{fmtDate(e.date)}</td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                                                    <Icon size={13} />
                                                </div>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{e.cat}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {e.subCat && <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", marginBottom: 2 }}>{e.subCat}</div>}
                                            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{e.desc}</div>
                                            {e.journey && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>Mission #{e.journey.slice(0, 8)}</div>}
                                        </td>
                                        <td>
                                            <div
                                                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                                                onClick={(ev) => { ev.stopPropagation(); setPanelTruckId(e.truck); }}
                                            >
                                                <Truck size={13} color="var(--brand-primary)" />
                                                {e._vehicle}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                                            {e._trailer || <span style={{ color: "var(--text-dim)" }}>—</span>}
                                        </td>
                                        <td style={{ fontWeight: 900, textAlign: "right" }}>{fmt(e.amount)}</td>
                                        <td className="status-col"><Badge status="Active" text="Processed" /></td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for expense ${e.id}`}
                                                items={[
                                                    {
                                                        id: "edit", label: "Edit expense", icon: Pencil,
                                                        onClick: (ev) => { ev.stopPropagation(); openModal("expense", e); },
                                                    },
                                                    {
                                                        id: "delete", label: "Delete", icon: Trash2, danger: true,
                                                        onClick: (ev) => { ev.stopPropagation(); delItem("expenses", e.id, e.desc); },
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Truck Side Panel */}
            {panelTruckId && stats && (
                <div style={{ position: "fixed", top: 0, right: 0, width: isMobile ? "100%" : 440, height: "100%", maxHeight: "100dvh", background: "var(--bg-main)", boxShadow: "-10px 0 30px rgba(0,0,0,0.2)", borderLeft: "1px solid var(--border-subtle)", padding: "max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(40px, env(safe-area-inset-left))", overflowY: "auto", WebkitOverflowScrolling: "touch", zIndex: 1001, boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Vehicle Snapshot</div>
                            <h2 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>{stats.truck.reg}</h2>
                        </div>
                        <Button variant="ghost" onClick={() => setPanelTruckId(null)}>Close</Button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
                        <div style={{ padding: 18, background: "var(--surface-subtle)", borderRadius: 14, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>MAINTENANCE TOTAL</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--brand-primary)" }}>{fmt(stats.totalCost)}</div>
                        </div>
                        <div style={{ padding: 18, background: "var(--surface-subtle)", borderRadius: 14, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>ODOMETER</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{Number(stats.truck.odom || 0).toLocaleString()} km</div>
                        </div>
                    </div>
                    <div style={{ marginBottom: 28 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                            <AlertCircle size={15} color="#ef4444" /> Overdue Tasks
                        </h3>
                        {stats.overdue.length === 0 ? (
                            <div style={{ padding: 14, background: "rgba(16,185,129,0.05)", borderRadius: 10, color: "#10b981", fontSize: 13, fontWeight: 600 }}>All preventive intervals in range.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {stats.overdue.map(s => (
                                    <div key={s.task} style={{ padding: 14, background: "rgba(239,68,68,0.05)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.task}</div>
                                        <Badge status="Overdue" text="Critical" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                            <History size={15} color="var(--brand-primary)" /> Recent Service
                        </h3>
                        {stats.mainHistory.length === 0 ? (
                            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No service records found.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {stats.mainHistory.slice(0, 5).map(e => (
                                    <div key={e.id} style={{ padding: 14, borderLeft: "3px solid var(--brand-primary)", background: "var(--surface-subtle)", borderRadius: "0 10px 10px 0" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                            <div style={{ fontWeight: 800, fontSize: 12 }}>{fmtDate(e.date)}</div>
                                            <div style={{ fontWeight: 900, color: "var(--brand-primary)", fontSize: 13 }}>{fmt(e.amount)}</div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.desc}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: 32 }}>
                        <Button full variant="primary" onClick={() => navigate(`/fleet/${stats.truck.id}`)}>View Vehicle Profile</Button>
                    </div>
                </div>
            )}
            {panelTruckId && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000 }} onClick={() => setPanelTruckId(null)} />}
        </div>
    );
}
