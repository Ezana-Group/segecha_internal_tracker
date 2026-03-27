import React, { useState } from "react";
import { 
    CreditCard, 
    Truck, 
    Tag, 
    Search as SearchIcon, 
    Plus, 
    Filter, 
    Calendar, 
    AlertCircle, 
    ArrowDownRight,
    ArrowUpRight,
    Wrench,
    Locate,
    FileText,
    CircleDollarSign,
    Download,
    TrendingUp,
    ChevronDown,
    Wallet,
    Pencil,
    Trash2,
    Receipt,
    ChevronRight,
    Droplet,
    Navigation,
    Clock,
    CheckCircle2,
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
    
    // Refine data for sorting and filtering
    const refinedExpenses = (data.expenses || []).map(e => {
        const journey = e.journey ? (data.journeys || []).find(j => j.id === e.journey) : null;
        const isProjected = journey && journey.status !== 'Completed';
        
        return {
            ...e,
            _vehicle: truckReg(e.truck),
            _amount: Number(e.amount || 0),
            _status: isProjected ? 'Projected' : (e.status || 'Processed')
        };
    });

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
        switch(cat) {
            case "Maintenance": return Wrench;
            case "Toll": return Locate;
            case "Permit": return FileText;
            case "Fuel": return CircleDollarSign;
            case "Allowance": return Wallet;
            default: return CreditCard;
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
            const taskHistory = mainHistory.filter(e => e.desc?.toLowerCase().includes(s.task.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date));
            const lastOdom = taskHistory.length > 0 ? +(taskHistory[0].odom || 0) : 0;
            return (odom - lastOdom) >= s.intervalKm;
        });

        return { truck, totalCost, mainHistory, overdue };
    };

    const stats = panelTruckId ? getTruckStats(panelTruckId) : null;

    return (
        <div className="page-shell">
            <PageHeader
                icon={Wallet}
                title="Expenses"
                description="Operational spend, maintenance, and overheads by category."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>
                            Export summary
                        </Button>
                        <Button variant="premium" icon={Plus} onClick={() => openModal("expense", { date: today() })}>
                            Add expense
                        </Button>
                    </>
                }
            />
            
            {/* KPI Overview */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                <Card style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Expenditure (Filtered)</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalExpenseFiltered)}</div>
                </Card>
                <Card style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, cursor: 'pointer' }} onClick={() => handleExpenseFilterChange("cat", new Set(["Maintenance"]))}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                            <Wrench size={20} />
                        </div>
                        {expenseFilters.cat?.has("Maintenance") && <Badge status="Active" text="Filtering" />}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Maintenance (Filtered)</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalMaintenanceFiltered)}</div>
                </Card>
                <Card style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(14, 165, 233, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0ea5e9" }}>
                            <FileText size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Filtered Items</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{sortedItems.length} <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Entries</span></div>
                </Card>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
                <button
                    style={{ padding: '12px 16px', border: 'none', borderBottom: activeTab === 'all' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'all' ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: activeTab === 'all' ? 800 : 600, background: 'transparent', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('all')}
                >
                    All Expenses
                </button>
                <button
                    style={{ padding: '12px 16px', border: 'none', borderBottom: activeTab === 'awaiting' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'awaiting' ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: activeTab === 'awaiting' ? 800 : 600, background: 'transparent', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('awaiting')}
                >
                    Awaiting Approval
                    {pendingVerifications?.filter(v => v._itemType === 'expense').length > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                            {pendingVerifications.filter(v => v._itemType === 'expense').length}
                        </span>
                    )}
                </button>
            </div>

            {/* Expense Log Table */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
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
                                { key: "uId", label: "Exp ID", sortable: true },
                                { key: "_vehicle", label: "Vehicle", sortable: true },
                                { key: "cat", label: "Category", sortable: true },
                                { key: "desc", label: "Description", sortable: true },
                                { key: "date", label: "Date", sortable: true },
                                { key: "_amount", label: "Amount", sortable: true, align: "right" },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {activeTab === 'awaiting' ? (
                                pendingVerifications?.filter(v => v._itemType === 'expense').length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><CheckCircle2 size={48} opacity={0.2} color="#10b981" /></div>
                                            <div style={{ fontWeight: 600 }}>No expenses awaiting approval.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    pendingVerifications?.filter(v => v._itemType === 'expense').map(v => {
                                        const Icon = getCatIcon(v.cat);
                                        return (
                                            <tr key={v.id} onClick={() => setVerifyModal(v)} style={{ cursor: "pointer", background: "rgba(239, 68, 68, 0.02)" }} className="hover-scale">
                                                <td className="sticky-col" title={v.uId || v.id.slice(0, 8).toUpperCase()}>
                                                    <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                        {v.uId || v.id.slice(0, 8).toUpperCase()}
                                                    </div>
                                                </td>
                                                <td title={truckReg(v.truck)}>
                                                    <div 
                                                        style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
                                                    >
                                                        <Truck size={14} color="var(--brand-primary)" />
                                                        {truckReg(v.truck)}
                                                    </div>
                                                </td>
                                                <td title={v.cat}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(245, 158, 11, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                                                            <Icon size={14} />
                                                        </div>
                                                        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{v.cat}</span>
                                                    </div>
                                                </td>
                                                <td title={v.desc || v.cat}>
                                                    <div style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>{v.desc || v.cat}</div>
                                                </td>
                                                <td title={fmtDate(v.date)}>
                                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(v.date)}</div>
                                                </td>
                                                <td title={fmt(v.amount)}>
                                                    <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 15, textAlign: "right" }}>{fmt(v.amount)}</div>
                                                </td>
                                                <td className="status-col" title="Pending Review">
                                                    <Badge status="Warning" text="Pending Review" />
                                                </td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <Button size="sm" onClick={(ev) => { ev.stopPropagation(); setVerifyModal(v); }}>
                                                        Review
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )
                            ) : (
                                sortedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No expense records found matching your filters.</div>
                                        </td>
                                    </tr>
                                ) : sortedItems.map(e => {
                                    const Icon = getCatIcon(e.cat);
                                    return (
                                        <tr key={e.id} onClick={(ev) => openModal("expense", e)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td className="sticky-col" title={e.uId || e.id.slice(0, 8).toUpperCase()}>
                                                <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                    {e.uId || e.id.slice(0, 8).toUpperCase()}
                                                </div>
                                            </td>
                                            <td title={e._vehicle}>
                                                <div 
                                                    style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                                                    onClick={(ev) => { ev.stopPropagation(); setPanelTruckId(e.truck); }}
                                                >
                                                    <Truck size={14} color="var(--brand-primary)" />
                                                    {e._vehicle}
                                                </div>
                                            </td>
                                            <td title={e.cat}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(245, 158, 11, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                                                        <Icon size={14} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{e.cat}</span>
                                                </div>
                                            </td>
                                            <td title={e.desc}>
                                                {e.subCat && (
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", marginBottom: 3 }}>
                                                        {e.subCat}
                                                    </div>
                                                )}
                                                <div style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>{e.desc}</div>
                                            </td>
                                            <td title={fmtDate(e.date)}>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(e.date)}</div>
                                                {e.journey && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                                                    Linked to mission #{e.journey.slice(0, 8)}
                                                </div>}
                                            </td>
                                            <td title={fmt(e.amount)}>
                                                <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 15, textAlign: "right" }}>{fmt(e.amount)}</div>
                                            </td>
                                            <td className="status-col" title={e._status}>
                                                <Badge 
                                                    status={e._status === 'Projected' ? 'Warning' : 'Success'} 
                                                    text={e._status} 
                                                />
                                            </td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for expense ${e.id}`}
                                                    items={[
                                                        {
                                                            id: "edit",
                                                            label: "Edit expense",
                                                            icon: Pencil,
                                                            onClick: (ev) => {
                                                                ev.stopPropagation();
                                                                openModal("expense", e);
                                                            },
                                                        },
                                                        {
                                                            id: "delete",
                                                            label: "Delete",
                                                            icon: Trash2,
                                                            danger: true,
                                                            onClick: (ev) => {
                                                                ev.stopPropagation();
                                                                delItem("expenses", e.id, e.desc);
                                                            },
                                                        },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Truck Details Side Panel */}
            {panelTruckId && stats && (
                <div style={{ position: "fixed", top: 0, right: 0, width: isMobile ? "100%" : 450, height: "100%", maxHeight: "100dvh", background: "var(--bg-main)", boxShadow: "-10px 0 30px rgba(0,0,0,0.2)", borderLeft: "1px solid var(--border-subtle)", padding: "max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(40px, env(safe-area-inset-left))", overflowY: "auto", WebkitOverflowScrolling: "touch", transition: "transform 0.3s ease", zIndex: 1001, boxSizing: "border-box" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Vehicle Snapshot</div>
                            <h2 style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>{stats.truck.reg}</h2>
                        </div>
                        <Button variant="ghost" onClick={() => setPanelTruckId(null)}>Close</Button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                        <div style={{ padding: 20, background: "var(--surface-subtle)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>TOTAL MAINTENANCE</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--brand-primary)" }}>{fmt(stats.totalCost)}</div>
                        </div>
                        <div style={{ padding: 20, background: "var(--surface-subtle)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>CURRENT ODOMETER</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{Number(stats.truck.odom || 0).toLocaleString()} km</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: 32 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <AlertCircle size={16} color="#ef4444" /> Overdue Maintenance
                        </h3>
                        {stats.overdue.length === 0 ? (
                            <div style={{ padding: 16, background: "rgba(16, 185, 129, 0.05)", borderRadius: 12, color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                                All preventive intervals are within range.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {stats.overdue.map(s => (
                                    <div key={s.task} style={{ padding: 16, background: "rgba(239, 68, 68, 0.05)", borderRadius: 12, border: "1px solid rgba(239, 68, 68, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{s.task}</div>
                                        <Badge status="Overdue" text="Critical" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <History size={16} color="var(--brand-primary)" /> Previous Maintenance
                        </h3>
                        {stats.mainHistory.length === 0 ? (
                            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No previous service records found.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {stats.mainHistory.slice(0, 5).map(e => (
                                    <div key={e.id} style={{ padding: 16, borderLeft: "4px solid var(--brand-primary)", background: "var(--surface-subtle)", borderRadius: "0 12px 12px 0" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>{fmtDate(e.date)}</div>
                                            <div style={{ fontWeight: 900, color: "var(--brand-primary)", fontSize: 14 }}>{fmt(e.amount)}</div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.desc}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 40 }}>
                        <Button full variant="primary" onClick={() => navigate(`/fleet/${stats.truck.id}`)}>View Full Vehicle Profile</Button>
                    </div>
                </div>
            )}
            {panelTruckId && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000 }} onClick={() => setPanelTruckId(null)} />}
        </div>
    );
}
