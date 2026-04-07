import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Field } from "./Field";
import { Button } from "./Button";
import { fmt, fmtDate, today, uid, monthLabel } from "../utils/formatters";
import { validators } from "../utils/validators";
import { PAYMENT_API } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import { DEFAULT_FUEL_PRICE, STATUSES_JOURNEY, CARGO_TYPES, TRUCK_TYPES, STATUSES_TRUCK, INVOICE_PREFIX, PAYMENT_TERMS_DAYS } from "../constants/nav";
import { getLicenceClasses, getCommonRoutes, subscribeSettings } from "../utils/settingsStore.js";

/* ── Shared sub-components ──────────────────────────────────────── */

function SectionDivider({ title }) {
    return (
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 12, margin: "8px 0 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{title}</div>
            <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>
    );
}

function FormLabel({ children }) {
    return (
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {children}
        </label>
    );
}

function InfoBox({ children, color = "var(--brand-primary)" }) {
    return (
        <div style={{ gridColumn: "1/-1", padding: "12px 16px", borderRadius: "var(--radius-md)", background: `${color}10`, border: `1px solid ${color}30`, fontSize: 13, color, fontWeight: 600 }}>
            {children}
        </div>
    );
}

const FuelPhotoField = ({ label, k, form, setForm, S, T }) => {
    const [uploading, setUploading] = useState(false);
    const photoUrl = form[k];

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("photo", file);
        try {
            const res = await fetchWithAuth(`${PAYMENT_API}/api/driver/upload`, {
                method: "POST",
                body: formData,
            });
            const d = await res.json();
            if (d.success) setForm(f => ({ ...f, [k]: d.url }));
            else alert("Upload failed: " + d.error);
        } catch (err) {
            alert("Upload error: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <FormLabel>
                {label}{" "}
                <span style={{ fontWeight: 600, color: photoUrl ? "#10b981" : "var(--text-dim)", textTransform: "none" }}>
                    {photoUrl ? "(uploaded)" : "(required)"}
                </span>
            </FormLabel>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    flex: 1, height: 38, borderRadius: "var(--radius-md)", border: `1px solid var(--border-subtle)`,
                    background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}>
                    {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
                </label>
                {photoUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <a href={photoUrl} target="_blank" rel="noreferrer">
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: `url(${photoUrl}) center/cover no-repeat`, border: "1px solid var(--border-subtle)" }} />
                        </a>
                        <button type="button" onClick={() => setForm(f => ({ ...f, [k]: "" }))}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

function JourneyOdomPhotoField({ label, k, form, setForm, S, T }) {
    const [uploading, setUploading] = useState(false);
    const photoUrl = form[k];

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "journey_odom_admin");
        fd.append("filename", k);
        try {
            const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/upload`, { method: "POST", body: fd });
            const d = await res.json();
            if (d.success) setForm((f) => ({ ...f, [k]: d.url }));
            else alert("Upload failed: " + (d.error || "unknown"));
        } catch (err) {
            alert("Upload error: " + err.message);
        } finally {
            setUploading(false);
        }
        e.target.value = "";
    };

    return (
        <div>
            <FormLabel>
                {label}{" "}
                <span style={{ fontWeight: 600, color: photoUrl ? "#10b981" : "var(--text-dim)", textTransform: "none" }}>
                    {photoUrl ? "(uploaded)" : "(optional)"}
                </span>
            </FormLabel>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    flex: 1, height: 38, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                    background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
                    cursor: uploading ? "wait" : "pointer"
                }}>
                    {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
                </label>
                {photoUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <a href={photoUrl} target="_blank" rel="noreferrer">
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: `url(${photoUrl}) center/cover no-repeat`, border: "1px solid var(--border-subtle)" }} />
                        </a>
                        <button type="button" onClick={() => setForm(f => ({ ...f, [k]: "" }))}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Grid layout helpers ─────────────────────────────────────────── */
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" };
const gridFull = { display: "grid", gridTemplateColumns: "1fr", gap: "16px 20px" };

export function GlobalModals(props) {
    const {
        modal, form, setForm, closeModal, saveItem, data, setData,
        S, T, dark, truckReg, isMobile,
        logMaintenance,
        showToast,
        openWaybillGenerator,
    } = props;
    const [creationResult, setCreationResult] = useState(null);
    const [, bumpSettingsDerived] = useState(0);

    useEffect(() => subscribeSettings(() => bumpSettingsDerived((n) => n + 1)), []);
    useEffect(() => { setCreationResult(null); }, [modal]);

    const licenceClasses = getLicenceClasses();
    const commonRoutes = getCommonRoutes();

    if (!modal) return null;

    const modalGrid = isMobile ? gridFull : grid2;

    /* ── FUEL ─────────────────────────────────────────────────────── */
    if (modal === "fuel") {
        const errors = {};
        errors.litres = validators.required(form.litres) || validators.positiveNumber(form.litres);
        errors.pricePerL = validators.required(form.pricePerL) || validators.positiveNumber(form.pricePerL);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Fuel Entry" : "Log Fuel Fill-up"} onSave={() => saveItem("fuel", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <Field label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} />
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Litres" k="litres" type="number" form={form} setForm={setForm} S={S} error={errors.litres} />
                    <Field label="Price per Litre (KES)" k="pricePerL" type="number" form={form} setForm={setForm} S={S} error={errors.pricePerL} />

                    {form.litres && form.pricePerL && (
                        <InfoBox color="var(--brand-primary)">
                            Estimated cost: <strong>{fmt(+form.litres * +form.pricePerL)}</strong>
                        </InfoBox>
                    )}

                    <Field label="Station Name" k="station" form={form} setForm={setForm} S={S} />
                    <Field label="Odometer Reading (km)" k="odom" type="number" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${fmtDate(j.date)})` }))]} full form={form} setForm={setForm} S={S} />
                    </div>

                    <SectionDivider title="Verification Photos" />

                    <FuelPhotoField label="Pump Display" k="photoPump" form={form} setForm={setForm} S={S} T={T} />
                    <FuelPhotoField label="Fuel Receipt" k="photoReceipt" form={form} setForm={setForm} S={S} T={T} />
                    <FuelPhotoField label="Truck Odometer" k="photoOdom" form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    /* ── EXPENSE ──────────────────────────────────────────────────── */
    if (modal === "expense") {
        const errors = {};
        errors.amount = validators.required(form.amount) || validators.positiveNumber(form.amount);
        const hasErrors = Object.values(errors).some(Boolean);
        const CATS = ["Maintenance", "Toll", "Permit", "Tyre", "Fuel", "Salary", "Allowance", "Other"];

        return (
            <Modal title={form.id ? "Edit Expense" : "Add New Expense"} onSave={() => saveItem("expenses", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <Field label="Truck / Vehicle" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} />

                    <div>
                        <FormLabel>Category</FormLabel>
                        <select style={S.inp} value={form.cat || ""} onChange={e => setForm(f => ({ ...f, cat: e.target.value, subCat: "" }))}>
                            <option value="">Select...</option>
                            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {form.cat && (
                        <Field
                            label={`${form.cat} Type`}
                            k="subCat"
                            options={
                                form.cat === "Maintenance" ? ["General Service", "Oil Change", "Brakes", "Tyres", "Engine", "Electrical", "Suspension", "Bodywork", "Other"] :
                                form.cat === "Fuel" ? ["Diesel", "Adblue", "Oil/Lubricants"] :
                                form.cat === "Toll" ? ["Highways", "Weighbridge", "Local Councils"] :
                                form.cat === "Permit" ? ["Insurance", "Speed Governor", "Inspection", "NTSA/TLB"] :
                                ["General", "Specific Repair", "Mission Expense", "Other"]
                            }
                            form={form} setForm={setForm} S={S}
                        />
                    )}

                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} error={errors.amount} />
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Description" k="desc" full form={form} setForm={setForm} S={S} placeholder="e.g. Workshop repair, Toll fee..." />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${fmtDate(j.date)})` }))]} full form={form} setForm={setForm} S={S} />
                    </div>

                    <SectionDivider title="Receipt" />
                    <div style={{ gridColumn: "1/-1" }}>
                        <FuelPhotoField label="Receipt / Invoice Photo" k="receiptUrl" form={form} setForm={setForm} S={S} T={T} />
                    </div>

                    <div style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                        Tip: Expenses linked to a journey are factored into that journey's P&L automatically.
                    </div>
                </div>
            </Modal>
        );
    }

    /* ── INVOICE ──────────────────────────────────────────────────── */
    if (modal === "invoice") {
        const errors = {};
        errors.amount = validators.required(form.amount) || validators.positiveNumber(form.amount);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Invoice" : "Generate New Invoice"} onSave={() => {
                if (!form.id) form.id = INVOICE_PREFIX + "-" + uid().slice(0, 5);
                saveItem("invoices", form);
            }} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <Field label="Customer" k="customerId" options={data.customers.map(c => ({ v: c.id, l: c.name }))} form={form} setForm={setForm} S={S} />
                    <Field label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${fmtDate(j.date)})` }))]} form={form} setForm={setForm} S={S} />
                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} error={errors.amount} />

                    {form.amount && (
                        <div style={{ gridColumn: "1/-1", padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <span>Subtotal: <b style={{ color: "var(--brand-primary)" }}>{fmt(Math.round(+form.amount / 1.16))}</b></span>
                            <span>VAT 16%: <b style={{ color: "#f59e0b" }}>{fmt(+form.amount - Math.round(+form.amount / 1.16))}</b></span>
                            <span>Total: <b style={{ color: "#10b981" }}>{fmt(+form.amount)}</b></span>
                        </div>
                    )}

                    <Field label="Date Issued" k="issued" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Due Date" k="due" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Status" k="status" options={["Pending", "Paid", "Overdue", "Partial"]} form={form} setForm={setForm} S={S} />
                    <Field label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567" form={form} setForm={setForm} S={S} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                    </div>
                </div>
            </Modal>
        );
    }

    /* ── LOG PAYMENT ──────────────────────────────────────────────── */
    if (modal === "logPayment") {
        return (
            <Modal title={`Log Payment for ${form.invoiceId}`} onSave={() => saveItem("payments", form)} S={S} closeModal={closeModal}>
                <div style={modalGrid}>
                    <Field label="Payment Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Payment Method" k="method" options={["M-Pesa", "Bank Transfer", "Cheque", "Cash"]} form={form} setForm={setForm} S={S} />
                    <Field label="Reference No." k="ref" placeholder="e.g. QJK1234567" form={form} setForm={setForm} S={S} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                    </div>
                </div>
            </Modal>
        );
    }

    /* ── PAYROLL ──────────────────────────────────────────────────── */
    if (modal === "payroll") {
        const errors = {};
        errors.baseSalary = validators.required(form.baseSalary) || validators.positiveNumber(form.baseSalary);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Pay Record" : "Add New Pay Record"} onSave={() => saveItem("payroll", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Employee / Driver" k="driver" options={[
                            ...data.drivers.map(d => ({ v: d.id, l: `Driver: ${d.name}` })),
                            ...(data.staff || []).map(s => ({ v: s.id, l: `Staff: ${s.name}` })),
                            ...(data.turnboys || []).map(t => ({ v: t.id, l: `Turnboy: ${t.name}` }))
                        ]} form={form} setForm={setForm} S={S} />
                    </div>

                    <div>
                        <FormLabel>Payment Month</FormLabel>
                        <input type="month" className="input-premium" value={form.month || ""} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} style={{ height: 42, width: "100%" }} />
                    </div>

                    <Field label="Base Salary (KES)" k="baseSalary" type="number" form={form} setForm={setForm} S={S} error={errors.baseSalary} />
                    <Field label="Allowances (KES)" k="allowance" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Deductions (KES)" k="deductions" type="number" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "var(--radius-md)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Net Disbursement</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>{fmt((+form.baseSalary || 0) + (+form.allowance || 0) - (+form.deductions || 0))}</span>
                    </div>

                    <Field label="Status" k="status" options={["Pending", "Paid"]} form={form} setForm={setForm} S={S} />
                    <Field label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. PAY1234567" form={form} setForm={setForm} S={S} />
                    <Field label="Date Paid" k="paidDate" type="date" form={form} setForm={setForm} S={S} />

                    {form.driver && form.month && (
                        <div style={{ gridColumn: "1/-1", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", padding: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Summary ({monthLabel(form.month)})</div>
                            {(() => {
                                const drvJourneys = data.journeys.filter(j => j.driver === form.driver && j.date?.startsWith(form.month) && j.status === "Completed");
                                const totalMileage = drvJourneys.reduce((s, j) => s + (j.driverMileage || 0), 0);
                                if (drvJourneys.length === 0) return <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No completed journeys found.</div>;
                                return (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--brand-primary)" }}>{fmt(totalMileage)} Mileage</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>From {drvJourneys.length} mission(s)</div>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); setForm(f => ({ ...f, allowance: totalMileage })); }} style={{ border: "1px solid var(--brand-primary)", color: "var(--brand-primary)" }}>
                                            Apply to Allowances
                                        </Button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    /* ── JOURNEY ──────────────────────────────────────────────────── */
    if (modal === "journey") {
        const errors = {};
        errors.revenue = validators.required(form.revenue) || validators.positiveNumber(form.revenue);
        errors.endDate = validators.dateOrder(form.date, form.endDate);
        if (!form.returningEmpty) {
            errors.customerId = validators.required(form.customerId);
            errors.deliveryCustomerId = validators.required(form.deliveryCustomerId);
        }
        const hasErrors = Object.values(errors).some(Boolean);

        const _S = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        const DRIVER_PER_KM = _S.driverPerKm ? +_S.driverPerKm : 10;
        const TURNBOY_PER_KM = _S.turnboyPerKm ? +_S.turnboyPerKm : 6;
        const ROUTE_OVERRIDES = _S.routeOverrides || {};

        const selectedDriver = data.drivers.find((d) => d.id === form.driver);
        const vehicleLocked = !!selectedDriver?.lockVehicleAssignment;

        const getEffectiveRates = (origin, dest) => {
            if (!origin || !dest) return { driver: DRIVER_PER_KM, turnboy: TURNBOY_PER_KM };
            const isReturning = !!form.returningEmpty;
            const isInternational = !!form.isInternational;
            const routeOverridesArr = Array.isArray(ROUTE_OVERRIDES) ? ROUTE_OVERRIDES : Object.entries(ROUTE_OVERRIDES || {}).map(([key, val]) => {
                const [o, d] = key.split("→");
                return { origin: o, dest: d, driverRate: val.driver, turnboyRate: val.turnboy, returnDriverRate: val.returnDriver, returnTurnboyRate: val.returnTurnboy };
            });
            const override = routeOverridesArr.find(ro =>
                (ro.origin?.trim() === origin?.trim() && ro.dest?.trim() === dest?.trim()) ||
                (ro.origin?.trim() === dest?.trim() && ro.dest?.trim() === origin?.trim())
            );
            let dRate, tRate, isFlatRate = false;
            if (override) {
                dRate = isReturning && override.returnDriverRate != null ? +override.returnDriverRate : +override.driverRate;
                tRate = isReturning && override.returnTurnboyRate != null ? +override.returnTurnboyRate : +override.turnboyRate;
            } else {
                const flatDriver = isInternational ? (_S.flatRateOutsideDriver || 0) : (_S.flatRateInsideDriver || 0);
                const flatTurnboy = isInternational ? (_S.flatRateOutsideTurnboy || 0) : (_S.flatRateInsideTurnboy || 0);
                if (flatDriver > 0) { dRate = flatDriver; tRate = flatTurnboy; isFlatRate = true; }
                else { dRate = DRIVER_PER_KM; tRate = TURNBOY_PER_KM; }
            }
            const rua = isReturning ? (_S.roadUserAllowanceReturn || _S.roadUserAllowance || 0) : (_S.roadUserAllowance || 0);
            return { driver: dRate, turnboy: tRate, isOverride: !!override, isFlatRate, roadUserAllowance: rua, routeKey: `${origin.trim()}→${dest.trim()}` };
        };

        const onSave = () => {
            if (!form.returningEmpty && (!form.customerId || !form.deliveryCustomerId)) {
                showToast?.("Billing customer and delivery customer are required.", "error");
                return;
            }
            const wasNew = !form.id;
            const dist = +form.distance || 0;
            const rates = getEffectiveRates(form.origin, form.dest);
            const driverMileage = rates.isFlatRate ? rates.driver : Math.round(dist * rates.driver);
            const turnboyMileage = (form.turnboyId || form.turnboyName) ? (rates.isFlatRate ? rates.turnboy : Math.round(dist * rates.turnboy)) : 0;
            const roadUserAllowance = rates.roadUserAllowance || 0;
            const enrichedForm = { ...form, id: form.id || uid(), driverMileage, turnboyMileage, roadUserAllowance, mileageRateUsed: rates.driver, turnboyMileageRateUsed: rates.turnboy, mileageRouteOverride: rates.isOverride, isFlatRate: rates.isFlatRate };
            saveItem("journeys", enrichedForm, { skipClose: true, silent: true });

            if (driverMileage > 0 && !form.id) {
                const descPrefix = rates.isFlatRate ? "Flat rate allowance" : `Mileage allowance (${dist} km @ KES ${rates.driver}/km)`;
                saveItem("expenses", { date: form.date || today(), truck: form.truck, cat: "Allowance", category: "Allowance", amount: driverMileage, desc: `Driver ${descPrefix} — ${form.origin} → ${form.dest}`, journey: enrichedForm.id, status: "Unpaid" }, { skipClose: true, silent: true });
            }
            if (turnboyMileage > 0 && !form.id && (form.turnboyId || form.turnboyName)) {
                const tbName = form.turnboyId ? (data.turnboys?.find(t => t.id === form.turnboyId)?.name || form.turnboyId) : form.turnboyName;
                const descPrefix = rates.isFlatRate ? "Flat rate allowance" : `Mileage allowance (${dist} km @ KES ${rates.turnboy}/km)`;
                saveItem("expenses", { date: form.date || today(), truck: form.truck, cat: "Allowance", category: "Allowance", amount: turnboyMileage, desc: `Turnboy ${descPrefix} (${tbName}) — ${form.origin} → ${form.dest}`, journey: enrichedForm.id, status: "Unpaid" }, { skipClose: true, silent: true });
            }
            if (roadUserAllowance > 0 && !form.id) {
                saveItem("expenses", { date: form.date || today(), truck: form.truck, cat: "Allowance", category: "Allowance", amount: roadUserAllowance, desc: `Road User Allowance${form.returningEmpty ? " (Return)" : ""} — ${form.origin} → ${form.dest}`, journey: enrichedForm.id, status: "Unpaid" }, { skipClose: true, silent: true });
            }
            if (!form.returningEmpty && (enrichedForm.status === "Accepted" || enrichedForm.status === "Loading")) {
                const existingInvoice = data.invoices?.find(inv => inv.journey === enrichedForm.id);
                if (!existingInvoice) {
                    const invoiceId = (INVOICE_PREFIX || "INV") + "-" + uid().slice(0, 5);
                    const issuedDate = today();
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + (PAYMENT_TERMS_DAYS || 14));
                    const dueDateStr = dueDate.toISOString().split("T")[0];
                    const billingCust = data.customers.find(c => c.id === form.customerId);
                    saveItem("invoices", { id: invoiceId, customerId: form.customerId, client: billingCust?.name || "", phone: billingCust?.phone || "", journey: enrichedForm.id, amount: enrichedForm.revenue, issued: issuedDate, due: dueDateStr, status: "Pending", notes: `Automated invoice for journey ${enrichedForm.origin} → ${enrichedForm.dest}. Cargo: ${enrichedForm.cargo || "N/A"}` }, { skipClose: true, silent: true });
                    showToast?.(`Invoice ${invoiceId} generated automatically.`, "success");
                }
            }
            showToast?.("Record saved", "success");
            closeModal();
            if (wasNew && openWaybillGenerator && (enrichedForm.status === "Loading" || enrichedForm.status === "In Transit")) {
                if (window.confirm("Generate a road freight waybill for this journey? You can complete carrier, cargo, and customs details, then print four copies.")) {
                    openWaybillGenerator(enrichedForm);
                }
            }
        };

        return (
            <Modal title={form.id ? "Edit Journey" : "Log New Journey"} onSave={onSave} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    {/* Quick Route */}
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Quick Route</FormLabel>
                        <select style={S.inp} onChange={e => {
                            const route = commonRoutes.find(r => `${r.origin}→${r.dest}` === e.target.value);
                            if (route) setForm(f => ({ ...f, origin: route.origin, dest: route.dest, distance: route.distance }));
                        }} defaultValue="">
                            <option value="">— Select a common route or fill in manually below —</option>
                            {commonRoutes.map(r => <option key={`${r.origin}→${r.dest}`} value={`${r.origin}→${r.dest}`}>{r.origin} → {r.dest} ({r.distance} km)</option>)}
                        </select>
                    </div>

                    <SectionDivider title="Route & Addresses" />

                    <Field label="Origin" k="origin" form={form} setForm={setForm} S={S} />
                    <Field label="Destination" k="dest" form={form} setForm={setForm} S={S} />
                    <Field label="Pickup Address" k="pickupAddress" full form={form} setForm={setForm} S={S} placeholder="Specific location at origin..." />
                    <Field label="Delivery Address" k="deliveryAddress" full form={form} setForm={setForm} S={S} placeholder="Specific unloading point..." />

                    <SectionDivider title="Vehicle & Crew" />

                    <div>
                        <FormLabel>
                            Truck
                            {vehicleLocked && <span style={{ fontWeight: 600, color: "var(--text-dim)", marginLeft: 8, fontSize: 11, textTransform: "none" }}>(locked for driver)</span>}
                        </FormLabel>
                        <select style={S.inp} value={form.truck || ""} onChange={(e) => {
                            const truck = data.trucks.find((t) => t.id === e.target.value);
                            setForm((f) => ({ ...f, truck: e.target.value, driver: truck?.driver || f.driver, startOdom: truck?.odom || f.startOdom }));
                        }}>
                            <option value="">Select…</option>
                            {data.trucks.map((t) => <option key={t.id} value={t.id}>{t.reg}</option>)}
                        </select>
                    </div>

                    <div>
                        <FormLabel>Trailer</FormLabel>
                        <select style={S.inp} value={form.trailer || ""} onChange={(e) => setForm((f) => ({ ...f, trailer: e.target.value }))}>
                            <option value="">Select…</option>
                            {(data.trailers || []).map((t) => <option key={t.id} value={t.id}>{t.reg} ({t.type})</option>)}
                        </select>
                    </div>

                    <Field label="Driver" k="driver" options={data.drivers.map((d) => ({ v: d.id, l: d.name }))} form={form} setForm={setForm} S={S}
                        onChange={(driverId) => {
                            const drv = data.drivers.find((d) => d.id === driverId);
                            setForm((f) => {
                                const next = { ...f, driver: driverId };
                                if (drv?.lockVehicleAssignment) {
                                    next.truck = drv.truck || "";
                                    next.trailer = drv.assignedTrailer || "";
                                    const tr = data.trucks.find((t) => t.id === next.truck);
                                    if (tr?.odom != null) next.startOdom = tr.odom;
                                }
                                return next;
                            });
                        }}
                    />

                    <Field label="Start Odom (km)" k="startOdom" type="number" form={form} setForm={setForm} S={S}
                        onChange={v => setForm(f => ({ ...f, startOdom: v, distance: f.finalOdom ? Math.max(0, +f.finalOdom - +v) : f.distance }))} />
                    <Field label="Final Odom (km)" k="finalOdom" type="number" form={form} setForm={setForm} S={S}
                        onChange={v => setForm(f => ({ ...f, finalOdom: v, distance: f.startOdom ? Math.max(0, +v - +f.startOdom) : f.distance }))} />

                    <SectionDivider title="Odometer Photos (optional)" />
                    <JourneyOdomPhotoField label="Start odometer" k="adminStartOdomPhotoUrl" form={form} setForm={setForm} S={S} T={T} />
                    <JourneyOdomPhotoField label="End odometer" k="adminEndOdomPhotoUrl" form={form} setForm={setForm} S={S} T={T} />

                    <SectionDivider title="Dates & Journey Type" />

                    <Field label="Departure Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Arrival Date" k="endDate" type="date" form={form} setForm={setForm} S={S} error={errors.endDate} />

                    {/* Toggle flags */}
                    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px 16px", background: form.isInternational ? "rgba(7,131,235,0.08)" : "var(--bg-surface)", borderRadius: "var(--radius-md)", border: `1px solid ${form.isInternational ? "var(--brand-primary)" : "var(--border-subtle)"}` }}>
                        <input type="checkbox" checked={!!form.isInternational} onChange={e => setForm(f => ({ ...f, isInternational: e.target.checked }))} style={{ width: 18, height: 18, accentColor: "var(--brand-primary)" }} />
                        <div>
                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>International Journey</div>
                            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>Journey outside Kenya. International flat rates apply.</div>
                        </div>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px 16px", background: form.returningEmpty ? "rgba(251,191,36,0.08)" : "var(--bg-surface)", borderRadius: "var(--radius-md)", border: `1px solid ${form.returningEmpty ? "#f59e0b" : "var(--border-subtle)"}` }}>
                        <input type="checkbox" checked={!!form.returningEmpty} onChange={e => setForm(f => ({ ...f, returningEmpty: e.target.checked, customerId: e.target.checked ? "" : f.customerId, deliveryCustomerId: e.target.checked ? "" : f.deliveryCustomerId }))} style={{ width: 18, height: 18, accentColor: "#f59e0b" }} />
                        <div>
                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>Return Trip / Empty</div>
                            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>Vehicle returning empty. Return rates apply.</div>
                        </div>
                    </label>

                    {/* TR8 upload — international only */}
                    {form.isInternational && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <SectionDivider title="TR8 Transit Document (required)" />
                            <label style={{ display: "block", background: dark ? T.bg : "#f8fafc", border: `1.5px dashed ${form.tr8Uploading ? "#38bdf8" : form.tr8Url ? "var(--brand-primary)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-md)", padding: 14, textAlign: "center", cursor: "pointer", fontSize: 13, color: form.tr8Uploading ? "#38bdf8" : form.tr8Url ? "var(--brand-primary)" : "var(--text-dim)" }}>
                                {form.tr8Uploading ? "Uploading TR8…" : form.tr8Url ? "TR8 uploaded — click to replace" : "Upload TR8 transit form (PDF or image)"}
                                <input type="file" accept="image/*,.pdf" style={{ display: "none" }} disabled={form.tr8Uploading}
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        setForm(f => ({ ...f, tr8Uploading: true }));
                                        try {
                                            const fd = new FormData();
                                            fd.append("file", file);
                                            const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/upload`, { method: "POST", body: fd });
                                            const result = await res.json();
                                            if (result.success) setForm(f => ({ ...f, tr8Url: result.url, tr8Uploading: false }));
                                            else { alert(result.error); setForm(f => ({ ...f, tr8Uploading: false })); }
                                        } catch (err) { alert(err.message); setForm(f => ({ ...f, tr8Uploading: false })); }
                                        e.target.value = "";
                                    }} />
                            </label>
                            {form.tr8Url && (
                                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <a href={form.tr8Url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--brand-primary)", fontWeight: 700 }}>View TR8 document</a>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, tr8Url: "" }))} style={{ border: "none", background: "none", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customers */}
                    {!form.returningEmpty && (
                        <>
                            <SectionDivider title="Billing & Delivery" />
                            <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <FormLabel>Billing Customer (consignor) — required</FormLabel>
                                    <button type="button" onClick={() => setForm((f) => ({ ...f, _quickAddBill: !f._quickAddBill, _quickAddDel: false }))} style={{ border: "none", background: "none", color: "var(--brand-primary)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                                        {form._quickAddBill ? "Cancel" : "Add new"}
                                    </button>
                                </div>
                                {form._quickAddBill ? (
                                    <div style={{ background: "var(--bg-surface)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: 8 }}>
                                        <input style={{ ...S.inp, marginBottom: 8 }} placeholder="Company or person name…" id="qa-bill-name" />
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <input style={{ ...S.inp, flex: 1 }} placeholder="Phone…" id="qa-bill-phone" />
                                            <button type="button" style={{ padding: "0 12px", borderRadius: 8, background: "var(--brand-primary)", color: "white", border: "none", fontWeight: 800, fontSize: 12 }}
                                                onClick={() => {
                                                    const name = document.getElementById("qa-bill-name")?.value;
                                                    const phone = document.getElementById("qa-bill-phone")?.value;
                                                    if (!name?.trim()) return alert("Consignor name is required");
                                                    if (!phone?.trim()) return alert("Consignor phone is required");
                                                    const existing = data.customers.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
                                                    if (existing) { setForm((f) => ({ ...f, customerId: existing.id, _quickAddBill: false })); }
                                                    else { const id = uid(); saveItem("customers", { id, name: name.trim(), phone: phone || "", type: "Individual", status: "Active" }); setForm((f) => ({ ...f, customerId: id, _quickAddBill: false })); }
                                                }}>Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <select style={{ ...S.inp, border: errors.customerId ? "1px solid #DC2626" : S.inp.border }} value={form.customerId || ""} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
                                        <option value="">Select billing customer…</option>
                                        {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                                {errors.customerId && <p style={{ color: "#DC2626", fontSize: 11, marginTop: 4 }}>{errors.customerId}</p>}
                            </div>

                            <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <FormLabel>Delivery Customer (consignee) — required</FormLabel>
                                    <button type="button" onClick={() => setForm((f) => ({ ...f, _quickAddDel: !f._quickAddDel, _quickAddBill: false }))} style={{ border: "none", background: "none", color: "var(--brand-primary)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                                        {form._quickAddDel ? "Cancel" : "Add new"}
                                    </button>
                                </div>
                                {form._quickAddDel ? (
                                    <div style={{ background: "var(--bg-surface)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: 8 }}>
                                        <input style={{ ...S.inp, marginBottom: 8 }} placeholder="Receiver name or site…" id="qa-del-name" />
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <input style={{ ...S.inp, flex: 1 }} placeholder="Phone…" id="qa-del-phone" />
                                            <button type="button" style={{ padding: "0 12px", borderRadius: 8, background: "var(--brand-primary)", color: "white", border: "none", fontWeight: 800, fontSize: 12 }}
                                                onClick={() => {
                                                    const name = document.getElementById("qa-del-name")?.value;
                                                    const phone = document.getElementById("qa-del-phone")?.value;
                                                    if (!name?.trim()) return alert("Consignee name is required");
                                                    if (!phone?.trim()) return alert("Consignee phone is required");
                                                    const existing = data.customers.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
                                                    if (existing) { setForm((f) => ({ ...f, deliveryCustomerId: existing.id, _quickAddDel: false })); }
                                                    else { const id = uid(); saveItem("customers", { id, name: name.trim(), phone: phone || "", type: "Individual", status: "Active" }); setForm((f) => ({ ...f, deliveryCustomerId: id, _quickAddDel: false })); }
                                                }}>Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <select style={{ ...S.inp, border: errors.deliveryCustomerId ? "1px solid #DC2626" : S.inp.border }} value={form.deliveryCustomerId || ""} onChange={(e) => setForm((f) => ({ ...f, deliveryCustomerId: e.target.value }))}>
                                        <option value="">Select delivery customer…</option>
                                        {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                                {errors.deliveryCustomerId && <p style={{ color: "#DC2626", fontSize: 11, marginTop: 4 }}>{errors.deliveryCustomerId}</p>}
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.45 }}>Used on the waybill as consignor and consignee.</div>
                            </div>
                        </>
                    )}

                    <SectionDivider title="Cargo & Financials" />

                    <Field label="Distance (km)" k="distance" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Revenue (KES)" k="revenue" type="number" form={form} setForm={setForm} S={S} error={errors.revenue} />

                    <div>
                        <FormLabel>Cargo Type</FormLabel>
                        {(() => {
                            const effectiveCargoType = form.cargoType || (CARGO_TYPES.includes(form.cargo) ? form.cargo : form.cargo ? "Other" : "");
                            return (
                                <select style={S.inp} value={effectiveCargoType} onChange={e => {
                                    const v = e.target.value;
                                    setForm(f => ({ ...f, cargoType: v, cargo: v !== "Other" ? v : "" }));
                                }}>
                                    <option value="">Select cargo type…</option>
                                    {CARGO_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            );
                        })()}
                    </div>

                    {/* Other cargo text field */}
                    {(form.cargoType === "Other" || (!form.cargoType && form.cargo && !CARGO_TYPES.includes(form.cargo))) && (
                        <div>
                            <FormLabel>Specify Cargo</FormLabel>
                            <input style={S.inp} value={form.cargo || ""} placeholder="Describe the cargo…" onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                        </div>
                    )}

                    <Field label="Weight (KGs)" k="weight" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Status" k="status" options={STATUSES_JOURNEY} form={form} setForm={setForm} S={S} />

                    {/* Allowance preview */}
                    {(form.origin && form.dest && (form.distance || form.isInternational)) && (
                        <div style={{ gridColumn: "1/-1" }}>
                            {(() => {
                                const rates = getEffectiveRates(form.origin, form.dest);
                                const allowance = rates.isFlatRate ? rates.driver : Math.round(+form.distance * rates.driver);
                                const rua = rates.roadUserAllowance || 0;
                                const total = allowance + rua;
                                return (
                                    <div style={{ display: "grid", gap: 10 }}>
                                        <div style={{ background: "rgba(16,185,129,0.05)", border: `1px solid ${rates.isOverride ? "var(--brand-primary)33" : "rgba(16,185,129,0.2)"}`, borderRadius: "var(--radius-md)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                                                    {rates.isFlatRate ? "Flat Rate Allowance" : "Mileage Allowance"}
                                                    {rates.isOverride && <span style={{ background: "var(--brand-primary)15", color: "var(--brand-primary)", padding: "2px 6px", borderRadius: 6, fontSize: 9 }}>ROUTE RATE</span>}
                                                </div>
                                                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                                                    {rates.isFlatRate ? "International/Domestic Flat Rate" : `${Number(form.distance).toLocaleString()} km @ ${fmt(rates.driver)}/km`}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>{fmt(allowance)}</div>
                                        </div>
                                        {rua > 0 && (
                                            <div style={{ background: "rgba(7,131,235,0.05)", border: "1px solid rgba(7,131,235,0.2)", borderRadius: "var(--radius-md)", padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>Road User Allowance</div>
                                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--brand-primary)" }}>{fmt(rua)}</div>
                                            </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 18px" }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Total Projected Allowance</div>
                                            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--brand-primary)" }}>{fmt(total)}</div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" form={form} setForm={setForm} S={S} full />
                    </div>

                    <SectionDivider title="Turnboy / Second Driver" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Turnboy Type</FormLabel>
                        <select style={S.inp} value={form.turnboyType || ""} onChange={e => { setForm(f => ({ ...f, turnboyType: e.target.value, turnboyId: "", turnboyName: "" })); }}>
                            <option value="">None — solo driver</option>
                            <option value="salaried">Salaried turnboy (from company list)</option>
                            <option value="casual">Casual / one-off turnboy</option>
                        </select>
                    </div>

                    {form.turnboyType === "salaried" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <FormLabel>Select Turnboy</FormLabel>
                            <select style={S.inp} value={form.turnboyId || ""} onChange={e => setForm(f => ({ ...f, turnboyId: e.target.value }))}>
                                <option value="">Select…</option>
                                {(data.turnboys || []).filter(tb => tb.status === "Active").map(tb => (
                                    <option key={tb.id} value={tb.id}>{tb.name} — {tb.phone}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {form.turnboyType === "casual" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <FormLabel>Turnboy Name</FormLabel>
                            <input style={S.inp} placeholder="e.g. John Otieno" value={form.turnboyName || ""} onChange={e => setForm(f => ({ ...f, turnboyName: e.target.value }))} />
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    /* ── MAINTENANCE ──────────────────────────────────────────────── */
    if (modal === "maintenance") {
        const submitLog = () => {
            if (!form.date || !form.odom) { alert("Date and odometer reading are required"); return; }
            const taskName = form.task === "Custom" ? form.customTask : form.task;
            const entry = { truck: form.truck, date: form.date, cat: "Maintenance", amount: +(form.cost || 0), odom: +form.odom, desc: `${taskName}${form.notes ? " — " + form.notes : ""}`, _maintenanceTask: taskName, _maintenanceDetails: { task: taskName, workshop: form.workshop || "", cost: +(form.cost || 0), odomReading: +form.odom, receiptUrl: form.receiptUrl || "", notes: form.notes || "" } };
            saveItem("expenses", entry);
            const truckObj = data.trucks.find(t => t.id === form.truck);
            if (+form.odom > +(truckObj?.odom || 0)) {
                setData(d => ({ ...d, trucks: d.trucks.map(t => t.id === form.truck ? { ...t, odom: +form.odom } : t) }));
            }
        };

        const DEFAULT_SCHEDULE = [
            { task: "Oil Change", intervalKm: 10000 }, { task: "Tyre Rotation", intervalKm: 10000 },
            { task: "Wheel Alignment & Balancing", intervalKm: 10000 }, { task: "Brake Disc Inspection", intervalKm: 15000 },
            { task: "Brake Pad Replacement", intervalKm: 15000 }, { task: "Fuel Filter Replacement", intervalKm: 20000 },
            { task: "Power Steering Fluid Top-up", intervalKm: 20000 }, { task: "Engine Belt Inspection", intervalKm: 30000 },
            { task: "Differential Oil Change", intervalKm: 40000 }, { task: "Transmission Fluid Change", intervalKm: 40000 },
        ];
        const selectedTruck = data.trucks.find(t => t.id === form.truck) || data.trucks[0];

        return (
            <Modal title={form.id ? "Edit Service Record" : `Log Service — ${form.task}`} onSave={submitLog} S={S} closeModal={closeModal}>
                <div style={modalGrid}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Truck</FormLabel>
                        <select style={S.inp} value={form.truck} onChange={e => setForm(f => ({ ...f, truck: e.target.value }))}>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg} — {Number(t.odom || 0).toLocaleString("en-KE")} km</option>)}
                        </select>
                    </div>

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Maintenance Task</FormLabel>
                        <select style={S.inp} value={form.task} onChange={e => {
                            const found = DEFAULT_SCHEDULE.find(s => s.task === e.target.value);
                            setForm(f => ({ ...f, task: e.target.value, intervalKm: found?.intervalKm || f.intervalKm }));
                        }}>
                            {DEFAULT_SCHEDULE.map(s => <option key={s.task} value={s.task}>{s.task} (every {s.intervalKm.toLocaleString()} km)</option>)}
                            <option value="Custom">Custom task…</option>
                        </select>
                    </div>

                    {form.task === "Custom" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <FormLabel>Custom Task Description</FormLabel>
                            <input style={S.inp} placeholder="e.g. Radiator flush" value={form.customTask || ""} onChange={e => setForm(f => ({ ...f, customTask: e.target.value }))} />
                        </div>
                    )}

                    <Field label="Date of Service *" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Odometer Reading (km) *" k="odom" type="number" placeholder={String(selectedTruck?.odom || 0)} form={form} setForm={setForm} S={S} />
                    <Field label="Cost (KES)" k="cost" type="number" placeholder="0" form={form} setForm={setForm} S={S} />
                    <Field label="Workshop / Garage" k="workshop" placeholder="e.g. Nairobi Auto Centre" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Notes (optional)</FormLabel>
                        <textarea style={{ ...S.inp, height: 60, resize: "vertical" }} placeholder="Any additional details…" value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>

                    <SectionDivider title="Receipt" />
                    <div style={{ gridColumn: "1/-1" }}>
                        <label style={{ display: "block", background: dark ? T.bg : "#f8fafc", border: `1.5px dashed ${form.receiptUploading ? "#38bdf8" : "var(--border-subtle)"}`, borderRadius: "var(--radius-md)", padding: 14, textAlign: "center", cursor: "pointer", fontSize: 13, color: form.receiptUploading ? "#38bdf8" : "var(--text-dim)" }}>
                            {form.receiptUploading ? "Uploading…" : form.receiptUrl ? "Receipt on file — click to replace" : "Upload receipt photo"}
                            <input type="file" accept="image/*,.pdf" style={{ display: "none" }} disabled={form.receiptUploading}
                                onChange={async (e) => {
                                    const file = e.target.files[0]; if (!file) return;
                                    setForm(f => ({ ...f, receiptUploading: true }));
                                    try {
                                        const fd = new FormData(); fd.append("file", file);
                                        const res = await fetch(`${PAYMENT_API}/api/driver/upload`, { method: "POST", body: fd });
                                        const result = await res.json();
                                        if (result.success) setForm(f => ({ ...f, receiptUrl: result.url, receiptUploading: false }));
                                        else { alert(result.error); setForm(f => ({ ...f, receiptUploading: false })); }
                                    } catch (err) { alert(err.message); setForm(f => ({ ...f, receiptUploading: false })); }
                                    e.target.value = "";
                                }} />
                        </label>
                        {form.receiptUrl && (
                            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => setForm(f => ({ ...f, receiptUrl: "" }))} style={{ border: "none", background: "none", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Remove receipt</button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        );
    }

    /* ── TRUCK ────────────────────────────────────────────────────── */
    if (modal === "truck") {
        const getErrors = () => {
            const e = {};
            if (form.reg !== undefined) e.reg = validators.required(form.reg) || validators.truckReg(form.reg);
            if (form.capacity !== undefined) e.capacity = validators.required(form.capacity) || validators.positiveNumber(form.capacity);
            return e;
        };
        const errors = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Truck" : "Add Truck"} onSave={() => saveItem("trucks", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Internal Unique Number</FormLabel>
                        <div style={{ ...S.inp, background: "var(--bg-surface)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || "AUTO-GENERATED ON SAVE"}
                        </div>
                    </div>
                    <Field label="Registration No." k="reg" form={form} setForm={setForm} S={S} T={T} error={errors.reg} />
                    <Field label="Manufacturer / Model" k="make" form={form} setForm={setForm} S={S} T={T} />
                    <div style={{ alignSelf: "center", paddingTop: 10 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!form.isRigid} onChange={(e) => setForm((f) => ({ ...f, isRigid: e.target.checked }))} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Rigid Vehicle?</span>
                        </label>
                    </div>
                    <Field label="Year" k="year" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Capacity (tonnes)" k="capacity" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.capacity} />
                    <Field label="Vehicle Type" k="type" options={TRUCK_TYPES} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status" k="status" options={STATUSES_TRUCK} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Odometer (km)" k="odom" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Assigned Driver" k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    /* ── DRIVER ───────────────────────────────────────────────────── */
    if (modal === "driver") {
        const toSegechaEmail = (rawEmail, fallbackName) => {
            const source = String(rawEmail || fallbackName || "").trim().toLowerCase();
            const local = (source.includes("@") ? source.split("@")[0] : source).replace(/[^a-z0-9._-]/g, ".").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
            return `${local || "driver"}@example.com`;
        };
        const assignedElsewhere = new Set(data.drivers.filter((d) => d.id !== form.id && d.truck).map((d) => d.truck));
        const driverTruckOptions = data.trucks.filter((t) => !assignedElsewhere.has(t.id) || t.id === form.truck).map((t) => ({ v: t.id, l: t.reg }));
        const getErrors = () => {
            const e = {};
            e.name = validators.required(form.name);
            e.phone = validators.required(form.phone) || validators.kenyaPhone(form.phone);
            e.mpesa = validators.required(form.mpesa) || validators.mpesa(form.mpesa);
            e.license = validators.required(form.license);
            e.salary = validators.required(form.salary) || validators.positiveNumber(form.salary);
            if (form.email) e.email = validators.email(form.email);
            return e;
        };
        const errors = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);

        const handleDriverSave = async () => {
            const isNew = !form.id;
            const driverId = form.id || uid();
            const driverName = form.name;
            const driverEmail = toSegechaEmail(form.email, driverName);
            const otp = form.otp || Math.floor(100000 + Math.random() * 900000).toString();
            saveItem("drivers", { ...form, id: driverId, email: driverEmail, otp, firstLogin: isNew ? true : form.firstLogin });
            if (isNew && driverEmail && driverEmail.includes("@")) {
                try {
                    const res = await fetchWithAuth(`${PAYMENT_API}/api/driver/create-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driverId, email: driverEmail, phone: form.phone, driverName }) });
                    const result = await res.json();
                    if (result.success) { const otpHint = result.otp ? ` OTP: ${result.otp}` : ""; const tempHint = result.tempPassword ? ` Temp password: ${result.tempPassword}` : ""; showToast?.(`Driver account created.${otpHint}${tempHint}`, "success"); }
                } catch (err) { console.warn("Portal account creation failed:", err.message); }
            }
        };

        return (
            <Modal title={form.id ? "Edit Driver" : "Add Driver"} onSave={handleDriverSave} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Internal ID Number</FormLabel>
                        <div style={{ ...S.inp, background: "var(--bg-surface)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || "AUTO-GENERATED ON SAVE"}
                        </div>
                    </div>

                    <SectionDivider title="Personal Details" />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Full Name" k="name" full form={form} setForm={setForm} S={S} T={T} error={errors.name} />
                    </div>
                    <Field label="Phone" k="phone" form={form} setForm={setForm} S={S} T={T} error={errors.phone} />
                    <Field label="Email Address" k="email" type="email" placeholder="driver@email.com" form={form} setForm={setForm} S={S} T={T} error={errors.email} />
                    <Field label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" form={form} setForm={setForm} S={S} T={T} error={errors.mpesa} />
                    <Field label="License No." k="license" form={form} setForm={setForm} S={S} T={T} error={errors.license} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="License Class" k="class" type="checkbox-group" options={licenceClasses} full form={form} setForm={setForm} S={S} T={T} />
                    </div>

                    <SectionDivider title="Employment" />
                    <Field label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.salary} />
                    <Field label="Date Joined" k="joined" type="date" form={form} setForm={setForm} S={S} T={T} />
                    <div>
                        <Field label="Assigned Truck" k="truck" options={driverTruckOptions} form={form} setForm={setForm} S={S} T={T} />
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>Only unassigned trucks are shown.</div>
                    </div>
                    <Field label="Default Trailer (locked drivers)" k="assignedTrailer" options={[{ v: "", l: "— None —" }, ...(data.trailers || []).map((t) => ({ v: t.id, l: `${t.reg} (${t.type})` }))]} form={form} setForm={setForm} S={S} T={T} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
                            <input type="checkbox" checked={!!form.lockVehicleAssignment} onChange={(e) => setForm((f) => ({ ...f, lockVehicleAssignment: e.target.checked }))} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>Lock truck & trailer on journeys</div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>Driver uses office-assigned vehicle only. Change assignments here or turn off the lock to reassign from the journey form.</div>
                            </div>
                        </label>
                    </div>
                    <Field label="Status" k="status" options={["Active", "Inactive", "Suspended"]} form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    /* ── CUSTOMER ─────────────────────────────────────────────────── */
    if (modal === "customer") {
        const errors = {};
        errors.name = validators.required(form.name);
        if (!errors.name && !form.id && form.name) {
            const normalizedName = form.name.trim().toLowerCase();
            const existing = data.customers.find(c => c.name.trim().toLowerCase() === normalizedName);
            if (existing) errors.name = "A customer with this name already exists";
        }
        errors.phone = validators.required(form.phone) || validators.kenyaPhone(form.phone);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Customer" : "Add New Customer"} onSave={() => saveItem("customers", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Internal Unique Number</FormLabel>
                        <div style={{ ...S.inp, background: "var(--bg-surface)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || "AUTO-GENERATED ON SAVE"}
                        </div>
                    </div>
                    <Field label="Customer Type" k="type" options={["Company", "Individual"]} form={form} setForm={setForm} S={S} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label={form.type === "Company" ? "Company Name" : "Full Name"} k="name" full form={form} setForm={setForm} S={S} error={errors.name} />
                    </div>
                    {form.type === "Company" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <Field label="Contact Person" k="contactPerson" full form={form} setForm={setForm} S={S} placeholder="e.g. Procurement Officer" />
                        </div>
                    )}
                    <Field label="Phone Number" k="phone" form={form} setForm={setForm} S={S} error={errors.phone} />
                    <Field label="Email Address" k="email" type="email" form={form} setForm={setForm} S={S} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Physical Address" k="address" full form={form} setForm={setForm} S={S} />
                    </div>
                </div>
            </Modal>
        );
    }

    /* ── TRAILER ──────────────────────────────────────────────────── */
    if (modal === "trailer") {
        return (
            <Modal title={form.id ? "Edit Trailer" : "Add Trailer"} onSave={() => saveItem("trailers", form)} S={S} closeModal={closeModal}>
                <div style={modalGrid}>
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Internal Unique Number</FormLabel>
                        <div style={{ ...S.inp, background: "var(--bg-surface)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || "AUTO-GENERATED ON SAVE"}
                        </div>
                    </div>
                    <Field label="Registration No." k="reg" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Trailer Type" k="type" options={["Flatbed", "Skeleton", "Tanker", "Lowloader", "Box Body", "Refrigerated"]} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Manufacturer / Model" k="make" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Year" k="year" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status" k="status" options={["Active", "Maintenance", "Inactive"]} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Current Assigned Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    /* ── STAFF ────────────────────────────────────────────────────── */
    if (modal === "staff") {
        const toSegechaEmail = (rawEmail, fallbackName) => {
            const source = String(rawEmail || fallbackName || "").trim().toLowerCase();
            const local = (source.includes("@") ? source.split("@")[0] : source).replace(/[^a-z0-9._-]/g, ".").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
            return `${local || "staff"}@example.com`;
        };
        const isDrivingRole = form.role === "Driver" || form.role === "Turnboy";
        const getErrors = () => {
            const e = {};
            e.name = validators.required(form.name);
            e.role = validators.required(form.role);
            if (isDrivingRole) { e.phone = validators.required(form.phone) || validators.kenyaPhone(form.phone); e.mpesa = validators.required(form.mpesa) || validators.mpesa(form.mpesa); e.license = validators.required(form.license); }
            e.salary = validators.required(form.salary) || validators.positiveNumber(form.salary);
            return e;
        };
        const errors = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);
        const _S = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        const ROLES_LIST = _S.roles || ["Office Admin", "Fleet Manager", "Turnboy", "Accountant", "Operations", "Driver", "Other"];
        const DEPTS_LIST = _S.departments || ["Operations", "Finance", "Logistics", "HR"];

        const handleStaffSave = async () => {
            const isNew = !form.id;
            const name = form.name || "";
            const email = toSegechaEmail(form.email, name);
            const staffId = form.id || uid();
            let next = { ...form, id: staffId, email };
            if (isNew) { next = { ...next, firstLogin: true, otp: next.otp || Math.floor(100000 + Math.random() * 900000).toString(), tempPassword: next.tempPassword || "" }; }
            saveItem("staff", next);
            if (isNew && email.includes("@")) {
                try {
                    const res = await fetchWithAuth(`${PAYMENT_API}/api/staff/create-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: next.id, email, phone: next.phone, staffName: name }) });
                    const result = await res.json();
                    if (result.success) {
                        setCreationResult(result);
                        setData(prev => ({ ...prev, staff: (prev.staff || []).map(s => s.id === staffId ? { ...s, otp: result.otp, tempPassword: result.tempPassword } : s) }));
                        showToast?.("Staff account created successfully.", "success");
                    } else { showToast?.(`Account sync failed: ${result.error || "Server error"}`, "error"); }
                } catch (err) { console.warn("Staff account creation failed:", err.message); showToast?.("Account sync network error.", "error"); }
            } else { closeModal(); }
        };

        return (
            <Modal title={form.id ? "Edit Staff Member" : "Add Staff Member"} onSave={handleStaffSave} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                {creationResult ? (
                    <div style={{ padding: "4px 0" }}>
                        <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "var(--radius-md)", padding: 20, marginBottom: 20 }}>
                            <div style={{ color: "#059669", fontWeight: 800, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#059669" }} />
                                Account Ready For User
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>Provide these temporary credentials to the staff member. They must change their password on first login.</p>
                            <div style={{ display: "grid", gap: 12 }}>
                                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "12px 14px" }}>
                                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Login Email</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)" }}>{creationResult.email}</div>
                                </div>
                                {creationResult.tempPassword && (
                                    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "12px 14px" }}>
                                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Temporary Password</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{creationResult.tempPassword}</div>
                                    </div>
                                )}
                                {creationResult.otp && (
                                    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "12px 14px" }}>
                                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Mobile OTP</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", fontFamily: "var(--font-mono)" }}>{creationResult.otp}</div>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" style={{ width: "100%", marginTop: 16, border: "1px dashed var(--border-subtle)" }}
                                onClick={() => { const text = `Email: ${creationResult.email}${creationResult.tempPassword ? `\nPassword: ${creationResult.tempPassword}` : ""}${creationResult.otp ? `\nOTP: ${creationResult.otp}` : ""}`; navigator.clipboard.writeText(text); showToast?.("Credentials copied to clipboard", "success"); }}>
                                Copy All Credentials
                            </Button>
                        </div>
                        <Button variant="primary" style={{ width: "100%" }} onClick={closeModal}>Done</Button>
                    </div>
                ) : (
                    <div style={modalGrid}>
                        <div style={{ gridColumn: "1/-1" }}>
                            <FormLabel>Internal ID Number</FormLabel>
                            <div style={{ ...S.inp, background: "var(--bg-surface)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                                {form.uId || "AUTO-GENERATED ON SAVE"}
                            </div>
                        </div>

                        <SectionDivider title="Personal & Role" />
                        <div style={{ gridColumn: "1/-1" }}>
                            <Field label="Full Name" k="name" full form={form} setForm={setForm} S={S} T={T} error={errors.name} />
                        </div>
                        <Field label="Role / Title" k="role" options={ROLES_LIST} form={form} setForm={setForm} S={S} T={T} error={errors.role} />
                        <Field label="Department" k="department" options={DEPTS_LIST} form={form} setForm={setForm} S={S} T={T} />
                        <Field label="Phone Number" k="phone" placeholder={isDrivingRole ? "07XXXXXXXX" : undefined} form={form} setForm={setForm} S={S} T={T} error={errors.phone} />
                        <Field label="Email Address" k="email" type="email" placeholder="name@example.com" form={form} setForm={setForm} S={S} T={T} />

                        {isDrivingRole && (
                            <>
                                <SectionDivider title="Driver / Turnboy Details" />
                                <Field label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" form={form} setForm={setForm} S={S} T={T} error={errors.mpesa} />
                                <Field label="License No." k="license" form={form} setForm={setForm} S={S} T={T} error={errors.license} />
                                <div style={{ gridColumn: "1/-1" }}>
                                    <Field label="License Class" k="class" type="checkbox-group" options={licenceClasses} full form={form} setForm={setForm} S={S} T={T} />
                                </div>
                                <Field label="Assigned Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} T={T} />
                            </>
                        )}

                        <SectionDivider title="Employment" />
                        <Field label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.salary} />
                        <Field label="Date Joined" k="joined" type="date" form={form} setForm={setForm} S={S} T={T} />
                        <Field label="Status" k="status" options={["Active", "On Leave", "Inactive"]} form={form} setForm={setForm} S={S} T={T} />

                        {form.firstLogin && (
                            <div style={{ gridColumn: "1/-1", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius-md)", padding: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>One-Time Password (OTP)</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "0.2em" }}>{form.otp}</div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>Provide this to the employee for their initial login.</div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        );
    }

    /* ── TEMPLATE SELECTOR ────────────────────────────────────────── */
    if (modal === "templateSelector") {
        const { type, entityData } = form;
        const templatesList = (data.templates || []).filter(t => {
            if (type === "invoice") return t.category === "Finance" || t.category === "General";
            if (type === "staff") return t.category === "Staff" || t.category === "General";
            if (type === "journey") return t.category === "Operations" || t.category === "General";
            return true;
        });
        const selectedId = form._selectedTemplateId ?? templatesList[0]?.id ?? "";
        const template = templatesList.find((t) => t.id === selectedId);
        const filledSubject = props.fillTemplate(template?.subject || "", entityData || {});
        const filledBody = props.fillTemplate(template?.body || "", entityData || {});

        return (
            <Modal title="Send Message" onSave={() => { props.showToast("Message draft ready — complete send in your email/SMS app.", "success"); closeModal(); }} S={S} closeModal={closeModal} saveLabel="Done">
                <div style={{ display: "grid", gap: 16 }}>
                    <div>
                        <FormLabel>Select Template</FormLabel>
                        <select style={S.inp} value={selectedId} onChange={(e) => setForm((f) => ({ ...f, _selectedTemplateId: e.target.value }))}>
                            {templatesList.length === 0 ? (
                                <option value="">No templates — add some in Settings</option>
                            ) : (
                                templatesList.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)
                            )}
                        </select>
                    </div>
                    <div style={{ padding: 20, background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 12 }}>{filledSubject}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{filledBody}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        Customize templates in <b>Settings &gt; Message Templates</b>.
                    </div>
                </div>
            </Modal>
        );
    }

    return null;
}
