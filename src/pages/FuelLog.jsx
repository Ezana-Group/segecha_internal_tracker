import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Droplets, 
    Fuel, 
    Truck, 
    TrendingUp, 
    Plus, 
    Calendar, 
    MapPin, 
    Image as ImageIcon,
    CheckCircle2,
    AlertCircle,
    Download,
    Trash2,
    Pencil,
    ArrowUpRight,
    ArrowDownRight,
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

    // Refine fuel for sorting/filtering
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

    // Efficiency Matrix Data
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

    return (
        <div className="page-shell">
            <PageHeader
                icon={Fuel}
                title="Fuel analytics"
                description="Consumption, cost, and efficiency by vehicle."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>
                            Export log
                        </Button>
                        <Button
                            variant="premium"
                            icon={Plus}
                            onClick={() =>
                                openModal("fuel", {
                                    date: new Date().toISOString().split("T")[0],
                                    pricePerL: DEFAULT_FUEL_PRICE || "",
                                })
                            }
                        >
                            Log fill-up
                        </Button>
                    </>
                }
            />

            {/* KPI Overview */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                {[
                    { label: "Filtered Expenditure", value: fmt(totalCostFiltered), icon: TrendingUp, color: "var(--brand-primary)", trend: "+4.2%", trendUp: false },
                    { label: "Filtered Volume", value: `${totalLitresFiltered.toLocaleString()} L`, icon: Droplets, color: "#0ea5e9", trend: "-1.8%", trendUp: true },
                    { label: "Avg Market Price", value: `KES ${avgPrice}`, icon: Fuel, color: "#a78bfa", trend: "Stable", trendUp: null }
                ].map((kpi, idx) => (
                    <Card key={idx} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: kpi.color }}>
                                <kpi.icon size={20} />
                            </div>
                            {kpi.trend !== null && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 8, background: kpi.trendUp === null ? "rgba(255,255,255,0.05)" : kpi.trendUp ? "#10b98110" : "#ef444410", color: kpi.trendUp === null ? "var(--text-muted)" : kpi.trendUp ? "#10b981" : "#ef4444", fontSize: 11, fontWeight: 700 }}>
                                    {kpi.trendUp !== null && (kpi.trendUp ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />)}
                                    {kpi.trend}
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{kpi.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{kpi.value}</div>
                    </Card>
                ))}
            </div>
            
            {/* Historical Log Filters (Premium Search Section) */}
            <div style={{ 
                display: "flex", 
                justifyContent: "flex-end", 
                alignItems: "center", 
                marginBottom: 24, 
                flexWrap: "wrap", 
                gap: 16,
                background: "var(--bg-card)",
                padding: "16px 20px",
                borderRadius: 20,
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(12px)"
            }}>
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ position: "relative" }}>
                        <Truck style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                        <select 
                            className="input-premium" 
                            style={{ width: 170, fontSize: 13, height: 48, padding: "0 12px 0 34px", borderRadius: 14, background: "var(--surface-subtle)" }}
                            value={filterTruck} 
                            onChange={e => setFilterTruck(e.target.value)}
                        >
                            <option value="ALL">All Vehicles</option>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
                <button
                    style={{ padding: '12px 16px', border: 'none', borderBottom: activeTab === 'all' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'all' ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: activeTab === 'all' ? 800 : 600, background: 'transparent', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('all')}
                >
                    All Fuel Logs
                </button>
                <button
                    style={{ padding: '12px 16px', border: 'none', borderBottom: activeTab === 'efficiency' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'efficiency' ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: activeTab === 'efficiency' ? 800 : 600, background: 'transparent', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('efficiency')}
                >
                    Fuel Efficiency Matrix
                </button>
                <button
                    style={{ padding: '12px 16px', border: 'none', borderBottom: activeTab === 'awaiting' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'awaiting' ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: activeTab === 'awaiting' ? 800 : 600, background: 'transparent', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('awaiting')}
                >
                    Awaiting Verification
                    {pendingVerifications?.filter(v => v._itemType === 'fuel').length > 0 && (
                        <span style={{ background: '#8b5cf6', color: '#fff', padding: '2px 6px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                            {pendingVerifications.filter(v => v._itemType === 'fuel').length}
                        </span>
                    )}
                </button>
            </div>

            {/* Tables */}
            {activeTab === 'efficiency' ? (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead 
                                requestSort={requestSortEff}
                                sortConfig={sortConfigEff}
                                filterState={effFilters}
                                onFilterChange={handleEffFilterChange}
                                getUniqueValues={getEffUniqueValues}
                                columns={[
                                    { key: "_reg", label: "Vehicle Detail", sortable: true },
                                    { key: "_spent", label: "Fuel Spent (KES)", sortable: true, align: "right" },
                                    { key: "_dist", label: "Total Distance (KM)", sortable: true, align: "right" },
                                    { key: "_eff", label: "Efficiency (KM/Litre)", sortable: true, align: "right" }
                                ]}
                            />
                            <tbody>
                                {sortedEff.length > 0 ? (
                                    sortedEff.map(t => {
                                        const effColor = t._eff > 3.5 ? "#10b981" : t._eff > 2.8 ? "#f59e0b" : "#ef4444";
                                        return (
                                            <tr key={t.id} onClick={() => navigate(`/fleet/${t.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                                <td className="sticky-col" title={t.reg}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                            <Truck size={18} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{t.reg}</div>
                                                            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{t.make} {t.model}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: "right", fontWeight: 800 }} title={fmt(t._spent)}>{fmt(t._spent)}</td>
                                                <td style={{ textAlign: "right", fontWeight: 800 }} title={`${t._dist?.toLocaleString()} KM`}>{t._dist?.toLocaleString()} KM</td>
                                                <td style={{ textAlign: "right" }} title={fmtN(t._eff, 2)}>
                                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                                        <div style={{ fontSize: 16, fontWeight: 900, color: effColor }}>{fmtN(t._eff, 2)}</div>
                                                        <div style={{ height: 4, width: 60, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                                                            <div style={{ height: "100%", width: `${Math.min((t._eff / 5) * 100, 100)}%`, background: effColor }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)", fontStyle: "italic" }}>
                                            No vehicles match your filters
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                        <SearchIcon size={18} color="var(--text-dim)" />
                        <input
                            type="search"
                            placeholder="Search fuel log..."
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
                                    { key: "uId", label: "Fuel ID", sortable: true },
                                    { key: "date", label: "Refuel Date", sortable: true },
                                    { key: "station", label: "Station", sortable: true },
                                    { key: "_vehicle", label: "Vehicle Detail", sortable: true },
                                    { key: "litres", label: "Quantity (L)", sortable: true, align: "right" },
                                    { key: "pricePerL", label: "Unit Price", sortable: true, align: "right" },
                                    { key: "_total", label: "Total Cost", sortable: true, align: "right" },
                                    { key: "compliance", label: "Compliance", sortable: false },
                                    { key: "status", label: "Status", sortable: true },
                                    { key: "actions", label: "Actions", sortable: false, align: "right" }
                                ]}
                            />
                            <tbody>
                                {activeTab === 'awaiting' ? (
                                    pendingVerifications?.filter(v => v._itemType === 'fuel').length === 0 ? (
                                        <tr>
                                            <td colSpan="11" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                                <div style={{ marginBottom: 16 }}><CheckCircle2 size={48} opacity={0.2} color="#10b981" /></div>
                                                <div style={{ fontWeight: 600 }}>No fuel logs awaiting verification.</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingVerifications?.filter(v => v._itemType === 'fuel').map(v => (
                                            <tr key={v.id} onClick={() => setVerifyModal(v)} style={{ cursor: "pointer", background: "rgba(139, 92, 246, 0.02)" }} className="hover-scale">
                                                <td className="sticky-col" title={v.uId || v.id.slice(0, 8).toUpperCase()}>
                                                    <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                        {v.uId || v.id.slice(0, 8).toUpperCase()}
                                                    </div>
                                                </td>
                                                <td title={fmtDate(v.date)}>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{fmtDate(v.date)}</div>
                                                </td>
                                                <td title={v.station}>
                                                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <MapPin size={12} color="var(--brand-primary)" /> {v.station}
                                                    </div>
                                                </td>
                                                <td title={truckReg(v.truck)}>
                                                    <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13 }}>{truckReg(v.truck)}</div>
                                                </td>
                                                <td title={v.litres?.toLocaleString()}>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{v.litres?.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>L</span></div>
                                                </td>
                                                <td title="-">
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>-</div>
                                                </td>
                                                <td title={fmt(v.amount)}>
                                                    <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 14 }}>{fmt(v.amount)}</div>
                                                </td>
                                                <td title="Compliance Photos">
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        {['photoPump', 'photoReceipt', 'photoOdom'].map(k => (
                                                            <div key={k} style={{ 
                                                                width: 14, height: 14, borderRadius: "50%", 
                                                                background: v[k] ? "#10b981" : "rgba(15,23,42,0.1)",
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                {v[k] && <CheckCircle2 size={8} color="#fff" />}
                                                            </div>
                                                        ))}
                                                    </div>
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
                                        ))
                                    )
                                ) : sortedFuel.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)", fontStyle: "italic" }}>
                                            No results match your filters
                                        </td>
                                    </tr>
                                ) : (
                                    sortedFuel.map(f => (
                                        <tr key={f.id} onClick={() => openModal("fuel", f)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td className="sticky-col" title={f.uId || f.id.slice(0, 8).toUpperCase()}>
                                                <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                    {f.uId || f.id.slice(0, 8).toUpperCase()}
                                                </div>
                                            </td>
                                            <td title={fmtDate(f.date)}>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{fmtDate(f.date)}</div>
                                            </td>
                                            <td title={f.station}>
                                                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                    <MapPin size={12} color="var(--brand-primary)" /> {f.station}
                                                </div>
                                            </td>
                                            <td title={`${truckReg(f.truck)} | ${(f.odom || 0).toLocaleString()} KM`}>
                                                <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13 }}>{truckReg(f.truck)}</div>
                                                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, fontWeight: 600 }}>
                                                    {(f.odom || 0).toLocaleString()} KM Reading
                                                </div>
                                            </td>
                                            <td title={f.litres.toLocaleString()}>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{f.litres.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>L</span></div>
                                            </td>
                                            <td title={`KES ${f.pricePerL}`}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>KES {f.pricePerL}</div>
                                            </td>
                                            <td title={fmt(f.litres * f.pricePerL)}>
                                                <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 14 }}>{fmt(f.litres * f.pricePerL)}</div>
                                            </td>
                                            <td title="Compliance Photos">
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {['photoPump', 'photoReceipt', 'photoOdom'].map(k => (
                                                        f[k] ? (
                                                            <div key={k} style={{ 
                                                                width: 28, 
                                                                height: 28, 
                                                                borderRadius: 6, 
                                                                background: `url(${f[k]}) center/cover no-repeat`, 
                                                                border: "1px solid var(--border-subtle)",
                                                                cursor: "pointer"
                                                            }} title={`View ${k.replace('photo', '')}`} onClick={(e) => { e.stopPropagation(); window.open(f[k]); }} />
                                                        ) : <div key={k} style={{ 
                                                            width: 28, 
                                                            height: 28, 
                                                            borderRadius: 6, 
                                                            background: "rgba(255,255,255,0.03)", 
                                                            border: "1px dashed var(--border-dim)", 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'center', 
                                                            color: "var(--text-dim)" 
                                                        }}>
                                                            <ImageIcon size={12} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="status-col" title={f._pendingApproval ? "Pending Review" : ((!f.photoPump || !f.photoReceipt || !f.photoOdom) ? "Missing Docs" : "Verified")}>
                                                {f._pendingApproval ? <Badge status="Warning" text="Pending Review" /> : (
                                                    (!f.photoPump || !f.photoReceipt || !f.photoOdom) ? (
                                                        <Badge status="Warning" text="Missing Docs" />
                                                    ) : (
                                                        <Badge status="Active" text="Verified" />
                                                    )
                                                )}
                                            </td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for fuel entry ${f.id}`}
                                                    items={[
                                                        ...(f._pendingApproval ? [{
                                                            id: "verify",
                                                            label: "Verify fuel log",
                                                            icon: CheckCircle2,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                setVerifyModal({ ...f, _itemType: 'fuel' });
                                                            },
                                                        }] : []),
                                                        {
                                                            id: "edit",
                                                            label: "Edit entry",
                                                            icon: Pencil,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                openModal("fuel", f);
                                                            },
                                                        },
                                                        {
                                                            id: "delete",
                                                            label: "Delete",
                                                            icon: Trash2,
                                                            danger: true,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                delItem("fuel", f.id, f.station + " " + f.date);
                                                            },
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
