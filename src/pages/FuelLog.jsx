import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Droplets, 
    Fuel, 
    Truck, 
    History, 
    TrendingUp, 
    Zap, 
    Plus, 
    Calendar, 
    MapPin, 
    Image as ImageIcon,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Search as SearchIcon,
    Download,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Trash2,
    Pencil,
} from "lucide-react";
import { fmt, fmtN, fmtDate } from "../utils/formatters";
import { validators } from "../utils/validators";
import { DEFAULT_FUEL_PRICE } from "../constants/nav";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";

export function FuelLog({ data, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, filterTruck, setFilterTruck, truckReg, truckStats, setVerifyModal, pendingVerifications, verifySubmission }) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [panelTruckId, setPanelTruckId] = useState(null);
    const [activeTab, setActiveTab] = useState('all');

    const filtered = (filterTruck === "ALL" ? data.fuel : data.fuel.filter(f => f.truck === filterTruck))
        .filter(f =>
            f.station?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            truckReg(f.truck)?.toLowerCase().includes(searchTerm.toLowerCase())
        );

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
                    { label: "Total Expenditure", value: fmt(totalCost), icon: TrendingUp, color: "var(--brand-primary)", trend: "+4.2%", trendUp: false },
                    { label: "Volume Consumed", value: `${totalL.toLocaleString()} L`, icon: Droplets, color: "#0ea5e9", trend: "-1.8%", trendUp: true },
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
            
            {/* Pending verifications are now handled inside the table tabs */}

            {/* Historical Log Filters (Premium Search Section) */}
            <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
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
                <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
                    <SearchIcon style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--brand-primary)" }} size={18} />
                    <input 
                        className="input-modern input-modern--filter"
                        placeholder="Search stations, vehicles or ID..." 
                        style={{ 
                            paddingLeft: 48, 
                            height: 48, 
                            fontSize: 14, 
                            borderRadius: 14,
                            background: "var(--surface-subtle)",
                            border: "1px solid transparent"
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
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
                    <Button variant="ghost" style={{ borderRadius: 14, height: 48 }} icon={Calendar}>Monthly</Button>
                </div>
            </div>
            {/* Vehicle Efficiency Matrix */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Fleet Efficiency Matrix</h3>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
                    {data.trucks.filter(t => filterTruck === "ALL" || t.id === filterTruck).slice(0, 6).map(t => {
                        const st = truckStats(t.id);
                        const efficiencyColor = st.kmPerL > 3.5 ? "#10b981" : st.kmPerL > 2.8 ? "#f59e0b" : "#ef4444";
                        return (
                            <Card key={t.id} style={{ padding: 20, border: "1px solid var(--border-subtle)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>
                                            <Truck size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{t.reg}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>{t.model}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: efficiencyColor }}>{fmtN(st.kmPerL, 2)}</div>
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>KM / LITRE</div>
                                    </div>
                                </div>
                                
                                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.min((st.kmPerL / 5) * 100, 100)}%`, background: efficiencyColor, borderRadius: 3 }} />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Fuel Spent</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{fmt(st.fuelCost)}</div>
                                    </div>
                                    <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Total Distance</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{st.totalKm.toLocaleString()} KM</div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Historical Log */}

            <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
                <button
                    style={{ padding: '12px 16px', border: 'none', borderBottom: activeTab === 'all' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'all' ? 'var(--brand-primary)' : 'var(--text-dim)', fontWeight: activeTab === 'all' ? 800 : 600, background: 'transparent', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' }}
                    onClick={() => setActiveTab('all')}
                >
                    All Fuel Logs
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

            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Fuel ID</th>
                                <th>Refuel Date</th>
                                <th>Station</th>
                                <th>Vehicle Detail</th>
                                <th>Quantity (L)</th>
                                <th>Unit Price</th>
                                <th>Total Cost</th>
                                <th>Compliance</th>
                                <th>Status</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
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
                                            <td>
                                                <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                    {v.uId || v.id.slice(0, 8).toUpperCase()}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{fmtDate(v.date)}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                    <MapPin size={12} color="var(--brand-primary)" /> {v.station}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13 }}>{truckReg(v.truck)}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{v.litres?.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>L</span></div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>-</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 14 }}>{fmt(v.amount)}</div>
                                            </td>
                                            <td>
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
                                            <td>
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
                            ) : (
                                filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan="11" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No fuel entries found for the current selection.</div>
                                        </td>
                                    </tr>
                            ) : filtered.sort((a, b) => b.date.localeCompare(a.date)).map(f => (
                                <tr key={f.id} onClick={() => openModal("fuel", f)} style={{ cursor: "pointer" }} className="hover-scale">
                                    <td>
                                        <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                            {f.uId || f.id.slice(0, 8).toUpperCase()}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{fmtDate(f.date)}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                            <MapPin size={12} color="var(--brand-primary)" /> {f.station}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13 }}>{truckReg(f.truck)}</div>
                                        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, fontWeight: 600 }}>
                                            {(f.odom || 0).toLocaleString()} KM Reading
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{f.litres.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>L</span></div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>KES {f.pricePerL}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 14 }}>{fmt(f.litres * f.pricePerL)}</div>
                                    </td>
                                    <td>
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
                                    <td>
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
        </div>
    );
}
