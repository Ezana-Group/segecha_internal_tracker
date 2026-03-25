import React, { useState } from "react";
import { CircleDot, Gauge, AlertTriangle, Pencil, Search as SearchIcon, CreditCard, Activity, AlertCircle } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";
import { fmt, fmtN, fmtDate } from "../utils/formatters";

const DEFAULT_TYRE_LIMIT_KM = 60000;

export function TyreMonitor({ data, dark, openModal, tyreStatus, truckReg, isMobile }) {
    const [activeTab, setActiveTab] = useState("health");

    // Refine health data for sorting and filtering
    const healthData = (data.trucks || []).map((t) => {
        const ts = tyreStatus(t);
        const limit = Number(t.tyreLimit) > 0 ? Number(t.tyreLimit) : DEFAULT_TYRE_LIMIT_KM;
        const rulePct = Math.min(100, parseFloat(ts.pct) || 0);
        return { 
            id: t.id,
            reg: t.reg, 
            make: t.make,
            type: t.type,
            status: ts.status, 
            kmSince: ts.kmSince, 
            remaining: ts.remaining, 
            odom: Number(t.odom || 0), 
            limit, 
            rulePct,
            rawTruck: t
        };
    });

    const spendData = (data.expenses || [])
        .filter((e) => e.cat === "Tyre")
        .map(e => ({
            ...e,
            vehicle: truckReg(e.truck) || "Unknown",
            amountVal: Number(e.amount || 0)
        }));

    const { 
        filteredRows: sortedHealthItems, 
        setSort: requestSortHealth, 
        sortState: sortConfigHealth,
        filterState: healthFilters,
        applyFilter: handleHealthFilterChange,
        getUniqueValues: getHealthUniqueValues,
        searchTerm: searchTermHealth,
        setSearchTerm: setSearchTermHealth
    } = useTableFilter(healthData, { 
        namespace: "tyreh", 
        initialSort: { col: "status", dir: "asc" },
        searchColumns: ["reg", "make", "type"]
    });

    const { 
        filteredRows: sortedSpendItems, 
        setSort: requestSortSpend, 
        sortState: sortConfigSpend,
        filterState: spendFilters,
        applyFilter: handleSpendFilterChange,
        getUniqueValues: getSpendUniqueValues,
        searchTerm: searchTermSpend,
        setSearchTerm: setSearchTermSpend
    } = useTableFilter(spendData, { 
        namespace: "tyres", 
        initialSort: { col: "date", dir: "desc" },
        searchColumns: ["vehicle", "desc"]
    });

    const totalSpendFiltered = sortedSpendItems.reduce((sum, e) => sum + e.amountVal, 0);

    return (
        <div className="page-shell">
            <PageHeader
                icon={CircleDot}
                title="Tyre management"
                description="Monitor fleet tyre health and historical replacement expenditure."
                belowTitle={
                    <div style={{ display: "flex", gap: 12, marginTop: 24, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
                        {[
                            { id: "health", label: "Tyre Health", icon: Activity },
                            { id: "spend", label: "Replacement Spend", icon: CreditCard }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "12px 20px",
                                    border: "none",
                                    background: "none",
                                    color: activeTab === tab.id ? "var(--brand-primary)" : "var(--text-dim)",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    position: "relative",
                                    transition: "all 0.2s"
                                }}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "var(--brand-primary)", borderRadius: "3px 3px 0 0" }} />
                                )}
                            </button>
                        ))}
                    </div>
                }
            />

            {activeTab === "health" ? (
                <div className="animate-fade-in">
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                        <div style={{ display: "flex", gap: 12 }}>
                            <Badge status="Active">{healthData.filter(d => d.status === "OK").length} Healthy</Badge>
                            <Badge status="Due Soon">{healthData.filter(d => d.status === "Due Soon").length} Due</Badge>
                            <Badge status="Overdue">{healthData.filter(d => d.status === "Overdue").length} Overdue</Badge>
                        </div>
                    </div>

                    <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                            <SearchIcon size={18} color="var(--text-dim)" />
                            <input
                                type="search"
                                placeholder="Search tyre health..."
                                value={searchTermHealth}
                                onChange={(e) => setSearchTermHealth(e.target.value)}
                                style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                            />
                        </div>
                        <div className="table-container">
                            <table className="table-modern">
                                <SortableTableHead 
                                    requestSort={requestSortHealth}
                                    sortConfig={sortConfigHealth}
                                    filterState={healthFilters}
                                    onFilterChange={handleHealthFilterChange}
                                    getUniqueValues={getHealthUniqueValues}
                                    columns={[
                                        { key: "reg", label: "Vehicle", sortable: true },
                                        { key: "status", label: "Status", sortable: true },
                                        { key: "rulePct", label: "Wear level", sortable: true },
                                        { key: "kmSince", label: "Km Since Change", sortable: true, align: "right" },
                                        { key: "remaining", label: "Remaining Km", sortable: true, align: "right" },
                                        { key: "odom", label: "Current Odom", sortable: true, align: "right" },
                                        { key: "actions", label: "Actions", sortable: false, align: "right" }
                                    ]}
                                />
                                <tbody>
                                    {sortedHealthItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                                                <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                                <div style={{ fontWeight: 600 }}>No vehicles found matching your filters.</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedHealthItems.map(d => (
                                            <tr key={d.id} className="hover-scale">
                                                <td className="sticky-col" title={d.reg}>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{d.reg}</div>
                                                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{d.make} · {d.type}</div>
                                                </td>
                                                <td className="status-col" title={d.status}>
                                                    <Badge status={d.status === "OK" ? "Active" : d.status === "Due Soon" ? "Due Soon" : "Overdue"}>
                                                        {d.status}
                                                    </Badge>
                                                </td>
                                                <td title={`${fmtN(d.rulePct, 0)}% wear`}>
                                                    <div style={{ width: 120 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, fontWeight: 700 }}>
                                                            <span>{fmtN(d.rulePct, 0)}%</span>
                                                        </div>
                                                        <div style={{ height: 6, borderRadius: 10, background: "var(--surface-subtle)", overflow: "hidden" }}>
                                                            <div style={{ 
                                                                width: `${d.rulePct}%`, 
                                                                height: "100%", 
                                                                background: d.status === "Overdue" ? "#ef4444" : d.status === "Due Soon" ? "#f59e0b" : "#10b981",
                                                                borderRadius: 10
                                                            }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }} title={`${d.kmSince.toLocaleString()} km`}>{d.kmSince.toLocaleString()} km</td>
                                                <td style={{ textAlign: "right", fontWeight: 700, color: d.remaining <= 0 ? "#ef4444" : "var(--text-secondary)" }} title={d.remaining <= 0 ? `${Math.abs(d.remaining).toLocaleString()} over` : `${d.remaining.toLocaleString()} left`}>
                                                    {d.remaining <= 0 ? `${Math.abs(d.remaining).toLocaleString()} over` : `${d.remaining.toLocaleString()} left`}
                                                </td>
                                                <td style={{ textAlign: "right", color: "var(--text-dim)" }} title={d.odom.toLocaleString()}>{d.odom.toLocaleString()}</td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openModal("truck", d.rawTruck)}>
                                                        Update
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20, marginBottom: 28 }}>
                        <Card accent="var(--brand-primary)" style={{ padding: 20, borderRadius: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>Filtered Tyre Spend</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalSpendFiltered)}</div>
                        </Card>
                        <Card accent="#10b981" style={{ padding: 20, borderRadius: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>Filtered Entries</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{sortedSpendItems.length}</div>
                        </Card>
                        <Card accent="#f59e0b" style={{ padding: 20, borderRadius: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>Avg per Change</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalSpendFiltered / (sortedSpendItems.length || 1))}</div>
                        </Card>
                    </div>

                    <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                            <SearchIcon size={18} color="var(--text-dim)" />
                            <input
                                type="search"
                                placeholder="Search spend records..."
                                value={searchTermSpend}
                                onChange={(e) => setSearchTermSpend(e.target.value)}
                                style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                            />
                        </div>
                        <div className="table-container">
                            <table className="table-modern">
                                <SortableTableHead 
                                    requestSort={requestSortSpend}
                                    sortConfig={sortConfigSpend}
                                    filterState={spendFilters}
                                    onFilterChange={handleSpendFilterChange}
                                    getUniqueValues={getSpendUniqueValues}
                                    columns={[
                                        { key: "date", label: "Date", sortable: true },
                                        { key: "vehicle", label: "Vehicle", sortable: true },
                                        { key: "desc", label: "Description", sortable: true },
                                        { key: "amountVal", label: "Amount", sortable: true, align: "right" }
                                    ]}
                                />
                                <tbody>
                                    {sortedSpendItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                                                <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                                <div style={{ fontWeight: 600 }}>No spend records found matching your filters.</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedSpendItems.map(e => (
                                            <tr key={e.id} className="hover-scale">
                                                <td className="sticky-col" title={fmtDate(e.date)}>{fmtDate(e.date)}</td>
                                                <td style={{ fontWeight: 800, color: "var(--brand-primary)" }} title={e.vehicle}>{e.vehicle}</td>
                                                <td style={{ color: "var(--text-secondary)", fontSize: 13 }} title={e.desc}>{e.desc}</td>
                                                <td style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }} title={fmt(e.amountVal)}>{fmt(e.amountVal)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
