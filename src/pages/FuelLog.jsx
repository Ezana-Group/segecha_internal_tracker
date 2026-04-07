import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Droplets,
    Fuel,
    Truck,
    TrendingUp,
    Plus,
    MapPin,
    Image as ImageIcon,
    CheckCircle2,
    Download,
    Trash2,
    Pencil,
    ArrowUpRight,
    Search as SearchIcon
} from "lucide-react";
import { fmt, fmtN, fmtDate } from "../utils/formatters";
import { DEFAULT_FUEL_PRICE } from "../constants/nav";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function FuelLog({ data, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, filterTruck, setFilterTruck, truckReg, truckStats, setVerifyModal, pendingVerifications, verifySubmission }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');

    const filtered = (filterTruck === "ALL" ? data.fuel : data.fuel.filter(f => f.truck === filterTruck));

    const refinedFuel = filtered.map(f => ({
        ...f,
        _vehicle: truckReg(f.truck),
        _total: f.litres * f.pricePerL
    }));

    const {
        filteredRows: sortedFuel,
        setSort: requestSortFuel,
        sortState: sortConfigFuel,
        filterState: fuelFilters,
        applyFilter: handleFuelFilterChange,
        getUniqueValues: getFuelUniqueValues,
        isFiltered: isFuelFiltered,
        isSorted: isFuelSorted,
        searchTerm: searchTermFuel,
        setSearchTerm: setSearchTermFuel
    } = useTableFilter(refinedFuel, {
        namespace: "fuel",
        initialSort: { col: "date", dir: "desc" },
        searchColumns: ["_vehicle", "station", "journey"]
    });

    const totalLitresFiltered = sortedFuel.reduce((s, f) => s + (f.litres || 0), 0);
    const totalCostFiltered = sortedFuel.reduce((s, f) => s + (f._total || 0), 0);

    const efficiencyData = data.trucks.filter(t => filterTruck === "ALL" || t.id === filterTruck).map(t => {
        const st = truckStats(t.id);
        return {
            ...t,
            _reg: t.reg,
            _spent: st.fuelCost,
            _dist: st.totalKm,
            _eff: st.kmPerL
        };
    });

    const {
        filteredRows: sortedEff,
        setSort: requestSortEff,
        sortState: sortConfigEff,
        filterState: effFilters,
        applyFilter: handleEffFilterChange,
        getUniqueValues: getEffUniqueValues,
        isFiltered: isEffFiltered,
        isSorted: isEffSorted
    } = useTableFilter(efficiencyData, { namespace: "eff", initialSort: { col: "_eff", dir: "desc" } });

    const totalL = filtered.reduce((s, f) => s + f.litres, 0);
    const totalCost = filtered.reduce((s, f) => s + f.litres * f.pricePerL, 0);
    const avgPrice = totalL > 0 ? (totalCost / totalL).toFixed(1) : 0;
    const avgKmL = (() => {
        const trucks = data.trucks.filter(t => filterTruck === "ALL" || t.id === filterTruck);
        const totalKm = trucks.reduce((s, t) => s + (truckStats(t.id).totalKm || 0), 0);
        return totalL > 0 ? (totalKm / totalL).toFixed(2) : "0.00";
    })();
    const costPerKm = (() => {
        const trucks = data.trucks.filter(t => filterTruck === "ALL" || t.id === filterTruck);
        const totalKm = trucks.reduce((s, t) => s + (truckStats(t.id).totalKm || 0), 0);
        return totalKm > 0 ? (totalCost / totalKm).toFixed(1) : "0.0";
    })();

    const tabs = [
        { id: 'all', label: 'All Fuel Logs' },
        { id: 'efficiency', label: 'Efficiency Matrix' },
        {
            id: 'awaiting',
            label: 'Awaiting Verification',
            badge: pendingVerifications?.filter(v => v._itemType === 'fuel').length
        }
    ];

    return (
        <div className="page-shell">
            <PageHeader
                icon={Fuel}
                title="Fuel Log"
                description="Consumption, cost, and efficiency by vehicle."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>Export log</Button>
                        <Button
                            variant="premium"
                            icon={Plus}
                            onClick={() => openModal("fuel", {
                                date: new Date().toISOString().split("T")[0],
                                pricePerL: DEFAULT_FUEL_PRICE || "",
                            })}
                        >
                            Add Entry
                        </Button>
                    </>
                }
            />

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                    { label: "Total Litres", value: `${totalLitresFiltered.toLocaleString()} L`, icon: Droplets, color: "#0ea5e9" },
                    { label: "Total Cost", value: fmt(totalCostFiltered), icon: TrendingUp, color: "var(--brand-primary)" },
                    { label: "Avg km/L", value: `${avgKmL} km/L`, icon: ArrowUpRight, color: "#10b981" },
                    { label: "Cost per km", value: `KES ${costPerKm}`, icon: Fuel, color: "#a78bfa" },
                ].map((kpi, idx) => (
                    <Card key={idx} style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${kpi.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: kpi.color, marginBottom: 12 }}>
                            <kpi.icon size={18} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{kpi.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{kpi.value}</div>
                    </Card>
                ))}
            </div>

            {/* Truck Filter + Tabs */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 0, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', flex: 1 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '12px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 800 : 600,
                                color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--text-dim)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8
                            }}
                        >
                            {tab.label}
                            {tab.badge > 0 && (
                                <span style={{ background: '#8b5cf6', color: '#fff', padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div style={{ position: "relative", marginBottom: 1 }}>
                    <Truck style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                    <select
                        className="input-premium"
                        style={{ width: 160, fontSize: 13, height: 40, padding: "0 10px 0 30px", borderRadius: 12, background: "var(--surface-subtle)" }}
                        value={filterTruck}
                        onChange={e => setFilterTruck(e.target.value)}
                    >
                        <option value="ALL">All Vehicles</option>
                        {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                </div>
            </div>

            {/* Efficiency Matrix Tab */}
            {activeTab === 'efficiency' ? (
                <Card style={{ padding: 0, overflow: "hidden", marginTop: 20 }}>
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead
                                requestSort={requestSortEff}
                                sortConfig={sortConfigEff}
                                filterState={effFilters}
                                onFilterChange={handleEffFilterChange}
                                getUniqueValues={getEffUniqueValues}
                                columns={[
                                    { key: "_reg", label: "Vehicle", sortable: true },
                                    { key: "_spent", label: "Fuel Spent", sortable: true, align: "right" },
                                    { key: "_dist", label: "Distance (KM)", sortable: true, align: "right" },
                                    { key: "_eff", label: "km/L", sortable: true, align: "right" }
                                ]}
                            />
                            <tbody>
                                {sortedEff.length > 0 ? sortedEff.map(t => {
                                    const effColor = t._eff > 3.5 ? "#10b981" : t._eff > 2.8 ? "#f59e0b" : "#ef4444";
                                    return (
                                        <tr key={t.id} onClick={() => navigate(`/fleet/${t.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td className="sticky-col">
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <Truck size={16} color="var(--text-dim)" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{t.reg}</div>
                                                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.make} {t.model}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 800 }}>{fmt(t._spent)}</td>
                                            <td style={{ textAlign: "right", fontWeight: 700 }}>{t._dist?.toLocaleString()} km</td>
                                            <td style={{ textAlign: "right" }}>
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                                    <span style={{ fontSize: 16, fontWeight: 900, color: effColor }}>{fmtN(t._eff, 2)}</span>
                                                    <div style={{ height: 4, width: 56, background: "var(--surface-subtle)", borderRadius: 2, overflow: "hidden" }}>
                                                        <div style={{ height: "100%", width: `${Math.min((t._eff / 5) * 100, 100)}%`, background: effColor }} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)" }}>No vehicles match your filters</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <Card style={{ padding: 0, overflow: "hidden", marginTop: 20 }}>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                        <SearchIcon size={16} color="var(--text-dim)" />
                        <input
                            type="search"
                            placeholder="Search by vehicle, station..."
                            value={searchTermFuel}
                            onChange={(e) => setSearchTermFuel(e.target.value)}
                            style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                        />
                    </div>
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead
                                requestSort={requestSortFuel}
                                sortConfig={sortConfigFuel}
                                filterState={fuelFilters}
                                onFilterChange={handleFuelFilterChange}
                                getUniqueValues={getFuelUniqueValues}
                                columns={[
                                    { key: "date", label: "Date", sortable: true },
                                    { key: "_vehicle", label: "Truck", sortable: true },
                                    { key: "station", label: "Station", sortable: true },
                                    { key: "litres", label: "Litres", sortable: true, align: "right" },
                                    { key: "pricePerL", label: "Price/L", sortable: true, align: "right" },
                                    { key: "_total", label: "Total Cost", sortable: true, align: "right" },
                                    { key: "odom", label: "KM Reading", sortable: true, align: "right" },
                                    { key: "compliance", label: "Docs", sortable: false },
                                    { key: "status", label: "Status", sortable: true },
                                    { key: "actions", label: "", sortable: false, align: "right" }
                                ]}
                            />
                            <tbody>
                                {activeTab === 'awaiting' ? (
                                    pendingVerifications?.filter(v => v._itemType === 'fuel').length === 0 ? (
                                        <tr>
                                            <td colSpan="10" style={{ textAlign: "center", padding: 64, color: "var(--text-dim)" }}>
                                                <div style={{ marginBottom: 12 }}><CheckCircle2 size={40} opacity={0.2} color="#10b981" /></div>
                                                <div style={{ fontWeight: 600 }}>No fuel logs awaiting verification.</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingVerifications?.filter(v => v._itemType === 'fuel').map(v => (
                                            <tr key={v.id} onClick={() => setVerifyModal(v)} style={{ cursor: "pointer" }} className="hover-scale">
                                                <td className="sticky-col">{fmtDate(v.date)}</td>
                                                <td style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{truckReg(v.truck)}</td>
                                                <td style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><MapPin size={12} color="var(--brand-primary)" />{v.station}</td>
                                                <td style={{ textAlign: "right", fontWeight: 800 }}>{v.litres?.toLocaleString()} L</td>
                                                <td style={{ textAlign: "right", color: "var(--text-dim)" }}>—</td>
                                                <td style={{ textAlign: "right", fontWeight: 900 }}>{fmt(v.amount)}</td>
                                                <td style={{ textAlign: "right", color: "var(--text-dim)" }}>—</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 5 }}>
                                                        {['photoPump', 'photoReceipt', 'photoOdom'].map(k => (
                                                            <div key={k} style={{ width: 12, height: 12, borderRadius: "50%", background: v[k] ? "#10b981" : "var(--surface-subtle)" }} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td><Badge status="Warning" text="Pending Review" /></td>
                                                <td style={{ textAlign: "right" }}>
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); setVerifyModal(v); }}>Review</Button>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                ) : sortedFuel.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)" }}>No results match your filters</td>
                                    </tr>
                                ) : (
                                    sortedFuel.map(f => (
                                        <tr key={f.id} onClick={() => openModal("fuel", f)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td className="sticky-col" style={{ fontWeight: 700 }}>{fmtDate(f.date)}</td>
                                            <td>
                                                <div style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{truckReg(f.truck)}</div>
                                                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                                                    {f.odom > 0 ? `${f.odom.toLocaleString()} km` : 'No odom'}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
                                                    <MapPin size={12} color="var(--brand-primary)" />{f.station}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 800 }}>
                                                {f.litres.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>L</span>
                                            </td>
                                            <td style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                                                KES {f.pricePerL}
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 900 }}>{fmt(f.litres * f.pricePerL)}</td>
                                            <td style={{ textAlign: "right", color: "var(--text-dim)", fontSize: 13 }}>
                                                {f.odom > 0 ? `${f.odom.toLocaleString()} km` : '—'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 5 }}>
                                                    {['photoPump', 'photoReceipt', 'photoOdom'].map(k => (
                                                        f[k] ? (
                                                            <div key={k} style={{ width: 26, height: 26, borderRadius: 6, background: `url(${f[k]}) center/cover no-repeat`, border: "1px solid var(--border-subtle)", cursor: "pointer" }}
                                                                onClick={(e) => { e.stopPropagation(); window.open(f[k]); }} />
                                                        ) : (
                                                            <div key={k} style={{ width: 26, height: 26, borderRadius: 6, background: "var(--surface-subtle)", border: "1px dashed var(--border-dim)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--text-dim)" }}>
                                                                <ImageIcon size={11} />
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="status-col">
                                                {f._pendingApproval ? <Badge status="Warning" text="Pending" /> :
                                                    (!f.photoPump || !f.photoReceipt || !f.photoOdom) ?
                                                        <Badge status="Warning" text="Missing Docs" /> :
                                                        <Badge status="Active" text="Verified" />
                                                }
                                            </td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for fuel entry ${f.id}`}
                                                    items={[
                                                        ...(f._pendingApproval ? [{
                                                            id: "verify", label: "Verify", icon: CheckCircle2,
                                                            onClick: (e) => { e.stopPropagation(); setVerifyModal({ ...f, _itemType: 'fuel' }); },
                                                        }] : []),
                                                        {
                                                            id: "edit", label: "Edit entry", icon: Pencil,
                                                            onClick: (e) => { e.stopPropagation(); openModal("fuel", f); },
                                                        },
                                                        {
                                                            id: "delete", label: "Delete", icon: Trash2, danger: true,
                                                            onClick: (e) => { e.stopPropagation(); delItem("fuel", f.id, f.station + " " + f.date); },
                                                        },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
