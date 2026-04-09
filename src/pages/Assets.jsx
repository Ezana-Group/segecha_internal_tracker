import React, { useState, useMemo } from "react";
import {
    Package,
    Plus,
    Search as SearchIcon,
    Pencil,
    Trash2,
    TrendingDown,
    AlertCircle,
    CheckCircle2,
    Truck,
    ChevronDown,
    ChevronUp,
    Calendar,
    Tag,
} from "lucide-react";
import { fmt, fmtDate, today } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

// ── Depreciation engine ────────────────────────────────────────────────────

/**
 * Returns { bookValue, totalDepreciated, monthlyDepreciation, isFullyDepreciated }
 * All values in KES. Works for both straight-line and reducing-balance methods.
 */
export function calcDepreciation(asset) {
    const cost = Number(asset.cost) || 0;
    const salvage = Math.max(0, Math.min(Number(asset.salvageValue) || 0, cost));
    const lifeYears = Math.max(1, Number(asset.usefulLifeYears) || 5);
    const method = asset.depreciationMethod || "straight-line";

    if (!asset.purchaseDate || cost === 0) {
        return { bookValue: cost, totalDepreciated: 0, monthlyDepreciation: 0, isFullyDepreciated: false, monthsElapsed: 0 };
    }

    const start = new Date(asset.purchaseDate);
    const now = new Date();
    const monthsElapsed = Math.max(0,
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth())
    );
    const lifeMonths = lifeYears * 12;

    let bookValue, totalDepreciated, monthlyDepreciation;

    if (method === "reducing-balance") {
        // Annual rate that brings cost → salvage over usefulLifeYears
        const annualRate = salvage > 0 && cost > 0
            ? 1 - Math.pow(salvage / cost, 1 / lifeYears)
            : 0.20; // default 20% p.a. if no salvage set
        const monthlyRate = annualRate / 12;
        const monthsToApply = Math.min(monthsElapsed, lifeMonths);
        bookValue = cost * Math.pow(1 - monthlyRate, monthsToApply);
        bookValue = Math.max(salvage, bookValue);
        totalDepreciated = cost - bookValue;
        // Monthly depreciation at current book value
        monthlyDepreciation = bookValue * monthlyRate;
    } else {
        // Straight-line
        const depreciableAmount = cost - salvage;
        monthlyDepreciation = depreciableAmount / lifeMonths;
        const monthsToApply = Math.min(monthsElapsed, lifeMonths);
        totalDepreciated = monthlyDepreciation * monthsToApply;
        bookValue = Math.max(salvage, cost - totalDepreciated);
    }

    const isFullyDepreciated = monthsElapsed >= lifeMonths;
    return {
        bookValue: Math.round(bookValue * 100) / 100,
        totalDepreciated: Math.round(totalDepreciated * 100) / 100,
        monthlyDepreciation: Math.round(monthlyDepreciation * 100) / 100,
        isFullyDepreciated,
        monthsElapsed,
    };
}

/** Build a year-by-year depreciation schedule table rows */
function buildSchedule(asset) {
    const cost = Number(asset.cost) || 0;
    const salvage = Math.max(0, Math.min(Number(asset.salvageValue) || 0, cost));
    const lifeYears = Math.max(1, Number(asset.usefulLifeYears) || 5);
    const method = asset.depreciationMethod || "straight-line";
    if (!cost) return [];

    const annualRateRB = salvage > 0 && cost > 0
        ? 1 - Math.pow(salvage / cost, 1 / lifeYears)
        : 0.20;

    const rows = [];
    let openingBV = cost;
    for (let yr = 1; yr <= lifeYears; yr++) {
        let depreciation;
        if (method === "reducing-balance") {
            depreciation = openingBV * annualRateRB;
        } else {
            depreciation = (cost - salvage) / lifeYears;
        }
        const closingBV = Math.max(salvage, openingBV - depreciation);
        rows.push({ yr, openingBV: Math.round(openingBV), depreciation: Math.round(depreciation), closingBV: Math.round(closingBV) });
        openingBV = closingBV;
    }
    return rows;
}

// ── Category colours ───────────────────────────────────────────────────────

const CAT_COLOR = {
    "Vehicle": "#f97316",
    "Heavy Equipment": "#8b5cf6",
    "Workshop Equipment": "#f59e0b",
    "Fuel Infrastructure": "#ef4444",
    "Technology": "#0ea5e9",
    "Office Furniture & Fixtures": "#10b981",
    "Communication Equipment": "#6366f1",
    "Power Equipment": "#ec4899",
    "Land & Buildings": "#14b8a6",
    "Other": "#6b7280",
};

function catColor(cat) { return CAT_COLOR[cat] || "#6b7280"; }

// ── Detail Side Panel ──────────────────────────────────────────────────────

function AssetPanel({ asset, truckReg, onClose, openModal, delItem }) {
    const dep = calcDepreciation(asset);
    const pct = asset.cost > 0 ? Math.min(100, (dep.totalDepreciated / asset.cost) * 100) : 0;
    const schedule = buildSchedule(asset);
    const [showSched, setShowSched] = useState(false);
    const color = catColor(asset.category);

    return (
        <div style={{
            position: "fixed", top: 0, right: 0, width: "min(460px, 100vw)",
            height: "100%", maxHeight: "100dvh", background: "var(--bg-main)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.2)", borderLeft: "1px solid var(--border-subtle)",
            padding: "max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) 28px",
            overflowY: "auto", WebkitOverflowScrolling: "touch", zIndex: 1001, boxSizing: "border-box"
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                        {asset.category}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>{asset.name}</h2>
                    {asset.supplier && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Supplier: {asset.supplier}</div>}
                </div>
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </div>

            {/* Book value hero */}
            <div style={{ padding: 20, background: dep.isFullyDepreciated ? "rgba(16,185,129,0.07)" : `${color}0d`, borderRadius: 16, border: `1px solid ${color}25`, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Current Book Value
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: dep.isFullyDepreciated ? "#10b981" : color }}>{fmt(dep.bookValue)}</div>
                <div style={{ marginTop: 10, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{pct.toFixed(1)}% depreciated</span>
                    {dep.isFullyDepreciated
                        ? <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>Fully depreciated</span>
                        : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(dep.monthsElapsed / 12).toFixed(1)} of {asset.usefulLifeYears} yrs</span>
                    }
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                    { label: "Purchase Cost", value: fmt(asset.cost), sub: fmtDate(asset.purchaseDate) },
                    { label: "Salvage Value", value: fmt(asset.salvageValue), sub: "at end of life" },
                    { label: "Monthly Depreciation", value: fmt(dep.monthlyDepreciation), sub: asset.depreciationMethod },
                    { label: "Total Depreciated", value: fmt(dep.totalDepreciated), sub: `${dep.monthsElapsed} months elapsed` },
                ].map(({ label, value, sub }) => (
                    <div key={label} style={{ padding: 14, background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{value}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
                    </div>
                ))}
            </div>

            {/* Linked vehicle */}
            {asset.linkedTruckId && (
                <div style={{ padding: 14, background: "rgba(249,115,22,0.06)", borderRadius: 12, border: "1px solid rgba(249,115,22,0.15)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <Truck size={16} color="var(--brand-primary)" />
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700 }}>LINKED VEHICLE</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{truckReg(asset.linkedTruckId)}</div>
                    </div>
                </div>
            )}

            {/* Notes */}
            {asset.notes && (
                <div style={{ padding: 14, background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>NOTES</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{asset.notes}</div>
                </div>
            )}

            {/* Depreciation schedule toggle */}
            <button
                onClick={() => setShowSched(s => !s)}
                style={{ width: "100%", padding: "11px 14px", border: "1px solid var(--border-subtle)", borderRadius: 10, background: "var(--surface-subtle)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: showSched ? 0 : 16 }}
            >
                <span><TrendingDown size={14} style={{ marginRight: 8, verticalAlign: "middle" }} />Depreciation Schedule</span>
                {showSched ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showSched && (
                <div style={{ border: "1px solid var(--border-subtle)", borderTop: "none", borderRadius: "0 0 10px 10px", marginBottom: 16, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: "var(--surface-subtle)" }}>
                                {["Year", "Opening BV", "Depreciation", "Closing BV"].map(h => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Year" ? "left" : "right", fontWeight: 700, color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {schedule.map((r, i) => (
                                <tr key={r.yr} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "transparent" : "var(--surface-subtle)" }}>
                                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-primary)" }}>Year {r.yr}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }}>{fmt(r.openingBV)}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#ef4444" }}>-{fmt(r.depreciation)}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: r.closingBV <= (Number(asset.salvageValue) || 0) + 1 ? "#10b981" : "var(--text-primary)" }}>{fmt(r.closingBV)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
                <Button variant="secondary" icon={Pencil} onClick={() => { onClose(); openModal("asset", asset); }} style={{ flex: 1 }}>Edit</Button>
                <Button variant="danger" icon={Trash2} onClick={() => { delItem("assets", asset.id, asset.name); onClose(); }} style={{ flex: 1 }}>Delete</Button>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function Assets({ data, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, truckReg }) {
    const [panelAsset, setPanelAsset] = useState(null);

    const enriched = useMemo(() => (data.assets || []).map(a => ({
        ...a,
        _dep: calcDepreciation(a),
        _color: catColor(a.category),
    })), [data.assets]);

    const {
        filteredRows,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: assetFilters,
        applyFilter: handleFilterChange,
        getUniqueValues,
        searchTerm,
        setSearchTerm,
    } = useTableFilter(enriched, {
        namespace: "ast",
        initialSort: { col: "purchaseDate", dir: "desc" },
        searchColumns: ["name", "category", "supplier"],
    });

    // KPIs
    const totalCost = enriched.reduce((s, a) => s + a.cost, 0);
    const totalBookValue = enriched.reduce((s, a) => s + a._dep.bookValue, 0);
    const totalMonthlyDep = enriched.reduce((s, a) => s + a._dep.monthlyDepreciation, 0);

    return (
        <div className="page-shell">
            <PageHeader
                icon={Package}
                title="Assets & Capital"
                description="Company assets with automatic depreciation tracking."
                actions={
                    <Button variant="premium" icon={Plus} onClick={() => openModal("asset", { purchaseDate: today(), usefulLifeYears: 5, depreciationMethod: "straight-line", salvageValue: 0 })}>
                        Add Asset
                    </Button>
                }
            />

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <Card style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)", marginBottom: 12 }}>
                        <Package size={18} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total Purchase Cost</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalCost)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{enriched.length} asset{enriched.length !== 1 ? "s" : ""}</div>
                </Card>
                <Card style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: 12 }}>
                        <TrendingDown size={18} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Current Book Value</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalBookValue)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{totalCost > 0 ? ((totalBookValue / totalCost) * 100).toFixed(0) : 0}% of cost remaining</div>
                </Card>
                <Card style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", marginBottom: 12 }}>
                        <Calendar size={18} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Monthly Depreciation</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalMonthlyDep)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>across all active assets</div>
                </Card>
            </div>

            {/* Category filter chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <button
                    onClick={() => handleFilterChange("category", new Set())}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border-subtle)", background: !assetFilters.category?.size ? "var(--brand-primary)" : "var(--surface-subtle)", color: !assetFilters.category?.size ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                    All
                </button>
                {Object.keys(CAT_COLOR).map(cat => {
                    const isActive = assetFilters.category?.has(cat);
                    const color = catColor(cat);
                    const count = enriched.filter(a => a.category === cat).length;
                    if (count === 0) return null;
                    return (
                        <button key={cat}
                            onClick={() => handleFilterChange("category", new Set([cat]))}
                            style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${isActive ? color : "var(--border-subtle)"}`, background: isActive ? `${color}15` : "var(--surface-subtle)", color: isActive ? color : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                        >
                            <Tag size={11} />
                            {cat} <span style={{ opacity: 0.6 }}>({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 20 }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                    <SearchIcon size={16} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search assets..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                    />
                </div>
                <div className="table-container">
                    <table className="table-modern">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={assetFilters}
                            onFilterChange={handleFilterChange}
                            getUniqueValues={getUniqueValues}
                            columns={[
                                { key: "name", label: "Asset Name", sortable: true },
                                { key: "category", label: "Category", sortable: true },
                                { key: "purchaseDate", label: "Purchased", sortable: true },
                                { key: "cost", label: "Cost", sortable: true, align: "right" },
                                { key: "_dep.bookValue", label: "Book Value", sortable: false, align: "right" },
                                { key: "_dep.monthlyDepreciation", label: "Mo. Dep.", sortable: false, align: "right" },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "", sortable: false, align: "right" },
                            ]}
                        />
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: 64, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 12 }}><AlertCircle size={40} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No assets yet. Add your first capital asset above.</div>
                                    </td>
                                </tr>
                            ) : filteredRows.map(a => {
                                const dep = a._dep;
                                const pct = a.cost > 0 ? Math.min(100, (dep.totalDepreciated / a.cost) * 100) : 0;
                                return (
                                    <tr key={a.id} onClick={() => setPanelAsset(a)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td className="sticky-col">
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13 }}>{a.name}</div>
                                            {a.supplier && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.supplier}</div>}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: a._color, flexShrink: 0 }} />
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.category}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtDate(a.purchaseDate)}</td>
                                        <td style={{ fontWeight: 800, textAlign: "right" }}>{fmt(a.cost)}</td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 800, color: dep.isFullyDepreciated ? "#10b981" : "var(--text-primary)" }}>{fmt(dep.bookValue)}</div>
                                            <div style={{ marginTop: 4, height: 3, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden", minWidth: 60 }}>
                                                <div style={{ height: "100%", width: `${pct}%`, background: a._color, borderRadius: 2 }} />
                                            </div>
                                        </td>
                                        <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                                            {dep.isFullyDepreciated ? <span style={{ color: "#10b981", fontWeight: 700 }}>—</span> : fmt(dep.monthlyDepreciation)}
                                        </td>
                                        <td className="status-col">
                                            {dep.isFullyDepreciated
                                                ? <Badge status="Active" text="Fully Dep." />
                                                : <Badge status={a.status === "Active" ? "Active" : "Warning"} text={a.status} />
                                            }
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for ${a.name}`}
                                                items={[
                                                    { id: "view", label: "View details", icon: CheckCircle2, onClick: (ev) => { ev.stopPropagation(); setPanelAsset(a); } },
                                                    { id: "edit", label: "Edit asset", icon: Pencil, onClick: (ev) => { ev.stopPropagation(); openModal("asset", a); } },
                                                    { id: "delete", label: "Delete", icon: Trash2, danger: true, onClick: (ev) => { ev.stopPropagation(); delItem("assets", a.id, a.name); } },
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

            {/* Detail panel */}
            {panelAsset && (
                <AssetPanel
                    asset={panelAsset}
                    truckReg={truckReg}
                    onClose={() => setPanelAsset(null)}
                    openModal={openModal}
                    delItem={delItem}
                />
            )}
        </div>
    );
}
