import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Field } from "./Field";
import { Button } from "./Button";
import { fmt, fmtDate, today, uid, monthLabel } from "../utils/formatters";
import { validators } from "../utils/validators";
import { PAYMENT_API } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import { DEFAULT_FUEL_PRICE, STATUSES_JOURNEY, CARGO_TYPES, TRUCK_TYPES, STATUSES_TRUCK, INVOICE_PREFIX, PAYMENT_TERMS_DAYS } from "../constants/nav";
import { getLicenceClasses, getCommonRoutes, subscribeSettings, readSettings } from "../utils/settingsStore.js";

/** Blur focused input then run save on the next microtask so number fields commit. */
function flushModalSave(fn) {
    document.activeElement?.blur?.();
    queueMicrotask(fn);
}

/* ─────────────────────────────────────────────────────────────────────
   Shared sub-components
───────────────────────────────────────────────────────────────────── */

function SectionDivider({ title }) {
    return (
        <div style={{
            gridColumn: "1/-1",
            display: "flex", alignItems: "center", gap: 10,
            margin: "12px 0 2px",
        }}>
            <span style={{
                fontSize: 10, fontWeight: 800, color: "var(--text-dim)",
                textTransform: "uppercase", letterSpacing: "0.09em", whiteSpace: "nowrap",
            }}>
                {title}
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>
    );
}

function FormLabel({ children, required }) {
    return (
        <label style={{
            display: "block",
            fontSize: 10, fontWeight: 700,
            color: "var(--text-dim)",
            textTransform: "uppercase", letterSpacing: "0.07em",
            marginBottom: 6,
        }}>
            {children}
            {required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
        </label>
    );
}

function InfoBox({ children, color = "var(--brand-primary)", icon }) {
    return (
        <div style={{
            gridColumn: "1/-1",
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "11px 14px",
            borderRadius: "var(--radius-md)",
            background: `${color}12`,
            border: `1px solid ${color}2e`,
            fontSize: 12, color, fontWeight: 600, lineHeight: 1.5,
        }}>
            {icon && <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>}
            <span>{children}</span>
        </div>
    );
}

/* Reusable styled input wrapper */
const fieldWrap = (full) => full ? { gridColumn: "1/-1" } : {};

/* Auto-generated ID display */
function AutoIdDisplay({ value, S }) {
    return (
        <div style={{ gridColumn: "1/-1" }}>
            <FormLabel>Internal ID</FormLabel>
            <div style={{
                ...S.inp,
                background: "var(--bg-main)",
                color: "var(--brand-primary)",
                fontWeight: 700, fontFamily: "var(--font-mono)",
                border: "1px dashed var(--brand-border)",
                display: "flex", alignItems: "center", padding: "0 14px", height: 38,
                borderRadius: "var(--radius-md)", fontSize: 12, opacity: 0.85,
            }}>
                {value || "AUTO-GENERATED ON SAVE"}
            </div>
        </div>
    );
}

/* Upload zone — dashed border, filename / preview when done */
function UploadZone({ label, hint, value, uploading, onUpload, onRemove, accept = "image/*", previewThumb = true }) {
    const done = !!value;
    const [dragOver, setDragOver] = useState(false);
    const openFile = (e) => {
        if (!value) return;
        // Data URLs can exceed browser navigation limits; render in a blank tab explicitly.
        if (String(value).startsWith("data:")) {
            e.preventDefault();
            const w = window.open("", "_blank", "noopener,noreferrer");
            if (!w) return;
            const isImage = /^data:image\//i.test(String(value));
            w.document.write(
                isImage
                    ? `<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;"><img src="${value}" style="max-width:100vw;max-height:100vh;" /></body></html>`
                    : `<html><body style="margin:0;"><iframe src="${value}" style="width:100vw;height:100vh;border:0;"></iframe></body></html>`
            );
            w.document.close();
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (uploading || done) return;
        const dropped = e.dataTransfer?.files?.[0];
        if (!dropped) return;
        onUpload?.({ target: { files: [dropped], value: "" } });
    };
    return (
        <div>
            <FormLabel>{label}</FormLabel>
            <label style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 6,
                minHeight: 70, borderRadius: "var(--radius-md)",
                border: `1.5px dashed ${dragOver ? "var(--brand-primary)" : uploading ? "var(--brand-primary)" : done ? "#10b981" : "var(--border-medium)"}`,
                background: dragOver ? "var(--brand-muted)" : done ? "rgba(16,185,129,0.04)" : uploading ? "var(--brand-muted)" : "var(--bg-main)",
                cursor: uploading ? "wait" : "pointer",
                padding: "12px 16px", textAlign: "center", transition: "border-color 0.15s",
            }}
                onDragOver={(e) => { e.preventDefault(); if (!uploading && !done) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                {uploading ? (
                    <span style={{ fontSize: 12, color: "var(--brand-primary)", fontWeight: 600 }}>Uploading…</span>
                ) : done ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        {previewThumb && (
                            <a href={value} target="_blank" rel="noreferrer" onClick={openFile}>
                                <div style={{ width: 36, height: 36, borderRadius: 6, background: `url(${value}) center/cover no-repeat`, border: "1px solid var(--border-subtle)", flexShrink: 0 }} />
                            </a>
                        )}
                        <div style={{ flex: 1, textAlign: "left" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>Uploaded</div>
                            <a href={value} target="_blank" rel="noreferrer" onClick={openFile} style={{ fontSize: 10, color: "var(--brand-primary)" }}>View file</a>
                        </div>
                        <button type="button" onClick={(e) => { e.preventDefault(); onRemove(); }}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                            Remove
                        </button>
                    </div>
                ) : (
                    <>
                        <span style={{ fontSize: 20, opacity: 0.4 }}>⬆</span>
                        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
                            {hint || "Click or drag file to upload"}
                        </span>
                    </>
                )}
                <input type="file" accept={accept} style={{ display: "none" }} onChange={onUpload} disabled={uploading || done} />
            </label>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────
   FuelPhotoField (preserves original upload logic, new shell)
───────────────────────────────────────────────────────────────────── */
const FuelPhotoField = ({ label, k, form, setForm }) => {
    const [uploading, setUploading] = useState(false);
    const photoUrl = form[k];

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/upload`, { method: "POST", body: fd });
            const d = await res.json();
            if (d?.success && d?.url) {
                setForm(f => ({ ...f, [k]: d.url }));
            } else {
                alert("Upload failed: " + (d?.error || "Unknown upload error"));
            }
        } catch (err) {
            alert("Upload error: " + err.message);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    return (
        <UploadZone
            label={label}
            hint={photoUrl ? "Change photo" : "Upload photo (required)"}
            value={photoUrl}
            uploading={uploading}
            onUpload={handleUpload}
            onRemove={() => setForm(f => ({ ...f, [k]: "" }))}
            accept="image/*"
        />
    );
};

/* ─────────────────────────────────────────────────────────────────────
   JourneyOdomPhotoField (preserves original upload logic, new shell)
───────────────────────────────────────────────────────────────────── */
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
        <UploadZone
            label={label}
            hint="Upload odometer photo (optional)"
            value={photoUrl}
            uploading={uploading}
            onUpload={handleUpload}
            onRemove={() => setForm(f => ({ ...f, [k]: "" }))}
            accept="image/*"
        />
    );
}

/* ─────────────────────────────────────────────────────────────────────
   Layout helpers
───────────────────────────────────────────────────────────────────── */
const grid2  = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" };
const gridFull = { display: "grid", gridTemplateColumns: "1fr", gap: "14px" };

/* Toggle-card checkbox */
function ToggleCard({ checked, onChange, title, subtitle, activeColor = "var(--brand-primary)" }) {
    return (
        <label style={{
            display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
            padding: "12px 14px", gridColumn: "1/-1",
            background: checked ? `${activeColor}0d` : "var(--bg-main)",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${checked ? activeColor + "44" : "var(--border-subtle)"}`,
            transition: "background 0.15s, border-color 0.15s",
        }}>
            <input type="checkbox" checked={checked} onChange={onChange}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: activeColor, flexShrink: 0 }} />
            <div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.45 }}>{subtitle}</div>}
            </div>
        </label>
    );
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────── */
export function GlobalModals(props) {
    const {
        modal, form, setForm, closeModal, saveItem, data, setData,
        S, T, dark, truckReg, isMobile,
        logMaintenance,
        showToast,
        openWaybillGenerator,
    } = props;
    const [creationResult, setCreationResult] = useState(null);
    const [journeyCustomerTarget, setJourneyCustomerTarget] = useState(null); // 'billing' | 'delivery' | null
    const [journeyCustomerForm, setJourneyCustomerForm] = useState({
        type: "Company",
        name: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
    });
    const [, bumpSettingsDerived] = useState(0);

    useEffect(() => subscribeSettings(() => bumpSettingsDerived((n) => n + 1)), []);
    useEffect(() => { setCreationResult(null); }, [modal]);

    const licenceClasses = getLicenceClasses();
    const commonRoutes = getCommonRoutes();

    if (!modal) return null;

    const modalGrid = isMobile ? gridFull : grid2;
    const toNum = (v) => Math.max(0, Number(v) || 0);
    const deriveInvoiceStatus = (amount, paid) => {
        const total = toNum(amount);
        const settled = toNum(paid);
        if (settled >= total && total > 0) return "Paid";
        if (settled > 0) return "Partial";
        return "Pending";
    };
    const buildJourneySchedulePayments = (journeyLike, fallbackDate = today()) => {
        const dep = toNum(journeyLike.depositAmount);
        const fin = toNum(journeyLike.finalPaymentAmount);
        const payments = [];
        if (dep > 0) {
            payments.push({
                id: uid().slice(0, 8),
                date: journeyLike.depositDate || fallbackDate,
                amount: dep,
                method: "Journey Deposit",
                ref: "",
                notes: "Synced from journey financial schedule",
                source: "journey-schedule",
            });
        }
        if (fin > 0) {
            payments.push({
                id: uid().slice(0, 8),
                date: journeyLike.finalPaymentDate || fallbackDate,
                amount: fin,
                method: "Journey Final Payment",
                ref: "",
                notes: "Synced from journey financial schedule",
                source: "journey-schedule",
            });
        }
        return payments;
    };

    const uploadViaAdminApi = async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/upload`, { method: "POST", body: fd });
        return res.json();
    };

    const uploadViaDriverApi = async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${PAYMENT_API}/api/driver/upload`, { method: "POST", body: fd });
        return res.json();
    };

    /* ═══════════════════════════════════════════════════════════════
       FUEL
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "fuel") {
        const errors = {};
        errors.litres   = validators.required(form.litres)   || validators.positiveNumber(form.litres);
        errors.pricePerL = validators.required(form.pricePerL) || validators.positiveNumber(form.pricePerL);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Fuel Entry" : "Log Fuel Fill-up"} onSave={() => flushModalSave(() => saveItem("fuel", form))} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <SectionDivider title="Fuel Entry" />

                    <Field label="Truck" k="truck"
                        options={data.trucks.map(t => ({ v: t.id, l: t.reg }))}
                        form={form} setForm={setForm} S={S}
                        onChange={(truckId) => {
                            const truck = data.trucks.find(t => t.id === truckId);
                            setForm(f => ({ ...f, truck: truckId, fuelType: truck?.fuelType || f.fuelType || '' }));
                        }}
                    />
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    {form.fuelType && (
                        <div style={{
                            gridColumn: "1/-1",
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", borderRadius: "var(--radius-md)",
                            background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)",
                            fontSize: 12,
                        }}>
                            <span style={{ fontSize: 16 }}>⛽</span>
                            <span style={{ color: "var(--text-secondary)" }}>
                                Fuel type for this vehicle: <strong style={{ color: "var(--text-primary)" }}>{form.fuelType}</strong>
                            </span>
                            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>Set on the vehicle — cannot be changed here</span>
                        </div>
                    )}
                    <Field label="Litres" k="litres" type="number" form={form} setForm={setForm} S={S} error={errors.litres} />
                    <Field label="Price per Litre (KES)" k="pricePerL" type="number" form={form} setForm={setForm} S={S} error={errors.pricePerL} />

                    {form.litres && form.pricePerL && (
                        <div style={{
                            gridColumn: "1/-1",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 16px",
                            borderRadius: "var(--radius-md)",
                            background: "rgba(249,115,22,0.06)",
                            border: "1px solid rgba(249,115,22,0.2)",
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Estimated cost</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--brand-primary)" }}>
                                {fmt(+form.litres * +form.pricePerL)}
                            </span>
                        </div>
                    )}

                    <SectionDivider title="Readings &amp; Assignment" />

                    <Field label="Station Name" k="station" form={form} setForm={setForm} S={S} />
                    <Field label="Odometer Reading (km)" k="odom" type="number" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Linked Journey" k="journey"
                            options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${fmtDate(j.date)})` }))]}
                            full form={form} setForm={setForm} S={S} />
                    </div>

                    <SectionDivider title="Verification Photos" />

                    <FuelPhotoField label="Pump Display"    k="photoPump"    form={form} setForm={setForm} S={S} T={T} />
                    <FuelPhotoField label="Fuel Receipt"    k="photoReceipt" form={form} setForm={setForm} S={S} T={T} />
                    <FuelPhotoField label="Truck Odometer"  k="photoOdom"    form={form} setForm={setForm} S={S} T={T} />

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       EXPENSE
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "expense") {
        const errors = {};
        errors.amount = validators.required(form.amount) || validators.positiveNumber(form.amount);
        const hasErrors = Object.values(errors).some(Boolean);
        const CATS = ["Maintenance", "Toll", "Permit", "Tyre", "Salary", "Allowance", "Other"];

        return (
            <Modal title={form.id ? "Edit Expense" : "Add New Expense"} onSave={() => flushModalSave(() => saveItem("expenses", form))} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <SectionDivider title="Expense Details" />

                    <div>
                        <FormLabel>Category</FormLabel>
                        <select style={S.inp} value={form.cat || ""}
                            onChange={e => setForm(f => ({ ...f, cat: e.target.value, subCat: "" }))}>
                            <option value="">Select…</option>
                            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {form.cat && (
                        <Field
                            label={`${form.cat} Type`}
                            k="subCat"
                            options={
                                form.cat === "Maintenance" ? ["General Service", "Oil Change", "Brakes", "Tyres", "Engine", "Electrical", "Suspension", "Bodywork", "Other"] :
                                form.cat === "Toll"        ? ["Highways", "Weighbridge", "Local Councils"] :
                                form.cat === "Permit"      ? ["Insurance", "Speed Governor", "Inspection", "NTSA/TLB"] :
                                ["General", "Specific Repair", "Mission Expense", "Other"]
                            }
                            form={form} setForm={setForm} S={S}
                        />
                    )}

                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} error={errors.amount} />
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Description" k="desc" full form={form} setForm={setForm} S={S} placeholder="e.g. Workshop repair, Toll fee…" />
                    </div>

                    <SectionDivider title="Assignment" />

                    <Field label="Truck / Vehicle" k="truck"
                        options={data.trucks.map(t => ({ v: t.id, l: t.reg }))}
                        form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field
                            label="Linked Journey"
                            k="journey"
                            options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${fmtDate(j.date)})` }))]}
                            full
                            form={form}
                            setForm={setForm}
                            S={S}
                            onChange={(journeyId) => {
                                setForm((f) => {
                                    const next = { ...f, journey: journeyId };
                                    if (!journeyId) return next;
                                    const j = data.journeys.find((x) => x.id === journeyId);
                                    if (!j) return next;
                                    if (j.driver) next.driver = j.driver;
                                    if (j.truck && !f.truck) next.truck = j.truck;
                                    return next;
                                });
                            }}
                        />
                    </div>

                    {(form.cat === "Allowance" || form.cat === "Salary") && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <Field
                                label={form.cat === "Salary" ? "Paid to (driver)" : "Allowance recipient (driver)"}
                                k="driver"
                                options={data.drivers.map((dr) => ({ v: dr.id, l: dr.name }))}
                                full
                                form={form}
                                setForm={setForm}
                                S={S}
                            />
                            {form.cat === "Allowance" && (
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.45 }}>
                                    Link a journey above to auto-fill this driver (and truck if empty), or pick the driver manually so the amount appears on their Financials ledger.
                                </div>
                            )}
                        </div>
                    )}

                    <InfoBox color="var(--brand-primary)" icon="ℹ">
                        Expenses linked to a journey are factored into that journey's P&amp;L automatically.
                    </InfoBox>

                    <SectionDivider title="Receipt" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FuelPhotoField label="Receipt / Invoice Photo" k="receiptUrl" form={form} setForm={setForm} S={S} T={T} />
                    </div>

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       INVOICE
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "invoice") {
        const errors = {};
        errors.amount = validators.required(form.amount) || validators.positiveNumber(form.amount);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Invoice" : "Generate New Invoice"} onSave={() => flushModalSave(() => {
                const amount = toNum(form.amount);
                const paidAmount = toNum(form.paidAmount);
                const normalized = {
                    ...form,
                    id: form.id || (INVOICE_PREFIX + "-" + uid().slice(0, 5)),
                    amount,
                    paidAmount,
                    status: deriveInvoiceStatus(amount, paidAmount),
                };
                saveItem("invoices", normalized);
            })} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <SectionDivider title="Invoice Details" />

                    <Field label="Customer" k="customerId"
                        options={data.customers.map(c => ({ v: c.id, l: c.name }))}
                        form={form} setForm={setForm} S={S} />
                    <Field label="Linked Journey" k="journey"
                        options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${fmtDate(j.date)})` }))]}
                        form={form} setForm={setForm} S={S} />
                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} error={errors.amount} />

                    {form.amount && (
                        <div style={{
                            gridColumn: "1/-1",
                            display: "flex", gap: 24, flexWrap: "wrap",
                            padding: "12px 16px",
                            borderRadius: "var(--radius-md)",
                            background: "rgba(56,189,248,0.05)",
                            border: "1px solid rgba(56,189,248,0.18)",
                        }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Subtotal</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--brand-primary)" }}>{fmt(Math.round(+form.amount / 1.16))}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>VAT 16%</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{fmt(+form.amount - Math.round(+form.amount / 1.16))}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Total</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>{fmt(+form.amount)}</div>
                            </div>
                        </div>
                    )}

                    <SectionDivider title="Payment Terms" />

                    <Field label="Date Issued" k="issued" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Due Date"    k="due"    type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Status" k="status" options={["Pending", "Paid", "Overdue", "Partial"]} form={form} setForm={setForm} S={S} />
                    <Field label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                    </div>

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       LOG PAYMENT
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "logPayment") {
        return (
            <Modal title={`Log Payment — ${form.invoiceId}`} onSave={() => flushModalSave(() => {
                const inv = data.invoices.find((i) => i.id === form.invoiceId);
                if (!inv) return;
                const payment = {
                    id: uid().slice(0, 8),
                    date: form.date || today(),
                    amount: Number(form.amount) || 0,
                    method: form.method || "",
                    ref: form.ref || "",
                    notes: form.notes || "",
                };
                const newPayments = [...(inv.payments || []), payment];
                const newPaidAmount = newPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
                const amt = Number(inv.amount || 0);
                const newStatus = deriveInvoiceStatus(amt, newPaidAmount);
                const invEmail = (inv.email || "").trim();
                saveItem("invoices", {
                    ...inv,
                    paidAmount: newPaidAmount,
                    status: newStatus,
                    payments: newPayments,
                    paidDate: newStatus === "Paid" ? (form.date || today()) : inv.paidDate,
                }, {
                    onSynced: (ok) => {
                        if (ok === false || !PAYMENT_API || !invEmail || !payment.method) return;
                        const s = readSettings();
                        fetchWithAuth(`${PAYMENT_API}/api/invoices/send-receipt`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                invoiceId: inv.id,
                                payment,
                                settings: s,
                            }),
                        }).catch((err) => console.warn("Receipt email failed:", err.message));
                    },
                });
                const linkedJourneyId = inv.journey || inv.journeyId;
                if (linkedJourneyId) {
                    const linkedJourney = data.journeys.find((j) => j.id === linkedJourneyId);
                    if (linkedJourney) {
                        const journeyRevenue = toNum(linkedJourney.revenue);
                        const boundedPaid = Math.min(journeyRevenue, toNum(newPaidAmount));
                        const syncedDeposit = Math.min(toNum(linkedJourney.depositAmount), boundedPaid);
                        const syncedFinal = Math.max(0, boundedPaid - syncedDeposit);
                        saveItem("journeys", {
                            ...linkedJourney,
                            depositAmount: syncedDeposit,
                            finalPaymentAmount: syncedFinal,
                        }, { skipClose: true, silent: true });
                    }
                }
            })} S={S} closeModal={closeModal}>
                <div style={modalGrid}>

                    <SectionDivider title="Payment Details" />

                    <Field label="Payment Date"   k="date"   type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Amount (KES)"   k="amount" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Payment Method" k="method" options={["M-Pesa", "Bank Transfer", "Cheque", "Cash"]} form={form} setForm={setForm} S={S} />
                    <Field label="Reference No."  k="ref"    placeholder="e.g. QJK1234567" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                    </div>

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       PAYROLL
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "payroll") {
        const errors = {};
        errors.baseSalary = validators.required(form.baseSalary) || validators.positiveNumber(form.baseSalary);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Pay Record" : "Add New Pay Record"} onSave={() => flushModalSave(() => saveItem("payroll", form))} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <SectionDivider title="Employee" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Employee / Driver" k="driver" options={[
                            ...data.drivers.map(d => ({ v: d.id, l: `Driver: ${d.name}` })),
                            ...(data.staff    || []).map(s => ({ v: s.id, l: `Staff: ${s.name}` })),
                            ...(data.turnboys || []).map(t => ({ v: t.id, l: `Turnboy: ${t.name}` })),
                        ]} form={form} setForm={setForm} S={S} />
                    </div>

                    <div>
                        <FormLabel>Payment Month</FormLabel>
                        <input type="month" className="input-premium" value={form.month || ""}
                            onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                            style={{ height: 38, width: "100%" }} />
                    </div>

                    <SectionDivider title="Pay Components" />

                    <Field label="Base Salary (KES)"  k="baseSalary"  type="number" form={form} setForm={setForm} S={S} error={errors.baseSalary} />
                    <Field label="Allowances (KES)"   k="allowance"   type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Deductions (KES)"   k="deductions"  type="number" form={form} setForm={setForm} S={S} />

                    {/* Net disbursement banner */}
                    <div style={{
                        gridColumn: "1/-1",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 18px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(16,185,129,0.06)",
                        border: "1px solid rgba(16,185,129,0.2)",
                    }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>Net Disbursement</span>
                        <span style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>
                            {fmt((+form.baseSalary || 0) + (+form.allowance || 0) - (+form.deductions || 0))}
                        </span>
                    </div>

                    <SectionDivider title="Payment Status" />

                    <Field label="Status"     k="status"   options={["Pending", "Paid"]} form={form} setForm={setForm} S={S} />
                    <Field label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. PAY1234567" form={form} setForm={setForm} S={S} />
                    <Field label="Date Paid"  k="paidDate" type="date" form={form} setForm={setForm} S={S} />

                    {/* Mileage summary */}
                    {form.driver && form.month && (
                        <div style={{
                            gridColumn: "1/-1",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            background: "var(--bg-main)",
                            padding: "14px 16px",
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                                Mission Summary — {monthLabel(form.month)}
                            </div>
                            {(() => {
                                const drvJourneys = data.journeys.filter(j => j.driver === form.driver && j.date?.startsWith(form.month) && j.status === "Completed");
                                const totalMileage = drvJourneys.reduce((s, j) => s + (j.driverMileage || 0), 0);
                                if (drvJourneys.length === 0) {
                                    return <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No completed journeys found for this period.</div>;
                                }
                                return (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-primary)" }}>{fmt(totalMileage)} Mileage KES</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>From {drvJourneys.length} mission(s)</div>
                                        </div>
                                        <Button size="sm" variant="ghost"
                                            onClick={(e) => { e.preventDefault(); setForm(f => ({ ...f, allowance: totalMileage })); }}
                                            style={{ border: "1px solid var(--brand-primary)", color: "var(--brand-primary)", fontSize: 11 }}>
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

    /* ═══════════════════════════════════════════════════════════════
       JOURNEY
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "journey") {
        const errors = {};
        // Revenue: 0 allowed for empty return; loaded / revenue journeys must be > 0
        errors.revenue = form.returningEmpty
            ? validators.nonNegativeNumber(form.revenue)
            : validators.required(form.revenue) || validators.positiveNumber(form.revenue);
        errors.endDate  = validators.dateOrder(form.date, form.endDate);
        if (form.isInternational && form.returningEmpty) {
            errors.journeyType = "International journey and empty return cannot be selected together.";
        }
        if (form.isInternational) {
            errors.tr8Url = validators.required(form.tr8Url);
            errors.bookingRef = validators.required(form.bookingRef);
        }
        if (!form.returningEmpty) {
            errors.customerId         = validators.required(form.customerId);
            errors.deliveryCustomerId = validators.required(form.deliveryCustomerId);
        }
        const hasErrors = Object.values(errors).some(Boolean);

        const _S = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        const DRIVER_PER_KM   = _S.driverPerKm  != null ? +_S.driverPerKm  : 10;
        const TURNBOY_PER_KM  = _S.turnboyPerKm != null ? +_S.turnboyPerKm : 6;
        const ROUTE_OVERRIDES = _S.routeOverrides || {};

        const selectedDriver = data.drivers.find((d) => d.id === form.driver);
        const vehicleLocked  = !!selectedDriver?.lockVehicleAssignment;
        const selectedTruck = data.trucks.find((t) => t.id === form.truck);
        const selectedTrailer = (data.trailers || []).find((t) => t.id === form.trailer);
        const truckPayloadKg = Number(selectedTruck?.capacity) || 0;
        const trailerPayloadKg = Number(selectedTrailer?.capacity) || 0;
        const truckTareKg = Number(selectedTruck?.tareWeightKg) || 0;
        const trailerTareKg = Number(selectedTrailer?.tareWeightKg) || 0;
        const truckAxles = Number(selectedTruck?.axleCount) || 0;
        const trailerAxles = Number(selectedTrailer?.axleCount) || 0;
        const totalAxles = truckAxles + trailerAxles;
        // Kenya legal gross rule requested by user: 5 axles => 44,000kg; 6+ => 48,000kg (safety baseline).
        const legalGrossLimitKg = totalAxles === 5 ? 44000 : totalAxles >= 6 ? 48000 : 0;
        const totalTareKg = truckTareKg + trailerTareKg;
        const legalPayloadFromGrossKg = legalGrossLimitKg > 0 ? Math.max(legalGrossLimitKg - totalTareKg, 0) : 0;
        const manufacturerPayloadLimitKg = truckPayloadKg && trailerPayloadKg
            ? Math.min(truckPayloadKg, trailerPayloadKg)
            : (trailerPayloadKg || truckPayloadKg || 0);
        const effectivePayloadKg = legalPayloadFromGrossKg && manufacturerPayloadLimitKg
            ? Math.min(legalPayloadFromGrossKg, manufacturerPayloadLimitKg)
            : (legalPayloadFromGrossKg || manufacturerPayloadLimitKg || 0);
        const enteredCargoKg = Number(form.weight) || 0;
        const isOverPayload = enteredCargoKg > 0 && effectivePayloadKg > 0 && enteredCargoKg > effectivePayloadKg;
        const overPayloadByKg = isOverPayload ? (enteredCargoKg - effectivePayloadKg) : 0;

        const getEffectiveRates = (origin, dest) => {
            if (!origin || !dest) return { driver: DRIVER_PER_KM, turnboy: TURNBOY_PER_KM };
            const isReturning     = !!form.returningEmpty;
            const isInternational = !!form.isInternational;
            const routeOverridesArr = Array.isArray(ROUTE_OVERRIDES) ? ROUTE_OVERRIDES : Object.entries(ROUTE_OVERRIDES || {}).map(([key, val]) => {
                const [o, d] = key.split("→");
                return { origin: o, dest: d, driverRate: val.driver, turnboyRate: val.turnboy, returnDriverRate: val.returnDriver, returnTurnboyRate: val.returnTurnboy };
            });
            const override = routeOverridesArr.find(ro =>
                (ro.origin?.trim() === origin?.trim() && ro.dest?.trim() === dest?.trim()) ||
                (ro.origin?.trim() === dest?.trim()   && ro.dest?.trim() === origin?.trim())
            );
            let dRate, tRate, isFlatRate = false;
            if (override) {
                dRate = isReturning && override.returnDriverRate != null ? +override.returnDriverRate : +override.driverRate;
                tRate = isReturning && override.returnTurnboyRate != null ? +override.returnTurnboyRate : +override.turnboyRate;
            } else {
                const flatDriver  = isInternational ? (_S.flatRateOutsideDriver  || 0) : (_S.flatRateInsideDriver  || 0);
                const flatTurnboy = isInternational ? (_S.flatRateOutsideTurnboy || 0) : (_S.flatRateInsideTurnboy || 0);
                if (flatDriver > 0) { dRate = flatDriver; tRate = flatTurnboy; isFlatRate = true; }
                else { dRate = DRIVER_PER_KM; tRate = TURNBOY_PER_KM; }
            }
            const rua = isReturning ? (_S.roadUserAllowanceReturn || _S.roadUserAllowance || 0) : (_S.roadUserAllowance || 0);
            return { driver: dRate, turnboy: tRate, isOverride: !!override, isFlatRate, roadUserAllowance: rua, routeKey: `${origin.trim()}→${dest.trim()}` };
        };

        const onSave = () => flushModalSave(() => {
            if (form.isInternational && form.returningEmpty) {
                showToast?.("Choose either international journey or empty return — not both.", "error");
                return;
            }
            if (!form.returningEmpty && (!form.customerId || !form.deliveryCustomerId)) {
                showToast?.("Billing customer and delivery customer are required.", "error");
                return;
            }
            if (form.isInternational && (!form.tr8Url || !form.bookingRef)) {
                showToast?.("TR8 form and booking reference are required for international journeys.", "error");
                return;
            }
            if (isOverPayload) {
                const proceed = window.confirm(
                    `Overload warning: cargo is ${enteredCargoKg.toLocaleString()} kg, which exceeds the configured vehicle limit (${effectivePayloadKg.toLocaleString()} kg) by ${overPayloadByKg.toLocaleString()} kg.\n\nSave journey anyway?`
                );
                if (!proceed) return;
            }
            const wasNew = !form.id;
            const dist   = +form.distance || 0;
            const rates  = getEffectiveRates(form.origin, form.dest);
            const driverMileage  = rates.isFlatRate ? rates.driver  : Math.round(dist * rates.driver);
            const turnboyMileage = (form.turnboyId || form.turnboyName) ? (rates.isFlatRate ? rates.turnboy : Math.round(dist * rates.turnboy)) : 0;
            const roadUserAllowance = rates.roadUserAllowance || 0;
            const revenueAmount = Math.max(0, Number(form.revenue) || 0);
            const depositAmount = Math.max(0, Number(form.depositAmount) || 0);
            const finalPaymentAmount = Math.max(0, Number(form.finalPaymentAmount) || Math.max(0, revenueAmount - depositAmount));
            const enrichedForm = {
                ...form,
                id: form.id || uid(),
                revenue: revenueAmount,
                depositAmount,
                finalPaymentAmount,
                driverMileage,
                turnboyMileage,
                roadUserAllowance,
                mileageRateUsed: rates.driver,
                turnboyMileageRateUsed: rates.turnboy,
                mileageRouteOverride: rates.isOverride,
                isFlatRate: rates.isFlatRate,
            };
            saveItem("journeys", enrichedForm, { skipClose: true, silent: true });
            const ensureJourneyDocument = (url, docType, label) => {
                if (!url) return;
                const exists = (data.documents || []).some((doc) => {
                    const entityType = doc.entityType || doc.entity_type;
                    const entityId = doc.entityId || doc.entity_id;
                    const existingDocType = doc.docType || doc.doc_type;
                    return entityType === "journey" && entityId === enrichedForm.id && existingDocType === docType && doc.url === url;
                });
                if (exists) return;
                saveItem("documents", {
                    id: uid(),
                    entityType: "journey",
                    entityId: enrichedForm.id,
                    docType,
                    label,
                    url,
                    uploadedBy: "admin",
                    uploadedAt: new Date().toISOString(),
                }, { skipClose: true, silent: true });
            };
            ensureJourneyDocument(enrichedForm.tr8Url, "tr8_form", "TR8 Transit Form");
            ensureJourneyDocument(enrichedForm.t1Url, "t1_form", "T1 Transit Form");

            if (driverMileage > 0 && !form.id) {
                const descPrefix = rates.isFlatRate ? "Flat rate allowance" : `Mileage allowance (${dist} km @ KES ${rates.driver}/km)`;
                saveItem("expenses", { date: form.date || today(), truck: form.truck, driver: form.driver || "", cat: "Allowance", category: "Allowance", amount: driverMileage, desc: `Driver ${descPrefix} — ${form.origin} → ${form.dest}`, journey: enrichedForm.id, status: "Unpaid" }, { skipClose: true, silent: true });
            }
            if (turnboyMileage > 0 && !form.id && (form.turnboyId || form.turnboyName)) {
                const tbName     = form.turnboyId ? (data.turnboys?.find(t => t.id === form.turnboyId)?.name || form.turnboyId) : form.turnboyName;
                const descPrefix = rates.isFlatRate ? "Flat rate allowance" : `Mileage allowance (${dist} km @ KES ${rates.turnboy}/km)`;
                saveItem("expenses", { date: form.date || today(), truck: form.truck, driver: form.turnboyId || "", cat: "Allowance", category: "Allowance", amount: turnboyMileage, desc: `Turnboy ${descPrefix} (${tbName}) — ${form.origin} → ${form.dest}`, journey: enrichedForm.id, status: "Unpaid" }, { skipClose: true, silent: true });
            }
            if (roadUserAllowance > 0 && !form.id) {
                saveItem("expenses", { date: form.date || today(), truck: form.truck, driver: form.driver || "", cat: "Allowance", category: "Allowance", amount: roadUserAllowance, desc: `Road User Allowance${form.returningEmpty ? " (Return)" : ""} — ${form.origin} → ${form.dest}`, journey: enrichedForm.id, status: "Unpaid" }, { skipClose: true, silent: true });
            }
            if (!form.returningEmpty && (enrichedForm.status === "Accepted" || enrichedForm.status === "Loading" || enrichedForm.status === "In Transit" || enrichedForm.status === "Completed")) {
                const existingInvoice = data.invoices?.find(inv => (inv.journey || inv.journeyId) === enrichedForm.id);
                const issuedDate = today();
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + (PAYMENT_TERMS_DAYS || 14));
                const dueDateStr = dueDate.toISOString().split("T")[0];
                const billingCust = data.customers.find(c => c.id === form.customerId);
                const schedulePayments = buildJourneySchedulePayments(enrichedForm, issuedDate);
                const manualPayments = (existingInvoice?.payments || []).filter((p) => p?.source !== "journey-schedule");
                const mergedPayments = [...manualPayments, ...schedulePayments];
                const paidAmount = mergedPayments.reduce((s, p) => s + toNum(p.amount), 0);
                const nextInvoice = {
                    ...(existingInvoice || {}),
                    id: existingInvoice?.id || (INVOICE_PREFIX || "INV") + "-" + uid().slice(0, 5),
                    customerId: form.customerId,
                    client: billingCust?.name || "",
                    phone: billingCust?.phone || "",
                    email: billingCust?.email || existingInvoice?.email || "",
                    journey: enrichedForm.id,
                    amount: enrichedForm.revenue,
                    issued: existingInvoice?.issued || issuedDate,
                    due: existingInvoice?.due || dueDateStr,
                    paidAmount,
                    payments: mergedPayments,
                    status: deriveInvoiceStatus(enrichedForm.revenue, paidAmount),
                    notes: `Automated invoice for journey ${enrichedForm.origin} → ${enrichedForm.dest}. Cargo: ${enrichedForm.cargo || "N/A"}`,
                };
                saveItem("invoices", nextInvoice, { skipClose: true, silent: true });
                if (!existingInvoice) showToast?.(`Invoice ${nextInvoice.id} generated automatically.`, "success");
            }
            showToast?.("Record saved", "success");
            closeModal();
            if (wasNew && openWaybillGenerator && (enrichedForm.status === "Loading" || enrichedForm.status === "In Transit")) {
                if (window.confirm("Generate a road freight waybill for this journey? You can complete carrier, cargo, and customs details, then print four copies.")) {
                    openWaybillGenerator(enrichedForm);
                }
            }
        });

        const journeyCustomerErrors = {
            name: validators.required(journeyCustomerForm.name),
            phone: validators.required(journeyCustomerForm.phone) || validators.kenyaPhone(journeyCustomerForm.phone),
        };
        const hasJourneyCustomerErrors = Object.values(journeyCustomerErrors).some(Boolean);
        const saveJourneyCustomer = () => flushModalSave(() => {
            if (hasJourneyCustomerErrors) return;
            const normalizedName = journeyCustomerForm.name.trim().toLowerCase();
            const existing = (data.customers || []).find((c) => c.name?.trim().toLowerCase() === normalizedName);
            const customerId = existing?.id || uid();
            if (!existing) {
                saveItem("customers", {
                    id: customerId,
                    type: journeyCustomerForm.type || "Company",
                    name: journeyCustomerForm.name?.trim(),
                    contactPerson: journeyCustomerForm.contactPerson?.trim() || "",
                    phone: journeyCustomerForm.phone?.trim() || "",
                    email: journeyCustomerForm.email?.trim() || "",
                    address: journeyCustomerForm.address?.trim() || "",
                    status: "Active",
                }, { skipClose: true, silent: true });
            }
            setForm((f) => ({
                ...f,
                ...(journeyCustomerTarget === "billing"
                    ? { customerId }
                    : { deliveryCustomerId: customerId }),
            }));
            setJourneyCustomerTarget(null);
            showToast?.(existing ? "Customer selected." : "Customer created and selected.", "success");
        });

        return (
            <>
                <Modal title={form.id ? "Edit Journey" : "Log New Journey"} onSave={onSave} S={S} closeModal={closeModal} saveDisabled={hasErrors} wide>
                    <div style={modalGrid}>

                    {/* Quick route selector */}
                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Quick Route</FormLabel>
                        <select style={S.inp} onChange={e => {
                            const route = commonRoutes.find(r => `${r.origin}→${r.dest}` === e.target.value);
                            if (route) setForm(f => ({ ...f, origin: route.origin, dest: route.dest, distance: route.distance }));
                        }} defaultValue="">
                            <option value="">— Select a common route or fill in manually below —</option>
                            {commonRoutes.map(r => (
                                <option key={`${r.origin}→${r.dest}`} value={`${r.origin}→${r.dest}`}>
                                    {r.origin} → {r.dest} ({r.distance} km)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ── ROUTE & SCHEDULE ── */}
                    <SectionDivider title="Route &amp; Schedule" />

                    <Field label="Origin"      k="origin" form={form} setForm={setForm} S={S} />
                    <Field label="Destination" k="dest"   form={form} setForm={setForm} S={S} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Pickup Address"   k="pickupAddress"   full form={form} setForm={setForm} S={S} placeholder="Specific location at origin…" />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Delivery Address" k="deliveryAddress" full form={form} setForm={setForm} S={S} placeholder="Specific unloading point…" />
                    </div>
                    <Field label="Departure Date" k="date"    type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Arrival Date"   k="endDate" type="date" form={form} setForm={setForm} S={S} error={errors.endDate} />

                    {/* Journey type toggles — international vs empty return are mutually exclusive */}
                    <ToggleCard
                        checked={!!form.isInternational}
                        onChange={e => {
                            const checked = e.target.checked;
                            setForm((f) => ({
                                ...f,
                                isInternational: checked,
                                ...(checked ? { returningEmpty: false } : {}),
                            }));
                        }}
                        title="International journey"
                        subtitle="Outside Kenya. International flat rates and cross-border documents apply."
                        activeColor="var(--brand-primary)"
                    />
                    <ToggleCard
                        checked={!!form.returningEmpty}
                        onChange={e => {
                            const checked = e.target.checked;
                            setForm((f) => ({
                                ...f,
                                returningEmpty: checked,
                                ...(checked ? { isInternational: false } : {}),
                                customerId: checked ? "" : f.customerId,
                                deliveryCustomerId: checked ? "" : f.deliveryCustomerId,
                            }));
                        }}
                        title="Empty return (no load / no revenue)"
                        subtitle="Deadhead leg — return mileage rates and road-user allowance; revenue may be 0."
                        activeColor="#f59e0b"
                    />
                    {errors.journeyType && (
                        <div style={{ gridColumn: "1/-1", fontSize: 12, fontWeight: 600, color: "#b91c1c", padding: "8px 12px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)" }}>
                            {errors.journeyType}
                        </div>
                    )}

                    {/* ── ASSIGNMENT ── */}
                    <SectionDivider title="Assignment" />

                    <div>
                        <FormLabel>
                            Truck
                            {vehicleLocked && (
                                <span style={{ fontWeight: 600, color: "var(--text-dim)", marginLeft: 8, fontSize: 10, textTransform: "none" }}>(locked for driver)</span>
                            )}
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
                        <select style={S.inp} value={form.trailer || ""}
                            onChange={(e) => setForm((f) => ({ ...f, trailer: e.target.value }))}>
                            <option value="">Select…</option>
                            {(data.trailers || []).map((t) => <option key={t.id} value={t.id}>{t.reg} ({t.type})</option>)}
                        </select>
                    </div>

                    <Field label="Driver" k="driver"
                        options={data.drivers.map((d) => ({ v: d.id, l: d.name }))}
                        form={form} setForm={setForm} S={S}
                        onChange={(driverId) => {
                            const drv = data.drivers.find((d) => d.id === driverId);
                            setForm((f) => {
                                const next = { ...f, driver: driverId };
                                if (drv?.lockVehicleAssignment) {
                                    next.truck   = drv.truck || "";
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

                    <JourneyOdomPhotoField label="Start Odometer" k="adminStartOdomPhotoUrl" form={form} setForm={setForm} S={S} T={T} />
                    <JourneyOdomPhotoField label="End Odometer"   k="adminEndOdomPhotoUrl"   form={form} setForm={setForm} S={S} T={T} />

                    {/* ── DOCUMENTS (TR8) ── */}
                    {form.isInternational && (
                        <>
                            <SectionDivider title="Documents" />
                            <InfoBox color="var(--brand-primary)" icon="📄">
                                TR8 Transit Document is required for all international journeys. Upload a PDF or image below.
                            </InfoBox>
                            <div style={{ gridColumn: "1/-1" }}>
                                <Field
                                    label="Booking Reference Number"
                                    k="bookingRef"
                                    full
                                    form={form}
                                    setForm={setForm}
                                    S={S}
                                    placeholder="Required for international journey"
                                    error={errors.bookingRef}
                                />
                            </div>
                            <div style={{ gridColumn: "1/-1" }}>
                                <FormLabel>TR8 Transit Form</FormLabel>
                                <label style={{
                                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                                    minHeight: 80, borderRadius: "var(--radius-md)",
                                    border: `1.5px dashed ${form.tr8Uploading ? "var(--brand-primary)" : form.tr8Url ? "#10b981" : "var(--border-medium)"}`,
                                    background: form.tr8Url ? "rgba(16,185,129,0.04)" : form.tr8Uploading ? "var(--brand-muted)" : "var(--bg-main)",
                                    cursor: form.tr8Uploading ? "wait" : "pointer",
                                    padding: "16px", textAlign: "center",
                                }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        const file = e.dataTransfer?.files?.[0];
                                        if (!file || form.tr8Uploading) return;
                                        setForm(f => ({ ...f, tr8Uploading: true }));
                                        try {
                                            const result = await uploadViaAdminApi(file);
                                            if (result.success) setForm(f => ({ ...f, tr8Url: result.url, tr8Uploading: false }));
                                            else { alert(result.error); setForm(f => ({ ...f, tr8Uploading: false })); }
                                        } catch (err) { alert(err.message); setForm(f => ({ ...f, tr8Uploading: false })); }
                                    }}
                                >
                                    {form.tr8Uploading ? (
                                        <span style={{ fontSize: 13, color: "var(--brand-primary)", fontWeight: 600 }}>Uploading TR8…</span>
                                    ) : form.tr8Url ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                                            <span style={{ fontSize: 20 }}>✅</span>
                                            <div style={{ flex: 1, textAlign: "left" }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>TR8 uploaded</div>
                                                <a href={form.tr8Url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--brand-primary)", fontWeight: 600 }}>View document</a>
                                            </div>
                                            <button type="button" onClick={() => setForm(f => ({ ...f, tr8Url: "" }))}
                                                style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: 22, opacity: 0.4 }}>⬆</span>
                                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Upload TR8 transit form (PDF or image)</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*,.pdf" style={{ display: "none" }} disabled={form.tr8Uploading}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            setForm(f => ({ ...f, tr8Uploading: true }));
                                            try {
                                                const result = await uploadViaAdminApi(file);
                                                if (result.success) setForm(f => ({ ...f, tr8Url: result.url, tr8Uploading: false }));
                                                else { alert(result.error); setForm(f => ({ ...f, tr8Uploading: false })); }
                                            } catch (err) { alert(err.message); setForm(f => ({ ...f, tr8Uploading: false })); }
                                            e.target.value = "";
                                        }} />
                                </label>
                                {errors.tr8Url && <p style={{ color: "#DC2626", fontSize: 11, marginTop: 6 }}>TR8 transit form is required for international journeys.</p>}
                            </div>
                        </>
                    )}

                    {/* ── T1 FORM (Local journeys only — optional) ── */}
                    {!form.isInternational && (
                        <>
                            <SectionDivider title="Documents (Optional)" />
                            <InfoBox color="#6366f1" icon="📋">
                                T1 Transit Form — used for goods moving within Kenya. This is optional but recommended when transiting through controlled or border-adjacent areas.
                            </InfoBox>
                            <div style={{ gridColumn: "1/-1" }}>
                                <FormLabel>T1 Transit Form (PDF or image)</FormLabel>
                                <label style={{
                                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                                    minHeight: 80, borderRadius: "var(--radius-md)",
                                    border: `1.5px dashed ${form.t1Uploading ? "var(--brand-primary)" : form.t1Url ? "#10b981" : "var(--border-medium)"}`,
                                    background: form.t1Url ? "rgba(16,185,129,0.04)" : form.t1Uploading ? "var(--brand-muted)" : "var(--bg-main)",
                                    cursor: form.t1Uploading ? "wait" : "pointer",
                                    padding: "16px", textAlign: "center", transition: "border-color 0.15s",
                                }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        const file = e.dataTransfer?.files?.[0];
                                        if (!file || form.t1Uploading) return;
                                        setForm(f => ({ ...f, t1Uploading: true }));
                                        try {
                                            const result = await uploadViaAdminApi(file);
                                            if (result.success) setForm(f => ({ ...f, t1Url: result.url, t1Uploading: false }));
                                            else { alert(result.error); setForm(f => ({ ...f, t1Uploading: false })); }
                                        } catch (err) { alert(err.message); setForm(f => ({ ...f, t1Uploading: false })); }
                                    }}
                                >
                                    {form.t1Uploading ? (
                                        <span style={{ fontSize: 13, color: "var(--brand-primary)", fontWeight: 600 }}>Uploading T1…</span>
                                    ) : form.t1Url ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                                            <span style={{ fontSize: 20 }}>✅</span>
                                            <div style={{ flex: 1, textAlign: "left" }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>T1 form uploaded</div>
                                                <a href={form.t1Url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--brand-primary)", fontWeight: 600 }}>View document</a>
                                            </div>
                                            <button type="button" onClick={() => setForm(f => ({ ...f, t1Url: "" }))}
                                                style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: 22, opacity: 0.4 }}>⬆</span>
                                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Upload T1 transit form (PDF or image)</span>
                                            <span style={{ fontSize: 11, color: "var(--text-dim)", opacity: 0.7 }}>Optional — skip if not required for this route</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*,.pdf" style={{ display: "none" }} disabled={form.t1Uploading}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            setForm(f => ({ ...f, t1Uploading: true }));
                                            try {
                                                const result = await uploadViaAdminApi(file);
                                                if (result.success) setForm(f => ({ ...f, t1Url: result.url, t1Uploading: false }));
                                                else { alert(result.error); setForm(f => ({ ...f, t1Uploading: false })); }
                                            } catch (err) { alert(err.message); setForm(f => ({ ...f, t1Uploading: false })); }
                                            e.target.value = "";
                                        }} />
                                </label>
                            </div>
                        </>
                    )}

                    {/* ── BILLING & DELIVERY ── */}
                    {!form.returningEmpty && (
                        <>
                            <SectionDivider title="Billing &amp; Delivery" />

                            {/* Billing customer */}
                            <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <FormLabel required>Billing Customer (Consignor)</FormLabel>
                                    <button type="button"
                                        onClick={() => {
                                            setJourneyCustomerTarget("billing");
                                            setJourneyCustomerForm({
                                                type: "Company",
                                                name: "",
                                                contactPerson: "",
                                                phone: "",
                                                email: "",
                                                address: "",
                                            });
                                        }}
                                        style={{ border: "none", background: "none", color: "var(--brand-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                        + Add new
                                    </button>
                                </div>
                                <select style={{ ...S.inp, border: errors.customerId ? "1px solid #DC2626" : S.inp.border }}
                                    value={form.customerId || ""}
                                    onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
                                    <option value="">Select billing customer…</option>
                                    {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {errors.customerId && <p style={{ color: "#DC2626", fontSize: 11, marginTop: 4 }}>{errors.customerId}</p>}
                            </div>

                            {/* Delivery customer */}
                            <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <FormLabel required>Delivery Customer (Consignee)</FormLabel>
                                    <button type="button"
                                        onClick={() => {
                                            setJourneyCustomerTarget("delivery");
                                            setJourneyCustomerForm({
                                                type: "Company",
                                                name: "",
                                                contactPerson: "",
                                                phone: "",
                                                email: "",
                                                address: "",
                                            });
                                        }}
                                        style={{ border: "none", background: "none", color: "var(--brand-primary)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                        + Add new
                                    </button>
                                </div>
                                <select style={{ ...S.inp, border: errors.deliveryCustomerId ? "1px solid #DC2626" : S.inp.border }}
                                    value={form.deliveryCustomerId || ""}
                                    onChange={(e) => setForm((f) => ({ ...f, deliveryCustomerId: e.target.value }))}>
                                    <option value="">Select delivery customer…</option>
                                    {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {errors.deliveryCustomerId && <p style={{ color: "#DC2626", fontSize: 11, marginTop: 4 }}>{errors.deliveryCustomerId}</p>}
                                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.45 }}>Used on the waybill as consignor and consignee.</p>
                            </div>
                        </>
                    )}

                    {/* ── CARGO & LOAD ── */}
                    <SectionDivider title="Cargo &amp; Load" />

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

                    {(form.cargoType === "Other" || (!form.cargoType && form.cargo && !CARGO_TYPES.includes(form.cargo))) && (
                        <div>
                            <FormLabel>Specify Cargo</FormLabel>
                            <input style={S.inp} value={form.cargo || ""} placeholder="Describe the cargo…"
                                onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                        </div>
                    )}

                    <Field label="Weight (KGs)"  k="weight"   type="number" form={form} setForm={setForm} S={S} />
                    {enteredCargoKg > 0 && effectivePayloadKg > 0 && (
                        <div style={{
                            gridColumn: "1/-1",
                            borderRadius: "var(--radius-md)",
                            border: `1px solid ${isOverPayload ? "#ef4444" : "rgba(16,185,129,0.35)"}`,
                            background: isOverPayload ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                            padding: "10px 12px",
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: isOverPayload ? "#991b1b" : "#166534",
                            fontWeight: 600,
                        }}>
                            {isOverPayload
                                ? `Overload risk: ${enteredCargoKg.toLocaleString()} kg is above the configured limit (${effectivePayloadKg.toLocaleString()} kg) by ${overPayloadByKg.toLocaleString()} kg.`
                                : `Load check: ${enteredCargoKg.toLocaleString()} kg is within configured limit (${effectivePayloadKg.toLocaleString()} kg).`}
                            <div style={{ marginTop: 4, fontWeight: 500, color: "var(--text-dim)" }}>
                                Legal gross limit: {legalGrossLimitKg > 0 ? `${legalGrossLimitKg.toLocaleString()} kg` : "not available (set axle counts)"} ·
                                Total tare: {totalTareKg.toLocaleString()} kg ·
                                Max legal payload: {legalPayloadFromGrossKg > 0 ? `${legalPayloadFromGrossKg.toLocaleString()} kg` : "—"}
                            </div>
                            <div style={{ marginTop: 6, fontWeight: 500, color: "var(--text-dim)" }}>
                                Axle distribution advisory: legal checks are based on total gross limits and the lowest configured payload cap; uneven axle load distribution can still trigger fines even when total gross is compliant.
                            </div>
                        </div>
                    )}
                    {enteredCargoKg > 0 && effectivePayloadKg === 0 && (
                        <div style={{
                            gridColumn: "1/-1",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid rgba(245,158,11,0.45)",
                            background: "rgba(245,158,11,0.10)",
                            padding: "10px 12px",
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: "#92400e",
                            fontWeight: 600,
                        }}>
                            No payload capacity is configured for this vehicle/trailer. Add capacity values to enable automatic overload warnings.
                        </div>
                    )}
                    <Field label="Distance (km)" k="distance" type="number" form={form} setForm={setForm} S={S} />

                    {/* ── FINANCIAL ── */}
                    <SectionDivider title="Financial" />

                    <Field label="Revenue (KES)" k="revenue" type="number" form={form} setForm={setForm} S={S} error={errors.revenue} />
                    <Field label="Deposit Received (KES)" k="depositAmount" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Deposit Date" k="depositDate" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Final Payment Received (KES)" k="finalPaymentAmount" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Final Payment Date" k="finalPaymentDate" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Status" k="status" options={STATUSES_JOURNEY} form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                    </div>

                    {/* ── TURNBOY / SECOND DRIVER ── */}
                    <SectionDivider title="Turnboy / Second Driver" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Turnboy Type</FormLabel>
                        <select style={S.inp} value={form.turnboyType || ""}
                            onChange={e => setForm(f => ({ ...f, turnboyType: e.target.value, turnboyId: "", turnboyName: "" }))}>
                            <option value="">None — solo driver</option>
                            <option value="salaried">Salaried turnboy (from company list)</option>
                            <option value="casual">Casual / one-off turnboy</option>
                        </select>
                    </div>

                    {form.turnboyType === "salaried" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <FormLabel>Select Turnboy</FormLabel>
                            <select style={S.inp} value={form.turnboyId || ""}
                                onChange={e => setForm(f => ({ ...f, turnboyId: e.target.value }))}>
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
                            <input style={S.inp} placeholder="e.g. John Otieno"
                                value={form.turnboyName || ""}
                                onChange={e => setForm(f => ({ ...f, turnboyName: e.target.value }))} />
                        </div>
                    )}

                    </div>
                </Modal>
                {journeyCustomerTarget && (
                    <Modal
                        title="Add New Customer"
                        onSave={saveJourneyCustomer}
                        S={S}
                        closeModal={() => setJourneyCustomerTarget(null)}
                        saveDisabled={hasJourneyCustomerErrors}
                    >
                        <div style={modalGrid}>
                            <Field label="Customer Type" k="type" options={["Company", "Individual"]} form={journeyCustomerForm} setForm={setJourneyCustomerForm} S={S} />
                            <div style={{ gridColumn: "1/-1" }}>
                                <Field
                                    label={journeyCustomerForm.type === "Company" ? "Company Name" : "Full Name"}
                                    k="name"
                                    full
                                    form={journeyCustomerForm}
                                    setForm={setJourneyCustomerForm}
                                    S={S}
                                    error={journeyCustomerErrors.name}
                                />
                            </div>
                            {journeyCustomerForm.type === "Company" && (
                                <div style={{ gridColumn: "1/-1" }}>
                                    <Field label="Contact Person" k="contactPerson" full form={journeyCustomerForm} setForm={setJourneyCustomerForm} S={S} />
                                </div>
                            )}
                            <Field label="Phone Number" k="phone" form={journeyCustomerForm} setForm={setJourneyCustomerForm} S={S} error={journeyCustomerErrors.phone} />
                            <Field label="Email Address" k="email" type="email" form={journeyCustomerForm} setForm={setJourneyCustomerForm} S={S} />
                            <div style={{ gridColumn: "1/-1" }}>
                                <Field label="Physical Address" k="address" full form={journeyCustomerForm} setForm={setJourneyCustomerForm} S={S} />
                            </div>
                        </div>
                    </Modal>
                )}
            </>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       INCIDENT
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "incident") {
        const incidentTypes = readSettings()?.incidentTypes || ["Accident", "Breakdown", "Cargo Damage", "Road Delay", "Security", "Other"];
        const incidentErrors = {
            date: validators.required(form.date),
            incidentType: validators.required(form.incidentType),
            description: validators.required(form.description),
        };
        const hasIncidentErrors = Object.values(incidentErrors).some(Boolean);
        const saveIncident = () => flushModalSave(() => {
            if (hasIncidentErrors) return;
            saveItem("incidents", {
                ...form,
                id: form.id || uid(),
                driverId: form.driverId || form.driver || "",
                _pendingApproval: false,
                _isRejected: false,
            });
        });
        return (
            <Modal title={form.id ? "Edit Incident" : "Log Incident"} onSave={saveIncident} S={S} closeModal={closeModal} saveDisabled={hasIncidentErrors}>
                <div style={modalGrid}>
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} error={incidentErrors.date} />
                    <Field label="Incident Type" k="incidentType" options={incidentTypes} form={form} setForm={setForm} S={S} error={incidentErrors.incidentType} />
                    <Field label="Driver" k="driver" options={(data.drivers || []).map((d) => ({ v: d.id, l: d.name }))} form={form} setForm={setForm} S={S} />
                    <Field label="Vehicle" k="truck" options={(data.trucks || []).map((t) => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Location" k="location" full form={form} setForm={setForm} S={S} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Description" k="description" full form={form} setForm={setForm} S={S} error={incidentErrors.description} />
                    </div>
                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       MAINTENANCE
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "maintenance") {
        const submitLog = () => flushModalSave(() => {
            if (!form.date || !form.odom) { alert("Date and odometer reading are required"); return; }
            const taskName = form.task === "Custom" ? form.customTask : form.task;
            const entry = {
                truck: form.truck, date: form.date, cat: "Maintenance", amount: +(form.cost || 0), odom: +form.odom,
                desc: `${taskName}${form.notes ? " — " + form.notes : ""}`,
                _maintenanceTask: taskName,
                _maintenanceDetails: { task: taskName, workshop: form.workshop || "", cost: +(form.cost || 0), odomReading: +form.odom, receiptUrl: form.receiptUrl || "", notes: form.notes || "" },
            };
            saveItem("expenses", entry);
            const truckObj = data.trucks.find(t => t.id === form.truck);
            if (+form.odom > +(truckObj?.odom || 0)) {
                setData(d => ({ ...d, trucks: d.trucks.map(t => t.id === form.truck ? { ...t, odom: +form.odom } : t) }));
            }
        });

        const DEFAULT_SCHEDULE = [
            { task: "Oil Change",                       intervalKm: 10000 },
            { task: "Tyre Rotation",                    intervalKm: 10000 },
            { task: "Wheel Alignment & Balancing",      intervalKm: 10000 },
            { task: "Brake Disc Inspection",            intervalKm: 15000 },
            { task: "Brake Pad Replacement",            intervalKm: 15000 },
            { task: "Fuel Filter Replacement",          intervalKm: 20000 },
            { task: "Power Steering Fluid Top-up",      intervalKm: 20000 },
            { task: "Engine Belt Inspection",           intervalKm: 30000 },
            { task: "Differential Oil Change",          intervalKm: 40000 },
            { task: "Transmission Fluid Change",        intervalKm: 40000 },
        ];
        const selectedTruck = data.trucks.find(t => t.id === form.truck) || data.trucks[0];

        return (
            <Modal title={form.id ? "Edit Service Record" : `Log Service — ${form.task}`} onSave={submitLog} S={S} closeModal={closeModal}>
                <div style={modalGrid}>

                    <SectionDivider title="Vehicle &amp; Task" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Truck</FormLabel>
                        <select style={S.inp} value={form.truck}
                            onChange={e => setForm(f => ({ ...f, truck: e.target.value }))}>
                            {data.trucks.map(t => (
                                <option key={t.id} value={t.id}>{t.reg} — {Number(t.odom || 0).toLocaleString("en-KE")} km</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Maintenance Task</FormLabel>
                        <select style={S.inp} value={form.task}
                            onChange={e => {
                                const found = DEFAULT_SCHEDULE.find(s => s.task === e.target.value);
                                setForm(f => ({ ...f, task: e.target.value, intervalKm: found?.intervalKm || f.intervalKm }));
                            }}>
                            {DEFAULT_SCHEDULE.map(s => (
                                <option key={s.task} value={s.task}>{s.task} (every {s.intervalKm.toLocaleString()} km)</option>
                            ))}
                            <option value="Custom">Custom task…</option>
                        </select>
                    </div>

                    {form.task === "Custom" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <FormLabel>Custom Task Description</FormLabel>
                            <input style={S.inp} placeholder="e.g. Radiator flush" value={form.customTask || ""}
                                onChange={e => setForm(f => ({ ...f, customTask: e.target.value }))} />
                        </div>
                    )}

                    <SectionDivider title="Service Details" />

                    <Field label="Date of Service *"       k="date"     type="date"   form={form} setForm={setForm} S={S} />
                    <Field label="Odometer Reading (km) *" k="odom"     type="number" placeholder={String(selectedTruck?.odom || 0)} form={form} setForm={setForm} S={S} />
                    <Field label="Cost (KES)"              k="cost"     type="number" placeholder="0" form={form} setForm={setForm} S={S} />
                    <Field label="Workshop / Garage"       k="workshop" placeholder="e.g. Nairobi Auto Centre"       form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Notes (optional)</FormLabel>
                        <textarea style={{ ...S.inp, height: 64, resize: "vertical" }}
                            placeholder="Any additional details…"
                            value={form.notes || ""}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>

                    <SectionDivider title="Receipt" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <FormLabel>Receipt / Invoice</FormLabel>
                        <label style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                            minHeight: 72, borderRadius: "var(--radius-md)",
                            border: `1.5px dashed ${form.receiptUploading ? "var(--brand-primary)" : form.receiptUrl ? "#10b981" : "var(--border-medium)"}`,
                            background: form.receiptUrl ? "rgba(16,185,129,0.04)" : form.receiptUploading ? "var(--brand-muted)" : "var(--bg-main)",
                            cursor: form.receiptUploading ? "wait" : "pointer",
                            padding: "14px", textAlign: "center",
                        }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={async (e) => {
                                e.preventDefault();
                                const file = e.dataTransfer?.files?.[0];
                                if (!file || form.receiptUploading) return;
                                setForm(f => ({ ...f, receiptUploading: true }));
                                try {
                                    const result = await uploadViaAdminApi(file);
                                    if (result.success) setForm(f => ({ ...f, receiptUrl: result.url, receiptUploading: false }));
                                    else { alert(result.error); setForm(f => ({ ...f, receiptUploading: false })); }
                                } catch (err) { alert(err.message); setForm(f => ({ ...f, receiptUploading: false })); }
                            }}
                        >
                            {form.receiptUploading ? (
                                <span style={{ fontSize: 12, color: "var(--brand-primary)", fontWeight: 600 }}>Uploading…</span>
                            ) : form.receiptUrl ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                                    <span style={{ fontSize: 18 }}>✅</span>
                                    <div style={{ flex: 1, textAlign: "left" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>Receipt on file</div>
                                        <button type="button" onClick={(e) => { e.preventDefault(); setForm(f => ({ ...f, receiptUrl: "" })); }}
                                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                                            Remove
                                        </button>
                                    </div>
                                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Click to replace</span>
                                </div>
                            ) : (
                                <>
                                    <span style={{ fontSize: 20, opacity: 0.4 }}>⬆</span>
                                    <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>Upload receipt photo or PDF</span>
                                </>
                            )}
                            <input type="file" accept="image/*,.pdf" style={{ display: "none" }} disabled={form.receiptUploading}
                                onChange={async (e) => {
                                    const file = e.target.files[0]; if (!file) return;
                                    setForm(f => ({ ...f, receiptUploading: true }));
                                    try {
                                        const result = await uploadViaAdminApi(file);
                                        if (result.success) setForm(f => ({ ...f, receiptUrl: result.url, receiptUploading: false }));
                                        else { alert(result.error); setForm(f => ({ ...f, receiptUploading: false })); }
                                    } catch (err) { alert(err.message); setForm(f => ({ ...f, receiptUploading: false })); }
                                    e.target.value = "";
                                }} />
                        </label>
                    </div>

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       TRUCK
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "truck") {
        const getErrors = () => {
            const e = {};
            if (form.reg      !== undefined) e.reg      = validators.required(form.reg)      || validators.truckReg(form.reg);
            if (form.capacity !== undefined) e.capacity = validators.required(form.capacity) || validators.positiveNumber(form.capacity);
            return e;
        };
        const errors   = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Truck" : "Add Truck"} onSave={() => flushModalSave(() => saveItem("trucks", form))} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <AutoIdDisplay value={form.uId} S={S} />

                    <SectionDivider title="Vehicle Details" />

                    <Field label="Registration No."  k="reg"       form={form} setForm={setForm} S={S} T={T} error={errors.reg} />
                    <Field label="Manufacturer"      k="make"      form={form} setForm={setForm} S={S} T={T} placeholder="e.g. Toyota, Isuzu, MAN" />
                    <Field label="Model / Version"   k="model"     form={form} setForm={setForm} S={S} T={T} placeholder="e.g. Hino 500, NPR 71, TGS 26" />
                    <Field label="Year"              k="year"      type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Fuel Type"         k="fuelType"  options={["Diesel", "Petrol", "CNG", "Electric", "Other"]} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Vehicle Type"      k="type"      options={TRUCK_TYPES} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status"            k="status"    options={STATUSES_TRUCK} form={form} setForm={setForm} S={S} T={T} />

                    <div style={{ alignSelf: "end", paddingBottom: 6 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!form.isRigid}
                                onChange={(e) => setForm((f) => ({ ...f, isRigid: e.target.checked }))} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Rigid Vehicle</span>
                        </label>
                    </div>

                    <SectionDivider title="Specifications" />

                    <Field label="Load Capacity (KGs)"  k="capacity"     type="number" form={form} setForm={setForm} S={S} T={T} error={errors.capacity} />
                    <Field label="Gross Weight (KGs)"   k="grossWeightKg" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Number of Axles"      k="axleCount"    type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Tare Weight (KGs)"     k="tareWeightKg" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <div>
                        <Field label="Engine Rating (CC)" k="engineCC" type="number" form={form} setForm={setForm} S={S} T={T} />
                        <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.4 }}>For records &amp; compliance — fuel efficiency is calculated from actual fill-up data.</p>
                    </div>
                    <Field label="Date of Registration" k="registeredOn" type="date" form={form} setForm={setForm} S={S} T={T} />

                    <SectionDivider title="Registration &amp; Compliance" />

                    <Field label="Odometer (km)"    k="odom"   type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Assigned Driver"  k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} form={form} setForm={setForm} S={S} T={T} />

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       DRIVER
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "driver") {
        const toSegechaEmail = (rawEmail, fallbackName) => {
            const source = String(rawEmail || fallbackName || "").trim().toLowerCase();
            const local  = (source.includes("@") ? source.split("@")[0] : source).replace(/[^a-z0-9._-]/g, ".").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
            return `${local || "driver"}@example.com`;
        };
        const assignedElsewhere  = new Set(data.drivers.filter((d) => d.id !== form.id && d.truck).map((d) => d.truck));
        const driverTruckOptions = data.trucks.filter((t) => !assignedElsewhere.has(t.id) || t.id === form.truck).map((t) => ({ v: t.id, l: t.reg }));
        const getErrors = () => {
            const e = {};
            e.name    = validators.required(form.name);
            e.phone   = validators.required(form.phone)  || validators.kenyaPhone(form.phone);
            e.mpesa   = validators.required(form.mpesa)  || validators.mpesa(form.mpesa);
            e.license = validators.required(form.license);
            e.salary  = validators.required(form.salary) || validators.positiveNumber(form.salary);
            if (form.email) e.email = validators.email(form.email);
            return e;
        };
        const errors   = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);

        const handleDriverSave = async () => {
            const isNew       = !form.id;
            const driverId    = form.id || uid();
            const driverName  = form.name;
            const driverEmail = toSegechaEmail(form.email, driverName);
            const otp         = form.otp || Math.floor(100000 + Math.random() * 900000).toString();
            saveItem("drivers", { ...form, id: driverId, email: driverEmail, otp, firstLogin: isNew ? true : form.firstLogin });
            if (isNew && driverEmail && driverEmail.includes("@")) {
                try {
                    const res    = await fetchWithAuth(`${PAYMENT_API}/api/driver/create-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driverId, email: driverEmail, phone: form.phone, driverName }) });
                    const result = await res.json();
                    if (result.success) {
                        const otpHint  = result.otp          ? ` OTP: ${result.otp}`                 : "";
                        const tempHint = result.tempPassword ? ` Temp password: ${result.tempPassword}` : "";
                        showToast?.(`Driver account created.${otpHint}${tempHint}`, "success");
                    }
                } catch (err) { console.warn("Portal account creation failed:", err.message); }
            }
        };

        return (
            <Modal title={form.id ? "Edit Driver" : "Add Driver"} onSave={() => flushModalSave(() => void handleDriverSave())} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <AutoIdDisplay value={form.uId} S={S} />

                    <SectionDivider title="Personal Info" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Full Name" k="name" full form={form} setForm={setForm} S={S} T={T} error={errors.name} />
                    </div>
                    <Field label="Phone"         k="phone" form={form} setForm={setForm} S={S} T={T} error={errors.phone} />
                    <Field label="Email Address" k="email" type="email" placeholder="driver@email.com" form={form} setForm={setForm} S={S} T={T} error={errors.email} />
                    <Field label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" form={form} setForm={setForm} S={S} T={T} error={errors.mpesa} />

                    <SectionDivider title="Licence &amp; Compliance" />

                    <Field label="License No." k="license" form={form} setForm={setForm} S={S} T={T} error={errors.license} />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="License Class" k="class" type="checkbox-group" options={licenceClasses} full form={form} setForm={setForm} S={S} T={T} />
                    </div>

                    <SectionDivider title="Employment" />

                    <Field label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.salary} />
                    <Field label="Date Joined"          k="joined" type="date"   form={form} setForm={setForm} S={S} T={T} />

                    <div>
                        <Field label="Assigned Truck" k="truck" options={driverTruckOptions} form={form} setForm={setForm} S={S} T={T} />
                        <p style={{ marginTop: 4, fontSize: 10, color: "var(--text-dim)", lineHeight: 1.4 }}>Only unassigned trucks are shown.</p>
                    </div>

                    <Field label="Default Trailer" k="assignedTrailer"
                        options={[{ v: "", l: "— None —" }, ...(data.trailers || []).map((t) => ({ v: t.id, l: `${t.reg} (${t.type})` }))]}
                        form={form} setForm={setForm} S={S} T={T} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <label style={{
                            display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                            padding: "12px 14px", borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)", background: "var(--bg-main)",
                        }}>
                            <input type="checkbox" checked={!!form.lockVehicleAssignment}
                                onChange={(e) => setForm((f) => ({ ...f, lockVehicleAssignment: e.target.checked }))}
                                style={{ marginTop: 2 }} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>Lock truck &amp; trailer on journeys</div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>Driver uses office-assigned vehicle only. Change assignments here or turn off the lock to reassign from the journey form.</div>
                            </div>
                        </label>
                    </div>

                    <Field label="Status" k="status" options={["Active", "Inactive", "Suspended"]} form={form} setForm={setForm} S={S} T={T} />

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       CUSTOMER
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "customer") {
        const errors = {};
        errors.name = validators.required(form.name);
        if (!errors.name && !form.id && form.name) {
            const normalizedName = form.name.trim().toLowerCase();
            const existing       = data.customers.find(c => c.name.trim().toLowerCase() === normalizedName);
            if (existing) errors.name = "A customer with this name already exists";
        }
        errors.phone = validators.required(form.phone) || validators.kenyaPhone(form.phone);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Customer" : "Add New Customer"} onSave={() => flushModalSave(() => saveItem("customers", form))} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <AutoIdDisplay value={form.uId} S={S} />

                    <SectionDivider title="Customer Info" />

                    <Field label="Customer Type" k="type" options={["Company", "Individual"]} form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label={form.type === "Company" ? "Company Name" : "Full Name"} k="name" full
                            form={form} setForm={setForm} S={S} error={errors.name} />
                    </div>

                    {form.type === "Company" && (
                        <div style={{ gridColumn: "1/-1" }}>
                            <Field label="Contact Person" k="contactPerson" full form={form} setForm={setForm} S={S} placeholder="e.g. Procurement Officer" />
                        </div>
                    )}

                    <Field label="Phone Number"   k="phone" form={form} setForm={setForm} S={S} error={errors.phone} />
                    <Field label="Email Address"  k="email" type="email" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Physical Address" k="address" full form={form} setForm={setForm} S={S} />
                    </div>

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       TRAILER
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "trailer") {
        return (
            <Modal title={form.id ? "Edit Trailer" : "Add Trailer"} onSave={() => flushModalSave(() => saveItem("trailers", form))} S={S} closeModal={closeModal}>
                <div style={modalGrid}>

                    <AutoIdDisplay value={form.uId} S={S} />

                    <SectionDivider title="Trailer Details" />

                    <Field label="Registration No."     k="reg"   form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Trailer Type"         k="type"  options={["Flatbed", "Skeleton", "Tanker", "Lowloader", "Box Body", "Refrigerated"]} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Manufacturer"         k="make"  form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Model / Version"      k="model" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Year"                 k="year"  type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Load Capacity (KGs)"  k="capacity" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Gross Weight (KGs)"   k="grossWeightKg" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Number of Axles"      k="axleCount"    type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Tare Weight (KGs)"     k="tareWeightKg" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Date of Registration"  k="registeredOn" type="date" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status"               k="status" options={["Active", "Maintenance", "Inactive"]} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Assigned Truck"       k="truck"  options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} T={T} />

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       STAFF
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "staff") {
        const toSegechaEmail = (rawEmail, fallbackName) => {
            const source = String(rawEmail || fallbackName || "").trim().toLowerCase();
            const local  = (source.includes("@") ? source.split("@")[0] : source).replace(/[^a-z0-9._-]/g, ".").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
            return `${local || "staff"}@example.com`;
        };
        const isDrivingRole = form.role === "Driver" || form.role === "Turnboy";
        const getErrors = () => {
            const e = {};
            e.name = validators.required(form.name);
            e.role = validators.required(form.role);
            if (isDrivingRole) {
                e.phone   = validators.required(form.phone)  || validators.kenyaPhone(form.phone);
                e.mpesa   = validators.required(form.mpesa)  || validators.mpesa(form.mpesa);
                e.license = validators.required(form.license);
            }
            e.salary = validators.required(form.salary) || validators.positiveNumber(form.salary);
            return e;
        };
        const errors   = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);
        const _S = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        const ROLES_LIST = _S.roles       || ["Office Admin", "Fleet Manager", "Turnboy", "Accountant", "Operations", "Driver", "Other"];
        const DEPTS_LIST = _S.departments || ["Operations", "Finance", "Logistics", "HR"];

        const handleStaffSave = async () => {
            const isNew   = !form.id;
            const name    = form.name || "";
            const email   = toSegechaEmail(form.email, name);
            const staffId = form.id || uid();
            let next = { ...form, id: staffId, email };
            if (isNew) { next = { ...next, firstLogin: true, otp: next.otp || Math.floor(100000 + Math.random() * 900000).toString(), tempPassword: next.tempPassword || "" }; }
            saveItem("staff", next);
            if (isNew && email.includes("@")) {
                try {
                    const res    = await fetchWithAuth(`${PAYMENT_API}/api/staff/create-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: next.id, email, phone: next.phone, staffName: name }) });
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
            <Modal title={form.id ? "Edit Staff Member" : "Add Staff Member"} onSave={() => flushModalSave(() => void handleStaffSave())} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                {creationResult ? (
                    /* ── Account Created confirmation ── */
                    <div style={{ padding: "4px 0" }}>
                        <div style={{
                            background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 16,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#059669", flexShrink: 0 }} />
                                Account Ready For User
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16, lineHeight: 1.5 }}>
                                Provide these temporary credentials to the staff member. They must change their password on first login.
                            </p>
                            <div style={{ display: "grid", gap: 10 }}>
                                <div style={{ background: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
                                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Login Email</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)" }}>{creationResult.email}</div>
                                </div>
                                {creationResult.tempPassword && (
                                    <div style={{ background: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
                                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Temporary Password</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{creationResult.tempPassword}</div>
                                    </div>
                                )}
                                {creationResult.otp && (
                                    <div style={{ background: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
                                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Mobile OTP</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", fontFamily: "var(--font-mono)" }}>{creationResult.otp}</div>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" style={{ width: "100%", marginTop: 14, border: "1px dashed var(--border-medium)" }}
                                onClick={() => {
                                    const text = `Email: ${creationResult.email}${creationResult.tempPassword ? `\nPassword: ${creationResult.tempPassword}` : ""}${creationResult.otp ? `\nOTP: ${creationResult.otp}` : ""}`;
                                    navigator.clipboard.writeText(text);
                                    showToast?.("Credentials copied to clipboard", "success");
                                }}>
                                Copy All Credentials
                            </Button>
                        </div>
                        <Button variant="primary" style={{ width: "100%" }} onClick={closeModal}>Done</Button>
                    </div>
                ) : (
                    <div style={modalGrid}>

                        <AutoIdDisplay value={form.uId} S={S} />

                        <SectionDivider title="Personal &amp; Role" />

                        <div style={{ gridColumn: "1/-1" }}>
                            <Field label="Full Name" k="name" full form={form} setForm={setForm} S={S} T={T} error={errors.name} />
                        </div>
                        <Field label="Role / Title"   k="role"       options={ROLES_LIST} form={form} setForm={setForm} S={S} T={T} error={errors.role} />
                        <Field label="Department"     k="department" options={DEPTS_LIST} form={form} setForm={setForm} S={S} T={T} />
                        <Field label="Phone Number"   k="phone" placeholder={isDrivingRole ? "07XXXXXXXX" : undefined} form={form} setForm={setForm} S={S} T={T} error={errors.phone} />
                        <Field label="Email Address"  k="email" type="email" placeholder="name@example.com" form={form} setForm={setForm} S={S} T={T} />

                        {isDrivingRole && (
                            <>
                                <SectionDivider title="Driver / Turnboy Details" />
                                <Field label="M-Pesa Number" k="mpesa"   placeholder="07XXXXXXXX" form={form} setForm={setForm} S={S} T={T} error={errors.mpesa} />
                                <Field label="License No."   k="license" form={form} setForm={setForm} S={S} T={T} error={errors.license} />
                                <div style={{ gridColumn: "1/-1" }}>
                                    <Field label="License Class" k="class" type="checkbox-group" options={licenceClasses} full form={form} setForm={setForm} S={S} T={T} />
                                </div>
                                <Field label="Assigned Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} T={T} />
                            </>
                        )}

                        <SectionDivider title="Employment" />

                        <Field label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.salary} />
                        <Field label="Date Joined"          k="joined" type="date"   form={form} setForm={setForm} S={S} T={T} />
                        <Field label="Status"               k="status" options={["Active", "On Leave", "Inactive"]} form={form} setForm={setForm} S={S} T={T} />

                        {form.firstLogin && (
                            <div style={{
                                gridColumn: "1/-1",
                                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)",
                                borderRadius: "var(--radius-md)", padding: "14px 16px",
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>One-Time Password (OTP)</div>
                                <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "0.22em", fontFamily: "var(--font-mono)" }}>{form.otp}</div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>Provide this to the employee for their initial login.</div>
                            </div>
                        )}

                    </div>
                )}
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       TEMPLATE SELECTOR
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "templateSelector") {
        const { type, entityData } = form;
        const templatesList = (data.templates || []).filter(t => {
            if (type === "invoice") return t.category === "Finance"     || t.category === "General";
            if (type === "staff")   return t.category === "Staff"       || t.category === "General";
            if (type === "journey") return t.category === "Operations"  || t.category === "General";
            return true;
        });
        const selectedId    = form._selectedTemplateId ?? templatesList[0]?.id ?? "";
        const template      = templatesList.find((t) => t.id === selectedId);
        const filledSubject = props.fillTemplate(template?.subject || "", entityData || {});
        const filledBody    = props.fillTemplate(template?.body    || "", entityData || {});

        return (
            <Modal title="Send Message" onSave={() => { props.showToast("Message draft ready — complete send in your email/SMS app.", "success"); closeModal(); }} S={S} closeModal={closeModal} saveLabel="Done">
                <div style={{ display: "grid", gap: 16 }}>

                    <div>
                        <FormLabel>Select Template</FormLabel>
                        <select style={S.inp} value={selectedId}
                            onChange={(e) => setForm((f) => ({ ...f, _selectedTemplateId: e.target.value }))}>
                            {templatesList.length === 0 ? (
                                <option value="">No templates — add some in Settings</option>
                            ) : (
                                templatesList.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)
                            )}
                        </select>
                    </div>

                    {/* Preview */}
                    <div style={{
                        padding: 18, background: "var(--bg-main)", borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Preview</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 10 }}>{filledSubject}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{filledBody}</div>
                    </div>

                    <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>
                        Customize templates in <b>Settings &gt; Message Templates</b>.
                    </p>

                </div>
            </Modal>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       ASSET
    ═══════════════════════════════════════════════════════════════ */
    if (modal === "asset") {
        const errors = {};
        errors.name     = validators.required(form.name);
        errors.category = validators.required(form.category);
        errors.cost     = validators.required(form.cost) || validators.positiveNumber(form.cost);
        const hasErrors = Object.values(errors).some(Boolean);

        const ASSET_CATS = [
            "Vehicle", "Trailer", "Heavy Equipment", "Workshop Equipment", "Fuel Infrastructure",
            "Technology", "Office Furniture & Fixtures", "Communication Equipment",
            "Power Equipment", "Land & Buildings", "Other"
        ];

        const isVehicle = form.category === "Vehicle" || form.category === "Trailer";

        return (
            <Modal title={form.id ? "Edit Asset" : "Add New Asset"} onSave={() => flushModalSave(() => saveItem("assets", form))} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={modalGrid}>

                    <SectionDivider title="Asset Details" />

                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Asset Name" k="name" form={form} setForm={setForm} S={S} error={errors.name} placeholder="e.g. Isuzu NQR 500, Hydraulic Lift, HP Server" />
                    </div>

                    <div>
                        <FormLabel>Category</FormLabel>
                        <select style={S.inp} value={form.category || ""}
                            onChange={e => setForm(f => ({ ...f, category: e.target.value, linkedTruckId: "" }))}>
                            <option value="">Select…</option>
                            {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {errors.category && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 3 }}>{errors.category}</div>}
                    </div>

                    <div>
                        <FormLabel>Status</FormLabel>
                        <select style={S.inp} value={form.status || "Active"}
                            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                            {["Active", "Disposed", "Under Repair", "Sold", "Written Off"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <Field label="Supplier / Dealer" k="supplier" form={form} setForm={setForm} S={S} placeholder="e.g. Kenya Trucks Ltd" />
                    <Field label="Purchase Date" k="purchaseDate" type="date" form={form} setForm={setForm} S={S} />

                    <SectionDivider title="Valuation" />

                    <Field label="Purchase Cost (KES)" k="cost" type="number" form={form} setForm={setForm} S={S} error={errors.cost} />
                    <Field label="Salvage Value (KES)" k="salvageValue" type="number" form={form} setForm={setForm} S={S} placeholder="0 if no residual value" />

                    <div>
                        <FormLabel>Depreciation Method</FormLabel>
                        <select style={S.inp} value={form.depreciationMethod || "straight-line"}
                            onChange={e => setForm(f => ({ ...f, depreciationMethod: e.target.value }))}>
                            <option value="straight-line">Straight-line (equal amounts each year)</option>
                            <option value="reducing-balance">Reducing Balance (% of remaining value)</option>
                        </select>
                    </div>

                    <Field label="Useful Life (years)" k="usefulLifeYears" type="number" form={form} setForm={setForm} S={S} placeholder="e.g. 5" />

                    {form.cost && form.usefulLifeYears && (
                        <InfoBox color="var(--brand-primary)" icon="📊">
                            {(() => {
                                const cost = Number(form.cost) || 0;
                                const salvage = Number(form.salvageValue) || 0;
                                const life = Number(form.usefulLifeYears) || 5;
                                const method = form.depreciationMethod || "straight-line";
                                let monthly;
                                if (method === "reducing-balance") {
                                    const annRate = salvage > 0 ? 1 - Math.pow(salvage / cost, 1 / life) : 0.20;
                                    monthly = (cost * annRate) / 12;
                                } else {
                                    monthly = (cost - salvage) / (life * 12);
                                }
                                return `Estimated monthly depreciation: KES ${Math.round(monthly).toLocaleString()}`;
                            })()}
                        </InfoBox>
                    )}

                    {isVehicle && (
                        <>
                            <SectionDivider title="Fleet Link" />
                            <div style={{ gridColumn: "1/-1" }}>
                                <Field label="Link to existing truck (or leave blank to create new)" k="linkedTruckId"
                                    options={[{ v: "", l: "— Create new truck entry —" }, ...data.trucks.map(t => ({ v: t.id, l: t.reg }))]}
                                    full form={form} setForm={setForm} S={S} />
                            </div>
                            <InfoBox color="#10b981" icon="🚛">
                                Vehicle and trailer assets can be linked to existing fleet records for reporting. Creating an asset will not auto-create fleet entries.
                            </InfoBox>
                        </>
                    )}

                    <SectionDivider title="Notes" />
                    <div style={{ gridColumn: "1/-1" }}>
                        <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} placeholder="Serial number, location, warranty details…" />
                    </div>

                </div>
            </Modal>
        );
    }

    return null;
}
