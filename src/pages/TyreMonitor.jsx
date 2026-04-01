import React, { useState } from "react";
import { CircleDot, Gauge, AlertTriangle, Pencil, Search as SearchIcon, CreditCard, Activity, AlertCircle, Plus, ClipboardList } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { Field } from "../components/Field";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";
import { fmt, fmtN, fmtDate, today } from "../utils/formatters";

const DEFAULT_TYRE_LIMIT_KM = 60000;

const TYRE_ACTIONS = ["Replacement", "Rotation", "Inspection", "Puncture Repair", "Retread", "Swap"];
const TYRE_POSITIONS = [
    "Front Left", "Front Right",
    "Rear Left Inner", "Rear Left Outer",
    "Rear Right Inner", "Rear Right Outer",
    "Spare", "All Axles"
];

const EMPTY_LOG_FORM = {
    truck: "",
    action: "Replacement",
    position: "Front Left",
    serialNumber: "",
    brand: "",
    size: "",
    odom: "",
    cost: "",
    date: today(),
    notes: "",
};

export function TyreMonitor({ data, dark, openModal, tyreStatus, truckReg, logTyreChange, isMobile, S, T }) {
    const [activeTab, setActiveTab] = useState("health");
    const [logModal, setLogModal] = useState(false);
    const [logForm, setLogForm] = useState(EMPTY_LOG_FORM);
    const [logSubmitting, setLogSubmitting] = useState(false);

    // ── Health tab data ────────────────────────────────────────────────────
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

    // ── Spend tab data ─────────────────────────────────────────────────────
    const spendData = (data.expenses || [])
        .filter((e) => e.cat === "Tyre")
        .map(e => ({
            ...e,
            vehicle: truckReg(e.truck) || "Unknown",
            amountVal: Number(e.amount || 0)
        }));

    // ── Log tab data ───────────────────────────────────────────────────────
    const logData = (data.tyreLogs || []).map(l => ({
        ...l,
        vehicle: truckReg(l.truck) || "Unknown",
        costVal: Number(l.cost || 0),
    }));

    // ── Table filter hooks ─────────────────────────────────────────────────
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

    const {
        filteredRows: sortedLogItems,
        setSort: requestSortLog,
        sortState: sortConfigLog,
        filterState: logFilters,
        applyFilter: handleLogFilterChange,
        getUniqueValues: getLogUniqueValues,
        searchTerm: searchTermLog,
        setSearchTerm: setSearchTermLog
    } = useTableFilter(logData, {
        namespace: "tyrel",
        initialSort: { col: "date", dir: "desc" },
        searchColumns: ["vehicle", "position", "brand", "serialNumber", "action"]
    });

    const totalSpendFiltered = sortedSpendItems.reduce((sum, e) => sum + e.amountVal, 0);

    // ── Log form handlers ──────────────────────────────────────────────────
    const openLogModal = (truck = null) => {
        setLogForm({ ...EMPTY_LOG_FORM, truck: truck?.id || "", odom: truck ? String(truck.odom || "") : "" });
        setLogModal(true);
    };

    const patch = (field, val) => setLogForm(f => ({ ...f, [field]: val }));

    const submitLog = () => {
        if (!logForm.truck) { alert("Please select a vehicle."); return; }
        if (!logForm.action) { alert("Please select an action type."); return; }
        setLogSubmitting(true);
        try {
            logTyreChange(logForm);
            setLogModal(false);
            setLogForm(EMPTY_LOG_FORM);
        } finally {
            setLogSubmitting(false);
        }
    };

    // ── Shared modal form helpers ──────────────────────────────────────────
    // logForm works as the Field component's `form` object; patch() acts as setForm
    const setLogFormField = (updater) => setLogForm(f => typeof updater === 'function' ? updater(f) : updater);

    const tabs = [
        { id: "health", label: "Tyre Health",       icon: Activity      },
        { id: "log",    label: "Tyre Log",           icon: ClipboardList },
        { id: "spend",  label: "Replacement Spend",  icon: CreditCard    },
    ];

    return (
        <div className="page-shell">
            <PageHeader
                icon={CircleDot}
                title="Tyre management"
                description="Monitor fleet tyre health, log tyre events, and track replacement spend."
                actions={
                    <Button variant="primary" icon={Plus} onClick={() => openLogModal()}>
                        Log tyre entry
                    </Button>
                }
                belowTitle={
                    <div style={{ display: "flex", gap: 12, marginTop: 24, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    padding: "12px 20px", border: "none", background: "none",
                                    color: activeTab === tab.id ? "var(--brand-primary)" : "var(--text-dim)",
                                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                                    position: "relative", transition: "all 0.2s"
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

            {/* ── HEALTH TAB ── */}
            {activeTab === "health" && (
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
                            <input type="search" placeholder="Search tyre health..." value={searchTermHealth}
                                onChange={(e) => setSearchTermHealth(e.target.value)}
                                style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }} />
                        </div>
                        <div className="table-container">
                            <table className="table-modern">
                                <SortableTableHead
                                    requestSort={requestSortHealth} sortConfig={sortConfigHealth}
                                    filterState={healthFilters} onFilterChange={handleHealthFilterChange}
                                    getUniqueValues={getHealthUniqueValues}
                                    columns={[
                                        { key: "reg",       label: "Vehicle",       sortable: true },
                                        { key: "status",    label: "Status",        sortable: true },
                                        { key: "rulePct",   label: "Wear level",    sortable: true },
                                        { key: "kmSince",   label: "Km Since Change", sortable: true, align: "right" },
                                        { key: "remaining", label: "Remaining Km",  sortable: true, align: "right" },
                                        { key: "odom",      label: "Current Odom",  sortable: true, align: "right" },
                                        { key: "actions",   label: "Actions",       sortable: false, align: "right" }
                                    ]}
                                />
                                <tbody>
                                    {sortedHealthItems.length === 0 ? (
                                        <tr><td colSpan={7} style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No vehicles found.</div>
                                        </td></tr>
                                    ) : sortedHealthItems.map(d => (
                                        <tr key={d.id} className="hover-scale">
                                            <td className="sticky-col" title={d.reg}>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{d.reg}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{d.make} · {d.type}</div>
                                            </td>
                                            <td className="status-col">
                                                <Badge status={d.status === "OK" ? "Active" : d.status === "Due Soon" ? "Due Soon" : "Overdue"}>{d.status}</Badge>
                                            </td>
                                            <td>
                                                <div style={{ width: 120 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, fontWeight: 700 }}>
                                                        <span>{fmtN(d.rulePct, 0)}%</span>
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 10, background: "var(--surface-subtle)", overflow: "hidden" }}>
                                                        <div style={{
                                                            width: `${d.rulePct}%`, height: "100%", borderRadius: 10,
                                                            background: d.status === "Overdue" ? "#ef4444" : d.status === "Due Soon" ? "#f59e0b" : "#10b981"
                                                        }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>{(d.kmSince || 0).toLocaleString()} km</td>
                                            <td style={{ textAlign: "right", fontWeight: 700, color: d.remaining <= 0 ? "#ef4444" : "var(--text-secondary)" }}>
                                                {d.remaining <= 0 ? `${Math.abs(d.remaining).toLocaleString()} over` : `${d.remaining.toLocaleString()} left`}
                                            </td>
                                            <td style={{ textAlign: "right", color: "var(--text-dim)" }}>{d.odom.toLocaleString()}</td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                                    <Button variant="secondary" size="sm" icon={ClipboardList} onClick={() => openLogModal(d.rawTruck)}>Log</Button>
                                                    <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openModal("truck", d.rawTruck)}>Edit</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* ── LOG TAB ── */}
            {activeTab === "log" && (
                <div className="animate-fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                        <div style={{ display: "flex", gap: 12 }}>
                            <Badge status="Active">{logData.filter(l => l.action === "Replacement").length} Replacements</Badge>
                            <Badge status="Due Soon">{logData.filter(l => l.action === "Rotation").length} Rotations</Badge>
                            <Badge status="Pending">{logData.filter(l => !["Replacement","Rotation"].includes(l.action)).length} Other</Badge>
                        </div>
                        <Button variant="primary" size="sm" icon={Plus} onClick={() => openLogModal()}>Log tyre entry</Button>
                    </div>
                    <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                            <SearchIcon size={18} color="var(--text-dim)" />
                            <input type="search" placeholder="Search tyre log..." value={searchTermLog}
                                onChange={(e) => setSearchTermLog(e.target.value)}
                                style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }} />
                        </div>
                        <div className="table-container">
                            <table className="table-modern">
                                <SortableTableHead
                                    requestSort={requestSortLog} sortConfig={sortConfigLog}
                                    filterState={logFilters} onFilterChange={handleLogFilterChange}
                                    getUniqueValues={getLogUniqueValues}
                                    columns={[
                                        { key: "date",         label: "Date",       sortable: true },
                                        { key: "vehicle",      label: "Vehicle",    sortable: true },
                                        { key: "action",       label: "Action",     sortable: true },
                                        { key: "position",     label: "Position",   sortable: true },
                                        { key: "brand",        label: "Brand/Size", sortable: true },
                                        { key: "serialNumber", label: "Serial No.", sortable: true },
                                        { key: "odom",         label: "Odom",       sortable: true, align: "right" },
                                        { key: "costVal",      label: "Cost",       sortable: true, align: "right" },
                                    ]}
                                />
                                <tbody>
                                    {sortedLogItems.length === 0 ? (
                                        <tr><td colSpan={8} style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><CircleDot size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600, marginBottom: 12 }}>No tyre entries yet.</div>
                                            <Button variant="primary" icon={Plus} onClick={() => openLogModal()}>Log first entry</Button>
                                        </td></tr>
                                    ) : sortedLogItems.map(l => (
                                        <tr key={l.id} className="hover-scale">
                                            <td className="sticky-col">{fmtDate(l.date)}</td>
                                            <td style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{l.vehicle}</td>
                                            <td>
                                                <Badge status={
                                                    l.action === "Replacement" ? "Active" :
                                                    l.action === "Rotation"    ? "Due Soon" :
                                                    l.action === "Inspection"  ? "Pending" : "default"
                                                }>{l.action}</Badge>
                                            </td>
                                            <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{l.position || "—"}</td>
                                            <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                                                {[l.brand, l.size].filter(Boolean).join(" · ") || "—"}
                                            </td>
                                            <td style={{ color: "var(--text-dim)", fontSize: 12, fontFamily: "monospace" }}>{l.serialNumber || "—"}</td>
                                            <td style={{ textAlign: "right", color: "var(--text-dim)" }}>{l.odom ? Number(l.odom).toLocaleString() : "—"}</td>
                                            <td style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }}>
                                                {l.costVal > 0 ? fmt(l.costVal) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* ── SPEND TAB ── */}
            {activeTab === "spend" && (
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
                            <input type="search" placeholder="Search spend records..." value={searchTermSpend}
                                onChange={(e) => setSearchTermSpend(e.target.value)}
                                style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }} />
                        </div>
                        <div className="table-container">
                            <table className="table-modern">
                                <SortableTableHead
                                    requestSort={requestSortSpend} sortConfig={sortConfigSpend}
                                    filterState={spendFilters} onFilterChange={handleSpendFilterChange}
                                    getUniqueValues={getSpendUniqueValues}
                                    columns={[
                                        { key: "date",      label: "Date",    sortable: true },
                                        { key: "vehicle",   label: "Vehicle", sortable: true },
                                        { key: "desc",      label: "Description", sortable: true },
                                        { key: "amountVal", label: "Amount",  sortable: true, align: "right" }
                                    ]}
                                />
                                <tbody>
                                    {sortedSpendItems.length === 0 ? (
                                        <tr><td colSpan={4} style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No spend records found.</div>
                                        </td></tr>
                                    ) : sortedSpendItems.map(e => (
                                        <tr key={e.id} className="hover-scale">
                                            <td className="sticky-col">{fmtDate(e.date)}</td>
                                            <td style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{e.vehicle}</td>
                                            <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{e.desc}</td>
                                            <td style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }}>{fmt(e.amountVal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* ── LOG ENTRY MODAL ── */}
            {logModal && S && (
                <Modal
                    title="Log Tyre Entry"
                    onSave={submitLog}
                    saveLabel={logSubmitting ? "Saving…" : "Save Entry"}
                    saveDisabled={logSubmitting || !logForm.truck}
                    closeModal={() => setLogModal(false)}
                    S={S}
                    wide
                >
                    <div style={S.fgg(2)}>
                        <Field
                            label="Vehicle *"
                            k="truck"
                            full
                            options={[{ v: "", l: "Select vehicle…" }, ...(data.trucks || []).map(t => ({ v: t.id, l: t.reg + (t.make ? ` — ${t.make}` : "") }))]}
                            form={logForm}
                            setForm={setLogFormField}
                            S={S}
                            T={T}
                        />
                        <Field
                            label="Action *"
                            k="action"
                            options={TYRE_ACTIONS.map(a => ({ v: a, l: a }))}
                            form={logForm}
                            setForm={setLogFormField}
                            S={S}
                            T={T}
                        />
                        <Field
                            label="Position"
                            k="position"
                            options={TYRE_POSITIONS.map(p => ({ v: p, l: p }))}
                            form={logForm}
                            setForm={setLogFormField}
                            S={S}
                            T={T}
                        />
                        <Field label="Date" k="date" type="date" form={logForm} setForm={setLogFormField} S={S} T={T} />
                        <Field label="Odometer (KM)" k="odom" type="number" placeholder="e.g. 142300" form={logForm} setForm={setLogFormField} S={S} T={T} />
                        <Field label="Brand" k="brand" placeholder="e.g. Michelin" form={logForm} setForm={setLogFormField} S={S} T={T} />
                        <Field label="Tyre Size" k="size" placeholder="e.g. 11R22.5" form={logForm} setForm={setLogFormField} S={S} T={T} />
                        <Field label="Serial Number" k="serialNumber" placeholder="Optional" form={logForm} setForm={setLogFormField} S={S} T={T} />
                        <Field label="Cost (KES)" k="cost" type="number" placeholder="0" form={logForm} setForm={setLogFormField} S={S} T={T} />
                        <div style={{ ...S.fg, gridColumn: "1 / -1" }}>
                            <label style={S.lbl}>Notes</label>
                            <textarea
                                rows={2}
                                placeholder="Additional notes…"
                                value={logForm.notes}
                                onChange={e => patch("notes", e.target.value)}
                                style={{ ...S.inp, resize: "vertical", height: "auto" }}
                            />
                        </div>
                    </div>

                    {logForm.action === "Replacement" && (
                        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(var(--brand-primary-rgb, 249 115 22) / 0.08)", border: "1px solid rgba(var(--brand-primary-rgb, 249 115 22) / 0.25)", fontSize: 12, color: "var(--text-secondary)" }}>
                            Logging a replacement will reset the tyre odometer on this truck to the odometer value entered above.
                            {Number(logForm.cost) > 0 && " A Tyre expense will also be created automatically."}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}
