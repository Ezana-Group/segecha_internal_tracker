import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Field } from "./Field";
import { Button } from "./Button";
import { fmt, fmtDate, today, uid, monthLabel } from "../utils/formatters";
import { validators } from "../utils/validators";
import { PAYMENT_API, ADMIN_KEY } from "../utils/env";
import { DEFAULT_FUEL_PRICE, STATUSES_JOURNEY, CARGO_TYPES, TRUCK_TYPES, STATUSES_TRUCK, INVOICE_PREFIX, PAYMENT_TERMS_DAYS } from "../constants/nav";
import { getLicenceClasses, getCommonRoutes, getTruckTypes, getTrailerTypes, subscribeSettings } from "../utils/settingsStore.js";

const FuelPhotoField = ({ label, k, form, setForm, S, T }) => {
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const photoUrl = form[k];

    const handleUpload = async (eOrFile) => {
        const file = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("adminKey", ADMIN_KEY);
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/upload`, {
                method: "POST",
                headers: {
                    "x-admin-key": ADMIN_KEY
                },
                body: formData,
            });
            const d = await res.json();
            if (d.success) setForm(f => ({ ...f, [k]: d.url }));
            else alert("Upload failed: " + d.error);
        } catch (err) {
            alert("Upload error: " + err.message);
        } finally {
            setUploading(false);
            setDragging(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    };

    return (
        <div style={S.fg}>
            <label style={S.lbl}>
                {label}{" "}
                <span style={{ fontWeight: 600, color: photoUrl ? "#10b981" : "var(--text-dim)" }}>
                    {photoUrl ? "(uploaded)" : "(required)"}
                </span>
            </label>
            <div 
                style={{ 
                    display: 'flex', gap: 10, alignItems: 'center',
                    border: dragging ? "2px dashed var(--brand-primary)" : "2px dashed transparent",
                    borderRadius: 12,
                    padding: dragging ? 8 : 0,
                    transition: "all 0.2s ease"
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <label style={{ ...S.btn(photoUrl ? 'ghost' : 'primary'), fontSize: 11, padding: '6px 12px', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                    {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
                </label>
                {photoUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a href={photoUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: `url(${photoUrl}) center/cover no-repeat`, border: `1px solid ${T.border2}` }} />
                        </a>
                        <button 
                            type="button"
                            onClick={() => setForm(f => ({ ...f, [k]: '' }))}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "4px 8px" }}
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

function SectionHeader({ title, icon, T, style = {} }) {
    return (
        <div style={{ 
            gridColumn: "1/-1", 
            display: "flex", 
            alignItems: "center", 
            gap: 10, 
            marginTop: 18, 
            marginBottom: 10,
            padding: "8px 0",
            borderBottom: `1px solid ${T?.border2 || "var(--border-subtle)"}`,
            ...style
        }}>
            <span style={{ fontSize: 16, display: 'flex' }}>{icon}</span>
            <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--brand-primary)" }}>{title}</span>
        </div>
    );
}

/** Admin journey form — documents (server /api/admin/upload) */
function JourneyDocumentField({ label, k, form, setForm, S, T, required = false }) {
    const [dragging, setDragging] = useState(false);
    const docUrl = form[k];

    const handleUpload = async (eOrFile) => {
        const file = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('adminKey', ADMIN_KEY);
        fd.append('folder', 'journey_docs');
        try {
            const res = await fetch(`${PAYMENT_API}/api/admin/upload`, { 
                method: 'POST', 
                headers: {
                    'x-admin-key': ADMIN_KEY
                },
                body: fd 
            });
            const d = await res.json();
            if (d.success) setForm((f) => ({ ...f, [k]: d.url }));
            else alert('Upload failed: ' + (d.error || 'unknown'));
        } catch (err) {
            alert('Upload error: ' + err.message);
        } finally {
            setUploading(false);
            setDragging(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    };

    return (
        <div style={S.fg}>
            <label style={S.lbl}>
                {label}{' '}
                <span style={{ fontWeight: 600, color: docUrl ? '#10b981' : required ? '#ef4444' : 'var(--text-dim)' }}>
                    {docUrl ? '(uploaded)' : required ? '(required)' : '(optional)'}
                </span>
            </label>
            <div 
                style={{ 
                    display: 'flex', gap: 10, alignItems: 'center',
                    border: dragging ? "2px dashed var(--brand-primary)" : "2px dashed transparent",
                    borderRadius: 12,
                    padding: dragging ? 8 : 0,
                    transition: "all 0.2s ease"
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <label
                    style={{
                        ...S.btn(docUrl ? 'ghost' : 'primary'),
                        fontSize: 11,
                        padding: '6px 12px',
                        cursor: uploading ? 'wait' : 'pointer',
                        flex: 1,
                        textAlign: 'center',
                        position: 'relative'
                    }}
                >
                    {uploading ? 'Uploading…' : docUrl ? 'Change file' : 'Upload PDF/Doc'}
                    <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
                </label>
                {docUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a href={docUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: `var(--surface-subtle)`, border: `1px solid ${T.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 10, fontWeight: 800 }}>PDF</div>
                        </a>
                        <button 
                            type="button"
                            onClick={() => setForm(f => ({ ...f, [k]: '' }))}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "4px 8px" }}
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function JourneyOdomPhotoField({ label, k, form, setForm, S, T }) {
    const [dragging, setDragging] = useState(false);
    const photoUrl = form[k];

    const handleUpload = async (eOrFile) => {
        const file = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('adminKey', ADMIN_KEY);
        fd.append('folder', 'journey_odom_admin');
        fd.append('filename', k);
        try {
            const res = await fetch(`${PAYMENT_API}/api/admin/upload`, { 
                method: 'POST', 
                headers: {
                    'x-admin-key': ADMIN_KEY
                },
                body: fd 
            });
            const d = await res.json();
            if (d.success) setForm((f) => ({ ...f, [k]: d.url }));
            else alert('Upload failed: ' + (d.error || 'unknown'));
        } catch (err) {
            alert('Upload error: ' + err.message);
        } finally {
            setUploading(false);
            setDragging(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    };

    return (
        <div style={S.fg}>
            <label style={S.lbl}>
                {label}{' '}
                <span style={{ fontWeight: 600, color: photoUrl ? '#10b981' : 'var(--text-dim)' }}>
                    {photoUrl ? '(uploaded)' : '(optional)'}
                </span>
            </label>
            <div 
                style={{ 
                    display: 'flex', gap: 10, alignItems: 'center',
                    border: dragging ? "2px dashed var(--brand-primary)" : "2px dashed transparent",
                    borderRadius: 12,
                    padding: dragging ? 8 : 0,
                    transition: "all 0.2s ease"
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <label
                    style={{
                        ...S.btn(photoUrl ? 'ghost' : 'primary'),
                        fontSize: 11,
                        padding: '6px 12px',
                        cursor: uploading ? 'wait' : 'pointer',
                        flex: 1,
                        textAlign: 'center',
                    }}
                >
                    {uploading ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
                </label>
                {photoUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <a href={photoUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: `url(${photoUrl}) center/cover no-repeat`, border: `1px solid ${T.border2}` }} />
                        </a>
                        <button 
                            type="button"
                            onClick={() => setForm(f => ({ ...f, [k]: '' }))}
                            style={{ border: "none", background: "none", color: "#ef4444", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "4px 8px" }}
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

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

    // ── FUEL MODAL ──
    if (modal === "fuel") {
        const errors = {};
        errors.litres = validators.required(form.litres) || validators.positiveNumber(form.litres);
        errors.pricePerL = validators.required(form.pricePerL) || validators.positiveNumber(form.pricePerL);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Fuel Entry" : "Log Fuel Fill-up"} onSave={() => saveItem("fuel", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={S.fgg(2)}>
                    <Field label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} />
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Litres" k="litres" type="number" form={form} setForm={setForm} S={S} error={errors.litres} />
                    <Field label="Price per Litre (KES)" k="pricePerL" type="number" form={form} setForm={setForm} S={S} error={errors.pricePerL} />
                    {form.litres && form.pricePerL && (
                        <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                            <div style={{ background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f97316", fontWeight: 700 }}>
                                Estimated cost: {fmt(+form.litres * +form.pricePerL)}
                            </div>
                        </div>
                    )}
                    <Field label="Station Name" k="station" form={form} setForm={setForm} S={S} />
                    <Field label="Odometer Reading (km)" k="odom" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} full form={form} setForm={setForm} S={S} />
                    
                    <div style={{ ...S.fg, gridColumn: "1/-1", paddingTop: 12, borderTop: `1px solid ${T.border2}`, marginTop: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: T.text }}>Fuel verification photos</div>
                        <div style={S.fgg(3)}>
                            <FuelPhotoField label="Pump Display" k="photoPump" form={form} setForm={setForm} S={S} T={T} />
                            <FuelPhotoField label="Fuel Receipt" k="photoReceipt" form={form} setForm={setForm} S={S} T={T} />
                            <FuelPhotoField label="Truck Odometer" k="photoOdom" form={form} setForm={setForm} S={S} T={T} />
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    // ── EXPENSE MODAL ──
    if (modal === "expense") {
        const errors = {};
        errors.amount = validators.required(form.amount) || validators.positiveNumber(form.amount);
        const hasErrors = Object.values(errors).some(Boolean);
        const CATS = ["Maintenance", "Toll", "Permit", "Tyre", "Fuel", "Salary", "Allowance", "Other"];

        return (
            <Modal title={form.id ? "Edit Expense" : "Add New Expense"} onSave={() => saveItem("expenses", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={S.fgg(2)}>
                    <Field label="Truck / Vehicle" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} />
                    <div style={S.fg}>
                        <label style={S.lbl}>Category</label>
                        <select 
                            style={S.inp} 
                            value={form.cat || ""} 
                            onChange={e => setForm(f => ({ ...f, cat: e.target.value, subCat: "" }))}
                        >
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
                            form={form} 
                            setForm={setForm} 
                            S={S} 
                        />
                    )}

                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} error={errors.amount} />
                    <Field label="Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Description" k="desc" full form={form} setForm={setForm} S={S} placeholder="e.g. Workshop repair, Toll fee..." />
                    <Field label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} full form={form} setForm={setForm} S={S} />
                    
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <FuelPhotoField label="Receipt / Invoice Photo" k="receiptUrl" form={form} setForm={setForm} S={S} T={T} />
                    </div>

                    <div style={{ ...S.fg, gridColumn: "1/-1", paddingTop: 16, marginTop: 8, borderTop: `1px solid var(--border-subtle)` }}>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                            Tip: Expenses linked to a journey will be automatically factored into that journey's P&L calculation.
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    // ── INVOICE MODAL ──
    if (modal === "invoice") {
        const errors = {};
        errors.amount = validators.required(form.amount) || validators.positiveNumber(form.amount);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Invoice" : "Generate New Invoice"} onSave={() => { 
                if (!form.id) form.id = INVOICE_PREFIX + "-" + uid().slice(0, 5); 
                saveItem("invoices", form); 
            }} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={S.fgg(2)}>
                    <Field label="Customer" k="customerId" options={data.customers.map(c => ({ v: c.id, l: c.name }))} form={form} setForm={setForm} S={S} />
                    <Field label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} form={form} setForm={setForm} S={S} />
                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} error={errors.amount} />
                    
                    {form.amount && (
                        <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                            <div style={{ background: "rgba(56, 189, 248, 0.05)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>
                                <span>Subtotal: </span><b style={{ color: "var(--brand-primary)" }}>{fmt(Math.round(+form.amount / 1.16))}</b>
                                <span style={{ margin: "0 10px", opacity: 0.3 }}>|</span>
                                <span>VAT (16%): </span><b style={{ color: "#f59e0b" }}>{fmt(+form.amount - Math.round(+form.amount / 1.16))}</b>
                                <span style={{ margin: "0 10px", opacity: 0.3 }}>|</span>
                                <span>Total: </span><b style={{ color: "#10b981" }}>{fmt(+form.amount)}</b>
                            </div>
                        </div>
                    )}
                    
                    <Field label="Date Issued" k="issued" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Due Date" k="due" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Status" k="status" options={["Pending", "Paid", "Overdue", "Partial"]} form={form} setForm={setForm} S={S} />
                    <Field label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567" form={form} setForm={setForm} S={S} />
                    <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                </div>
            </Modal>
        );
    }

    // ── LOG PAYMENT MODAL ──
    if (modal === "logPayment") {
        return (
            <Modal title={`Log Payment for ${form.invoiceId}`} onSave={() => saveItem("payments", form)} S={S} closeModal={closeModal}>
                <div style={S.fgg(2)}>
                    <Field label="Payment Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Payment Method" k="method" options={['M-Pesa', 'Bank Transfer', 'Cheque', 'Cash']} form={form} setForm={setForm} S={S} />
                    <Field label="Reference No." k="ref" placeholder="e.g. QJK1234567" form={form} setForm={setForm} S={S} />
                    <Field label="Notes" k="notes" full form={form} setForm={setForm} S={S} />
                </div>
            </Modal>
        );
    }

    // ── PAYROLL MODAL ──
    if (modal === "payroll") {
        const errors = {};
        errors.baseSalary = validators.required(form.baseSalary) || validators.positiveNumber(form.baseSalary);
        const hasErrors = Object.values(errors).some(Boolean);

        return (
            <Modal title={form.id ? "Edit Pay Record" : "Add New Pay Record"} onSave={() => saveItem("payroll", form)} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={S.fgg(2)}>
                    <Field label="Employee / Driver" k="driver" options={[
                        ...data.drivers.map(d => ({ v: d.id, l: `Driver: ${d.name}` })),
                        ...(data.staff || []).map(s => ({ v: s.id, l: `Staff: ${s.name}` })),
                        ...(data.turnboys || []).map(t => ({ v: t.id, l: `Turnboy: ${t.name}` }))
                    ]} form={form} setForm={setForm} S={S} />
                    
                    <div style={S.fg}>
                        <label style={S.lbl}>Payment Month</label>
                        <input type="month" className="input-premium" value={form.month || ""} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} style={{ height: 42, width: "100%" }} />
                    </div>

                    <Field label="Base Salary (KES)" k="baseSalary" type="number" form={form} setForm={setForm} S={S} error={errors.baseSalary} />
                    <Field label="Allowances (KES)" k="allowance" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Deductions (KES)" k="deductions" type="number" form={form} setForm={setForm} S={S} />
                    
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#10b981", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>NET DISBURSEMENT</span>
                            <span style={{ fontSize: 18 }}>{fmt((+form.baseSalary || 0) + (+form.allowance || 0) - (+form.deductions || 0))}</span>
                        </div>
                    </div>

                    <Field label="Status" k="status" options={["Pending", "Paid"]} form={form} setForm={setForm} S={S} />
                    <Field label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. PAY1234567" form={form} setForm={setForm} S={S} />
                    <Field label="Date Paid" k="paidDate" type="date" form={form} setForm={setForm} S={S} />
                    
                    {/* Monthly Mileage Auto-Summary */}
                    {form.driver && form.month && (
                        <div style={{ ...S.fg, gridColumn: "1/-1", marginTop: 8 }}>
                            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: `1px solid var(--border-subtle)`, padding: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Summary ({monthLabel(form.month)})</div>
                                {(() => {
                                    const drvJourneys = data.journeys.filter(j => j.driver === form.driver && j.date?.startsWith(form.month) && j.status === 'Completed');
                                    const totalMileage = drvJourneys.reduce((s, j) => s + (j.driverMileage || 0), 0);
                                    
                                    if (drvJourneys.length === 0) return <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No completed journeys found.</div>;
                                    
                                    return (
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--brand-primary)" }}>{fmt(totalMileage)} Mileage</div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Calculated from {drvJourneys.length} mission(s)</div>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); setForm(f => ({ ...f, allowance: totalMileage })); }} style={{ border: "1px solid var(--brand-primary)", color: "var(--brand-primary)" }}>
                                                Apply to Allowances
                                            </Button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    // ── JOURNEY MODAL ──
    if (modal === "journey") {
        const errors = {};
        errors.revenue = validators.required(form.revenue) || validators.positiveNumber(form.revenue);
        // errors.distance = validators.required(form.distance) || validators.positiveNumber(form.distance);
        errors.endDate = validators.dateOrder(form.date, form.endDate);
        if (!form.returningEmpty) {
            errors.customerId = validators.required(form.customerId);
            errors.deliveryCustomerId = validators.required(form.deliveryCustomerId);    
        }
        if (form.isInternational) {
            errors.booking_no = validators.required(form.booking_no);
            errors.tr_form_url = validators.required(form.tr_form_url);
        }
        const hasErrors = Object.values(errors).some(Boolean);

        const _S = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
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
                const [o, d] = key.split('→');
                return { origin: o, dest: d, driverRate: val.driver, turnboyRate: val.turnboy, returnDriverRate: val.returnDriver, returnTurnboyRate: val.returnTurnboy };
            });
            const override = routeOverridesArr.find(ro => 
                (ro.origin?.trim() === origin?.trim() && ro.dest?.trim() === dest?.trim()) ||
                (ro.origin?.trim() === dest?.trim() && ro.dest?.trim() === origin?.trim())
            );

            let dRate, tRate;
            let isFlatRate = false;

            if (override) {
                const oDRate = isReturning && override.returnDriverRate != null ? +override.returnDriverRate : +override.driverRate;
                const oTRate = isReturning && override.returnTurnboyRate != null ? +override.returnTurnboyRate : +override.turnboyRate;
                dRate = oDRate;
                tRate = oTRate;
            } else {
                // If no route override, check for International/Domestic Flat Rates
                const flatDriver = isInternational ? (_S.flatRateOutsideDriver || 0) : (_S.flatRateInsideDriver || 0);
                const flatTurnboy = isInternational ? (_S.flatRateOutsideTurnboy || 0) : (_S.flatRateInsideTurnboy || 0);
                
                if (flatDriver > 0) {
                    dRate = flatDriver;
                    tRate = flatTurnboy;
                    isFlatRate = true;
                } else {
                    dRate = DRIVER_PER_KM;
                    tRate = TURNBOY_PER_KM;
                }
            }

            // Road User Allowance calculation
            const rua = isReturning ? (_S.roadUserAllowanceReturn || _S.roadUserAllowance || 0) : (_S.roadUserAllowance || 0);

            return {
                driver: dRate,
                turnboy: tRate,
                isOverride: !!override,
                isFlatRate,
                roadUserAllowance: rua,
                routeKey: `${origin.trim()}→${dest.trim()}`,
            };
        };


        const onSave = () => {
            if (!form.returningEmpty && (!form.customerId || !form.deliveryCustomerId)) {
                showToast?.('Billing customer and delivery customer are required (used on the waybill).', 'error');
                return;
            }
            const wasNew = !form.id;
            const dist = +form.distance || 0;
            const rates = getEffectiveRates(form.origin, form.dest);
            
            // Calculate mileage/flat-rate allowance
            const driverMileage = rates.isFlatRate ? rates.driver : Math.round(dist * rates.driver);
            const turnboyMileage = (form.turnboyId || form.turnboyName) ? (rates.isFlatRate ? rates.turnboy : Math.round(dist * rates.turnboy)) : 0;
            const roadUserAllowance = rates.roadUserAllowance || 0;
            
            const enrichedForm = { 
                ...form, 
                id: form.id || uid(),
                driverMileage, 
                turnboyMileage,
                roadUserAllowance,
                mileageRateUsed: rates.driver,
                turnboyMileageRateUsed: rates.turnboy,
                mileageRouteOverride: rates.isOverride,
                isFlatRate: rates.isFlatRate
            };
            saveItem("journeys", enrichedForm, { skipClose: true, silent: true });

            if (driverMileage > 0 && !form.id) {
                const descPrefix = rates.isFlatRate ? "Flat rate allowance" : `Mileage allowance (${dist} km @ KES ${rates.driver}/km)`;
                saveItem("expenses", {
                    date: form.date || today(),
                    truck: form.truck,
                    cat: "Allowance",
                    category: "Allowance",
                    amount: driverMileage,
                    desc: `Driver ${descPrefix} — ${form.origin} → ${form.dest}`,
                    journey: enrichedForm.id,
                    status: "Unpaid"
                }, { skipClose: true, silent: true });
            }
            if (turnboyMileage > 0 && !form.id && (form.turnboyId || form.turnboyName)) {
                const tbName = form.turnboyId ? (data.turnboys?.find(t => t.id === form.turnboyId)?.name || form.turnboyId) : form.turnboyName;
                const descPrefix = rates.isFlatRate ? "Flat rate allowance" : `Mileage allowance (${dist} km @ KES ${rates.turnboy}/km)`;
                saveItem("expenses", {
                    date: form.date || today(),
                    truck: form.truck,
                    cat: "Allowance",
                    category: "Allowance",
                    amount: turnboyMileage,
                    desc: `Turnboy ${descPrefix} (${tbName}) — ${form.origin} → ${form.dest}`,
                    journey: enrichedForm.id,
                    status: "Unpaid"
                }, { skipClose: true, silent: true });
            }

            // Auto-create Road User Allowance expense
            if (roadUserAllowance > 0 && !form.id) {
                saveItem("expenses", {
                    date: form.date || today(),
                    truck: form.truck,
                    cat: "Allowance",
                    category: "Allowance",
                    amount: roadUserAllowance,
                    desc: `Road User Allowance${form.returningEmpty ? " (Return)" : ""} — ${form.origin} → ${form.dest}`,
                    journey: enrichedForm.id,
                    status: "Unpaid"
                }, { skipClose: true, silent: true });
            }
            
            // Auto-generate invoice when journey is Accepted or Loading
            if (!form.returningEmpty && (enrichedForm.status === "Accepted" || enrichedForm.status === "Loading")) {
                const existingInvoice = data.invoices?.find(inv => inv.journey === enrichedForm.id);
                if (!existingInvoice) {
                    const invoiceId = (INVOICE_PREFIX || "INV") + "-" + uid().slice(0, 5);
                    const issuedDate = today();
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + (PAYMENT_TERMS_DAYS || 14));
                    const dueDateStr = dueDate.toISOString().split('T')[0];
                    
                    const billingCust = data.customers.find(c => c.id === form.customerId);
                    
                    saveItem("invoices", {
                        id: invoiceId,
                        customerId: form.customerId,
                        client: billingCust?.name || "",
                        phone: billingCust?.phone || "",
                        journey: enrichedForm.id,
                        amount: enrichedForm.revenue,
                        issued: issuedDate,
                        due: dueDateStr,
                        status: "Pending",
                        notes: `Automated invoice for journey ${enrichedForm.origin} → ${enrichedForm.dest}. Cargo: ${enrichedForm.cargo || "N/A"}`
                    }, { skipClose: true, silent: true });
                    
                    showToast?.(`Invoice ${invoiceId} generated automatically.`, "success");
                }
            }

            showToast?.("Record saved", "success");
            closeModal();

            if (
                wasNew &&
                openWaybillGenerator &&
                (enrichedForm.status === "Loading" || enrichedForm.status === "In Transit")
            ) {
                if (
                    window.confirm(
                        "Generate a road freight waybill for this journey? You can complete carrier, cargo, and customs details, then print four copies (consignor, consignee, driver, KRA / customs)."
                    )
                ) {
                    openWaybillGenerator(enrichedForm);
                }
            }
        };

        return (
            <Modal title={form.id ? "Edit Journey" : "Log New Journey"} onSave={onSave} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={S.fgg(2)}>
                    
                    {/* --- SECTION 1: ROUTE & LOGISTICS --- */}
                    <SectionHeader title="Route & Logistics" icon="📍" T={T} style={{ marginTop: 0 }} />
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <label style={S.lbl}>Quick Route</label>
                        <select style={{ ...S.inp, background: 'var(--surface-subtle)' }} onChange={e => {
                            const route = commonRoutes.find(r => `${r.origin}→${r.dest}` === e.target.value);
                            if (route) setForm(f => ({ ...f, origin: route.origin, dest: route.dest, distance: route.distance }));
                        }} defaultValue="">
                            <option value="">— Select a common route or fill in manually below —</option>
                            {commonRoutes.map(r => <option key={`${r.origin}→${r.dest}`} value={`${r.origin}→${r.dest}`}>{r.origin} → {r.dest} ({r.distance} km)</option>)}
                        </select>
                    </div>
                    
                    <Field label="Origin" k="origin" form={form} setForm={setForm} S={S} />
                    <Field label="Destination" k="dest" form={form} setForm={setForm} S={S} />
                    
                    <Field label="Pickup Address" k="pickupAddress" full form={form} setForm={setForm} S={S} placeholder="Specific location details at origin..." />
                    <Field label="Delivery Address" k="deliveryAddress" full form={form} setForm={setForm} S={S} placeholder="Specific unloading point details..." />

                    <Field label="Departure Date" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Arrival Date" k="endDate" type="date" form={form} setForm={setForm} S={S} error={errors.endDate} />
                    {/* --- SECTION 2: VEHICLE & CREW --- */}
                    <SectionHeader title="Vehicle & Crew" icon="🚛" T={T} />
                    
                    <div style={S.fg}>
                        <label style={S.lbl}>
                            Truck
                            {vehicleLocked && <span style={{ fontWeight: 800, color: "var(--brand-primary)", marginLeft: 8, fontSize: 10, background: 'var(--brand-primary)12', padding: '2px 6px', borderRadius: 4 }}>LOCKED</span>}
                        </label>
                        <select
                            style={{ ...S.inp }}
                            value={form.truck || ""}
                            onChange={(e) => {
                                const truck = data.trucks.find((t) => t.id === e.target.value);
                                setForm((f) => ({
                                    ...f,
                                    truck: e.target.value,
                                    driver: truck?.driver || f.driver,
                                    startOdom: truck?.odom || f.startOdom,
                                }));
                            }}
                        >
                            <option value="">Select…</option>
                            {data.trucks.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.reg}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={S.fg}>
                        <label style={S.lbl}>Trailer</label>
                        <select
                            style={{ ...S.inp }}
                            value={form.trailer || ""}
                            onChange={(e) => setForm((f) => ({ ...f, trailer: e.target.value }))}
                        >
                            <option value="">Select…</option>
                            {(data.trailers || []).map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.reg} ({t.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <Field
                        label="Driver"
                        k="driver"
                        options={data.drivers.map((d) => ({ v: d.id, l: d.name }))}
                        form={form}
                        setForm={setForm}
                        S={S}
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

                    <Field label="Status" k="status" options={STATUSES_JOURNEY} form={form} setForm={setForm} S={S} />

                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ padding: '16px', background: 'var(--surface-subtle)', borderRadius: 12, border: `1px solid ${T.border2}`, marginTop: 4 }}>
                            <div style={{ fontWeight: 800, color: T.text, fontSize: 11, textTransform: 'uppercase', marginBottom: 14, opacity: 0.7, letterSpacing: '0.05em' }}>
                                Turnboy / Second Driver (Optional)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                                <div style={S.fg}>
                                    <label style={S.lbl}>Type</label>
                                    <select style={S.inp} value={form.turnboyType || ''} onChange={e => {
                                        setForm(f => ({ ...f, turnboyType: e.target.value, turnboyId: '', turnboyName: '' }));
                                    }}>
                                        <option value="">None — solo driver</option>
                                        <option value="salaried">Salaried turnboy (from company list)</option>
                                        <option value="casual">Casual / one-off turnboy</option>
                                    </select>
                                </div>
                                
                                {form.turnboyType === 'salaried' && (
                                    <Field 
                                        label="Select Turnboy" 
                                        k="turnboyId" 
                                        options={(data.turnboys || []).filter(tb => tb.status === 'Active').map(tb => ({ v: tb.id, l: tb.name }))} 
                                        form={form} setForm={setForm} S={S} 
                                    />
                                )}
                                {form.turnboyType === 'casual' && (
                                    <Field label="Name / Phone" k="turnboyName" form={form} setForm={setForm} S={S} placeholder="Full Name..." />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- SECTION 3: CARGO & FINANCIALS --- */}
                    <SectionHeader title="Cargo & Financials" icon="💰" T={T} />

                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 16px', background: form.isInternational ? 'rgba(7,131,235,0.06)' : 'var(--surface-subtle)', borderRadius: 12, border: `1px solid ${form.isInternational ? 'var(--brand-primary)' : 'var(--border-subtle)'}` }}>
                                <input type="checkbox" checked={!!form.isInternational} onChange={e => setForm(f => ({ ...f, isInternational: e.target.checked }))} style={{ width: 17, height: 17, accentColor: 'var(--brand-primary)' }} />
                                <div>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13 }}>International Trip</div>
                                </div>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 16px', background: form.returningEmpty ? 'rgba(251,191,36,0.06)' : 'var(--surface-subtle)', borderRadius: 12, border: `1px solid ${form.returningEmpty ? '#f59e0b' : 'var(--border-subtle)'}` }}>
                                <input type="checkbox" checked={!!form.returningEmpty} onChange={e => setForm(f => ({ ...f, returningEmpty: e.target.checked, customerId: e.target.checked ? '' : f.customerId, deliveryCustomerId: e.target.checked ? '' : f.deliveryCustomerId }))} style={{ width: 17, height: 17, accentColor: '#f59e0b' }} />
                                <div>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13 }}>Return / Empty</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style={S.fg}>
                        <label style={S.lbl}>Cargo Description</label>
                        <input style={S.inp} list="cargo-types-list" value={form.cargo || ''} placeholder="Type or select…"
                            onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                        <datalist id="cargo-types-list">
                            {CARGO_TYPES.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>

                    <Field label="Weight (Tonnes)" k="weight" type="number" form={form} setForm={setForm} S={S} />
                    
                    <Field label="Distance (km)" k="distance" type="number" form={form} setForm={setForm} S={S} />
                    <Field label="Revenue (KES)" k="revenue" type="number" form={form} setForm={setForm} S={S} error={errors.revenue} />

                    {!form.returningEmpty && (
                        <div style={{ ...S.fg, gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, background: 'var(--surface-subtle)', padding: 16, borderRadius: 14, border: `1px solid ${T.border2}`, marginTop: 4 }}>
                            
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <label style={{ ...S.lbl, marginBottom: 0 }}>Consignor (Bill to)</label>
                                    <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, _quickAddBill: !f._quickAddBill, _quickAddDel: false }))}
                                        style={{ border: "none", background: "none", color: "var(--brand-primary)", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                                    >
                                        {form._quickAddBill ? "Cancel" : "Add new"}
                                    </button>
                                </div>
                                {form._quickAddBill ? (
                                    <div style={{ background: "white", padding: 10, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                        <input style={{ ...S.inp, height: 34, fontSize: 12, marginBottom: 8 }} placeholder="Company/Person Name…" id="qa-bill-name" />
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <input style={{ ...S.inp, height: 34, fontSize: 12, flex: 1 }} placeholder="Phone…" id="qa-bill-phone" />
                                            <button
                                                type="button"
                                                style={{ padding: "0 12px", borderRadius: 8, background: "var(--brand-primary)", color: "white", border: "none", fontWeight: 800, fontSize: 11 }}
                                                onClick={() => {
                                                    const name = document.getElementById("qa-bill-name")?.value;
                                                    const phone = document.getElementById("qa-bill-phone")?.value;
                                                    if (!name?.trim() || !phone?.trim()) return alert("Name & Phone required");
                                                    const id = uid();
                                                    saveItem("customers", { id, name: name.trim(), phone: phone || "", type: "Individual", status: "Active" });
                                                    setForm((f) => ({ ...f, customerId: id, _quickAddBill: false }));
                                                }}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        style={{ ...S.inp, border: errors.customerId ? "1px solid #DC2626" : S.inp.border }}
                                        value={form.customerId || ""}
                                        onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                                    >
                                        <option value="">Select customer…</option>
                                        {data.customers.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <label style={{ ...S.lbl, marginBottom: 0 }}>Consignee (Deliver to)</label>
                                    <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, _quickAddDel: !f._quickAddDel, _quickAddBill: false }))}
                                        style={{ border: "none", background: "none", color: "var(--brand-primary)", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                                    >
                                        {form._quickAddDel ? "Cancel" : "Add new"}
                                    </button>
                                </div>
                                {form._quickAddDel ? (
                                    <div style={{ background: "white", padding: 10, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                        <input style={{ ...S.inp, height: 34, fontSize: 12, marginBottom: 8 }} placeholder="Site/Person Name…" id="qa-del-name" />
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <input style={{ ...S.inp, height: 34, fontSize: 12, flex: 1 }} placeholder="Phone…" id="qa-del-phone" />
                                            <button
                                                type="button"
                                                style={{ padding: "0 12px", borderRadius: 8, background: "var(--brand-primary)", color: "white", border: "none", fontWeight: 800, fontSize: 11 }}
                                                onClick={() => {
                                                    const name = document.getElementById("qa-del-name")?.value;
                                                    const phone = document.getElementById("qa-del-phone")?.value;
                                                    if (!name?.trim() || !phone?.trim()) return alert("Name & Phone required");
                                                    const id = uid();
                                                    saveItem("customers", { id, name: name.trim(), phone: phone || "", type: "Individual", status: "Active" });
                                                    setForm((f) => ({ ...f, deliveryCustomerId: id, _quickAddDel: false }));
                                                }}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        style={{ ...S.inp, border: errors.deliveryCustomerId ? "1px solid #DC2626" : S.inp.border }}
                                        value={form.deliveryCustomerId || ""}
                                        onChange={(e) => setForm((f) => ({ ...f, deliveryCustomerId: e.target.value }))}
                                    >
                                        <option value="">Select customer…</option>
                                        {data.customers.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Allowance Preview */}
                    {(form.origin && form.dest && (form.distance || form.isInternational)) && (
                        <div style={{ ...S.fg, gridColumn: "1/-1", marginTop: 4 }}>
                            {(() => {
                                const rates = getEffectiveRates(form.origin, form.dest);
                                const allowance = rates.isFlatRate ? rates.driver : Math.round(+form.distance * rates.driver);
                                const rua = rates.roadUserAllowance || 0;
                                const total = allowance + rua;
                                return (
                                    <div style={{ display: "grid", gap: 8, padding: '16px', border: `1px solid var(--brand-primary)33`, borderRadius: 12, background: 'var(--brand-primary)05' }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: 10, color: "var(--brand-primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {rates.isFlatRate ? "Flat Rate Allowance" : "Mileage Allowance"}
                                                    {rates.isOverride && <span style={{ background: 'var(--brand-primary)15', color: 'var(--brand-primary)', padding: '2px 6px', borderRadius: 6, fontSize: 9 }}>ROUTE RATE</span>}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                                                    {rates.isFlatRate ? "International/Domestic Flat Rate" : `${Number(form.distance).toLocaleString()} km @ ${fmt(rates.driver)}/km`}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--brand-primary)" }}>{fmt(allowance)}</div>
                                        </div>
                                        {rua > 0 && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px dashed var(--brand-primary)15`, paddingTop: 8 }}>
                                                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Road User Allowance</div>
                                                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{fmt(rua)}</div>
                                            </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid var(--brand-primary)20`, paddingTop: 10 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800 }}>Total Projected</div>
                                            <div style={{ fontSize: 22, fontWeight: 950, color: "var(--brand-primary)" }}>{fmt(total)}</div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* --- SECTION 4: DOCUMENTATION & ODOMETER --- */}
                    <SectionHeader title="Documentation & Odometer" icon="📄" T={T} />
                    
                    <Field label="Start Odom (km)" k="startOdom" type="number" form={form} setForm={setForm} S={S} 
                        onChange={v => setForm(f => ({ ...f, startOdom: v, distance: f.finalOdom ? Math.max(0, +f.finalOdom - +v) : f.distance }))} />
                    <Field label="Final Odom (km)" k="finalOdom" type="number" form={form} setForm={setForm} S={S} 
                        onChange={v => setForm(f => ({ ...f, finalOdom: v, distance: f.startOdom ? Math.max(0, +v - +f.startOdom) : f.distance }))} />

                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                            <JourneyOdomPhotoField label="Start Odometer Pic" k="adminStartOdomPhotoUrl" form={form} setForm={setForm} S={S} T={T} />
                            <JourneyOdomPhotoField label="Final Odometer Pic" k="adminEndOdomPhotoUrl" form={form} setForm={setForm} S={S} T={T} />
                        </div>
                    </div>

                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                            <Field label="KRA Booking No" k="booking_no" form={form} setForm={setForm} S={S} error={errors.booking_no} required={!!form.isInternational} placeholder="Optional..." />
                            
                            <JourneyDocumentField 
                                label={form.isInternational ? "TR Form (KRA)" : "T1 Form (Domestic)"} 
                                k={form.isInternational ? "tr_form_url" : "t1_form_url"} 
                                form={form} 
                                setForm={setForm} 
                                S={S} 
                                T={T} 
                                required={!!form.isInternational} 
                            />
                        </div>
                    </div>

                    <Field label="Internal Notes" k="notes" form={form} setForm={setForm} S={S} full placeholder="Any specific instructions or remarks..." />
                </div>
            </Modal>
        );
    }

    // ── MAINTENANCE MODAL ──
    if (modal === "maintenance") {
        const submitLog = () => {
            if (!form.date || !form.odom) {
                alert('❌ Date and odometer reading are required');
                return;
            }
            const taskName = form.task === 'Custom' ? form.customTask : form.task;
            const entry = {
                truck: form.truck,
                date: form.date,
                cat: 'Maintenance',
                amount: +(form.cost || 0),
                odom: +form.odom,
                desc: `${taskName}${form.notes ? ' — ' + form.notes : ''}`,
                _maintenanceTask: taskName,
                _maintenanceDetails: {
                    task: taskName,
                    workshop: form.workshop || '',
                    cost: +(form.cost || 0),
                    odomReading: +form.odom,
                    receiptUrl: form.receiptUrl || '',
                    notes: form.notes || '',
                },
            };
            saveItem('expenses', entry);

            // Update truck odometer if new reading is higher
            const truckObj = data.trucks.find(t => t.id === form.truck);
            if (+form.odom > +(truckObj?.odom || 0)) {
                setData(d => ({
                    ...d,
                    trucks: d.trucks.map(t => t.id === form.truck ? { ...t, odom: +form.odom } : t),
                }));
            }
        };

        const DEFAULT_SCHEDULE = [
            { task: 'Oil Change',                  intervalKm: 10000 },
            { task: 'Tyre Rotation',               intervalKm: 10000 },
            { task: 'Wheel Alignment & Balancing', intervalKm: 10000 },
            { task: 'Brake Disc Inspection',       intervalKm: 15000 },
            { task: 'Brake Pad Replacement',       intervalKm: 15000 },
            { task: 'Fuel Filter Replacement',     intervalKm: 20000 },
            { task: 'Power Steering Fluid Top-up', intervalKm: 20000 },
            { task: 'Engine Belt Inspection',      intervalKm: 30000 },
            { task: 'Differential Oil Change',     intervalKm: 40000 },
            { task: 'Transmission Fluid Change',   intervalKm: 40000 },
        ];

        const selectedTruck = data.trucks.find(t => t.id === form.truck) || data.trucks[0];

        return (
            <Modal title={form.id ? "Edit service record" : `Log service — ${form.task}`} onSave={submitLog} S={S} closeModal={closeModal}>
                <div style={S.fgg(2)}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={S.lbl}>Truck</label>
                        <select style={S.inp} value={form.truck}
                            onChange={e => setForm(f => ({ ...f, truck: e.target.value }))}>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg} — {Number(t.odom || 0).toLocaleString('en-KE')} km</option>)}
                        </select>
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={S.lbl}>Maintenance task</label>
                        <select style={S.inp} value={form.task}
                            onChange={e => {
                                const found = DEFAULT_SCHEDULE.find(s => s.task === e.target.value);
                                setForm(f => ({ ...f, task: e.target.value, intervalKm: found?.intervalKm || f.intervalKm }));
                            }}>
                            {DEFAULT_SCHEDULE.map(s => <option key={s.task} value={s.task}>{s.task} (every {s.intervalKm.toLocaleString()} km)</option>)}
                            <option value="Custom">Custom task…</option>
                        </select>
                    </div>

                    {form.task === 'Custom' && (
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={S.lbl}>Custom task description</label>
                            <input style={S.inp} placeholder="e.g. Radiator flush" value={form.customTask || ''}
                                onChange={e => setForm(f => ({ ...f, customTask: e.target.value }))} />
                        </div>
                    )}

                    <Field label="Date of service *" k="date" type="date" form={form} setForm={setForm} S={S} />
                    <Field label="Odometer reading (km) *" k="odom" type="number" placeholder={String(selectedTruck?.odom || 0)} form={form} setForm={setForm} S={S} />
                    <Field label="Cost (KES)" k="cost" type="number" placeholder="0" form={form} setForm={setForm} S={S} />
                    <Field label="Workshop / Garage" k="workshop" placeholder="e.g. Nairobi Auto Centre" form={form} setForm={setForm} S={S} />

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={S.lbl}>Notes (optional)</label>
                        <textarea style={{ ...S.inp, height: 60, resize: 'vertical' }}
                            placeholder="Any additional details…"
                            value={form.notes || ''}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={S.lbl}>Receipt / Invoice photo (optional)</label>
                        <label style={{ display: 'block', background: dark ? T.bg : '#f8fafc', border: `1.5px dashed ${form.receiptUploading ? '#38bdf8' : T.border}`, borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 13, color: form.receiptUploading ? '#38bdf8' : T.textDim }}>
                            {form.receiptUploading ? "Uploading…" : form.receiptUrl ? "Receipt on file — click to replace" : "Upload receipt photo"}
                            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                                disabled={form.receiptUploading}
                                onChange={async (e) => {
                                    const file = e.target.files[0]; if (!file) return;
                                    setForm(f => ({ ...f, receiptUploading: true }));
                                    try {
                                        const fd = new FormData();
                                        fd.append('file', file);
                                        const res = await fetch(`${PAYMENT_API}/api/driver/upload`, { method: 'POST', body: fd });
                                        const result = await res.json();
                                        if (result.success) setForm(f => ({ ...f, receiptUrl: result.url, receiptUploading: false }));
                                        else { alert(result.error); setForm(f => ({ ...f, receiptUploading: false })); }
                                    } catch (err) { alert(err.message); setForm(f => ({ ...f, receiptUploading: false })); }
                                    e.target.value = '';
                                }} />
                        </label>
                        {form.receiptUrl && (
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setForm(f => ({ ...f, receiptUrl: '' }))}
                                    style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Remove receipt
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        );
    }

    // ── TRUCK MODAL ──
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
                <div style={S.fgg(2)}>
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <label style={S.lbl}>Internal Unique Number</label>
                        <div style={{ ...S.inp, background: "var(--surface-subtle)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)40", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || 'AUTO-GENERATED ON SAVE'}
                        </div>
                    </div>
                    <Field label="Registration No." k="reg" form={form} setForm={setForm} S={S} T={T} error={errors.reg} />
                    <Field label="Manufacturer / Model" k="make" form={form} setForm={setForm} S={S} T={T} />
                    <div style={{ ...S.fg, alignSelf: 'center', paddingTop: 10 }}>
                        <label style={{ ...S.lbl, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 0 }}>
                            <input
                                type="checkbox"
                                checked={!!form.isRigid}
                                onChange={(e) => setForm((f) => ({ ...f, isRigid: e.target.checked }))}
                            />
                            Rigid Vehicle?
                        </label>
                    </div>
                    <Field label="Year" k="year" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Capacity (tonnes)" k="capacity" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.capacity} />
                    <Field label="Vehicle Type" k="type" options={getTruckTypes()} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status" k="status" options={STATUSES_TRUCK} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Odometer (km)" k="odom" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Assigned Driver" k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    // ── DRIVER MODAL ──
    if (modal === "driver") {
        const toSegechaEmail = (rawEmail, fallbackName) => {
            const source = String(rawEmail || fallbackName || "").trim().toLowerCase();
            const local = (source.includes("@") ? source.split("@")[0] : source)
                .replace(/[^a-z0-9._-]/g, ".")
                .replace(/\.{2,}/g, ".")
                .replace(/^\.+|\.+$/g, "");
            return `${local || "driver"}@example.com`;
        };
        const assignedElsewhere = new Set(
            data.drivers
                .filter((d) => d.id !== form.id && d.truck)
                .map((d) => d.truck)
        );
        const driverTruckOptions = data.trucks
            .filter((t) => !assignedElsewhere.has(t.id) || t.id === form.truck)
            .map((t) => ({ v: t.id, l: t.reg }));
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
            const next = { ...form, id: driverId, email: driverEmail, otp, firstLogin: isNew ? true : form.firstLogin };
            saveItem("drivers", next);

            try {
                // 1. Persist the driver record to the backend 'drivers' table
                await fetch(`${PAYMENT_API}/api/driver/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
                    body: JSON.stringify(next),
                });

                // 2. If new, create the auth account
                if (isNew && driverEmail && driverEmail.includes('@')) {
                    const res = await fetch(`${PAYMENT_API}/api/driver/create-account`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', "x-admin-key": ADMIN_KEY },
                        body: JSON.stringify({ driverId, email: driverEmail, phone: form.phone, driverName, adminKey: ADMIN_KEY }),
                    });
                    const result = await res.json();
                    if (result.success) {
                        const otpHint = result.otp ? ` OTP: ${result.otp}` : "";
                        const tempHint = result.tempPassword ? ` Temp password: ${result.tempPassword}` : "";
                        showToast?.(`Driver account created.${otpHint}${tempHint}`, "success");
                    }
                } else if (!isNew) {
                    showToast?.("Driver record updated.", "success");
                    closeModal();
                }
            } catch (err) {
                console.warn('Persistence failed:', err.message);
                showToast?.("Persistence error.", "error");
            }
        };


        return (
            <Modal title={form.id ? "Edit Driver" : "Add Driver"} onSave={handleDriverSave} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                <div style={S.fgg(2)}>
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <label style={S.lbl}>Internal ID Number</label>
                        <div style={{ ...S.inp, background: "var(--surface-subtle)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)40", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || 'AUTO-GENERATED ON SAVE'}
                        </div>
                    </div>
                    <Field label="Full Name" k="name" full form={form} setForm={setForm} S={S} T={T} error={errors.name} />
                    <Field label="Phone" k="phone" form={form} setForm={setForm} S={S} T={T} error={errors.phone} />
                    <Field label="Email Address" k="email" type="email" placeholder="driver@email.com" form={form} setForm={setForm} S={S} T={T} error={errors.email} />
                    <Field label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" form={form} setForm={setForm} S={S} T={T} error={errors.mpesa} />
                    <Field label="License No." k="license" form={form} setForm={setForm} S={S} T={T} error={errors.license} />
                    <Field label="License class" k="class" type="checkbox-group" options={licenceClasses} full form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.salary} />
                    <Field label="Date Joined" k="joined" type="date" form={form} setForm={setForm} S={S} T={T} />
                    <div style={{ ...S.fg }}>
                        <Field label="Assigned Truck" k="truck" options={driverTruckOptions} form={form} setForm={setForm} S={S} T={T} />
                        <div style={{ marginTop: -8, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                            Only unassigned trucks are shown.
                        </div>
                    </div>
                    <Field
                        label="Default trailer (for locked drivers)"
                        k="assignedTrailer"
                        options={[{ v: "", l: "— None —" }, ...(data.trailers || []).map((t) => ({ v: t.id, l: `${t.reg} (${t.type})` }))]}
                        form={form}
                        setForm={setForm}
                        S={S}
                        T={T}
                    />
                    <div style={{ ...S.fg, gridColumn: "1/-1", flexDirection: "column", alignItems: "stretch" }}>
                        <label style={{ ...S.lbl, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={!!form.lockVehicleAssignment}
                                onChange={(e) => setForm((f) => ({ ...f, lockVehicleAssignment: e.target.checked }))}
                            />
                            Lock truck & trailer on journeys (driver uses office-assigned vehicle only)
                        </label>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                            When enabled, journey truck and trailer follow this driver&apos;s assignment; change assignments here or turn off the lock to reassign from the journey form.
                        </div>
                    </div>
                    <Field label="Status" k="status" options={["Active", "Inactive", "Suspended"]} form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    // ── CUSTOMER MODAL ──
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
                <div style={S.fgg(2)}>
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <label style={S.lbl}>Internal Unique Number</label>
                        <div style={{ ...S.inp, background: "var(--surface-subtle)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)40", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || 'AUTO-GENERATED ON SAVE'}
                        </div>
                    </div>
                    
                    <Field label="Customer Type" k="type" options={["Company", "Individual"]} form={form} setForm={setForm} S={S} />
                    <Field label={form.type === "Company" ? "Company Name" : "Full Name"} k="name" full form={form} setForm={setForm} S={S} error={errors.name} />
                    
                    {form.type === "Company" && (
                        <Field label="Contact Person" k="contactPerson" full form={form} setForm={setForm} S={S} placeholder="e.g. Procurement Officer" />
                    )}
                    
                    <Field label="Phone Number" k="phone" form={form} setForm={setForm} S={S} error={errors.phone} />
                    <Field label="Email Address" k="email" type="email" form={form} setForm={setForm} S={S} />
                    <Field label="Physical Address" k="address" full form={form} setForm={setForm} S={S} />
                </div>
            </Modal>
        );
    }

    // ── STAFF MODAL ──
    // ── TRAILER MODAL ──
    if (modal === "trailer") {
        return (
            <Modal title={form.id ? "Edit Trailer" : "Add Trailer"} onSave={() => saveItem("trailers", form)} S={S} closeModal={closeModal}>
                <div style={S.fgg(2)}>
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <label style={S.lbl}>Internal Unique Number</label>
                        <div style={{ ...S.inp, background: "var(--surface-subtle)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)40", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || 'AUTO-GENERATED ON SAVE'}
                        </div>
                    </div>
                    <Field label="Registration No." k="reg" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Trailer Type" k="type" options={getTrailerTypes()} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Manufacturer / Model" k="make" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Year" k="year" type="number" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status" k="status" options={["Active", "Maintenance", "Inactive"]} form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Current Assigned Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} T={T} />
                </div>
            </Modal>
        );
    }

    if (modal === "staff") {
        const toSegechaEmail = (rawEmail, fallbackName) => {
            const source = String(rawEmail || fallbackName || "").trim().toLowerCase();
            const local = (source.includes("@") ? source.split("@")[0] : source)
                .replace(/[^a-z0-9._-]/g, ".")
                .replace(/\.{2,}/g, ".")
                .replace(/^\.+|\.+$/g, "");
            return `${local || "staff"}@segecha.com`;
        };
        const isDrivingRole = form.role === "Driver" || form.role === "Turnboy";
        const getErrors = () => {
            const e = {};
            e.name = validators.required(form.name);
            e.role = validators.required(form.role);
            if (isDrivingRole) {
                e.phone = validators.required(form.phone) || validators.kenyaPhone(form.phone);
                e.mpesa = validators.required(form.mpesa) || validators.mpesa(form.mpesa);
                e.license = validators.required(form.license);
            }
            e.salary = validators.required(form.salary) || validators.positiveNumber(form.salary);
            return e;
        };
        const errors = getErrors();
        const hasErrors = Object.values(errors).some(Boolean);

        const _S = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
        const ROLES_LIST = _S.roles || ["Office Admin", "Fleet Manager", "Turnboy", "Accountant", "Operations", "Driver", "Other"];
        const DEPTS_LIST = _S.departments || ["Operations", "Finance", "Logistics", "HR"];

        const handleStaffSave = async () => {
            const isNew = !form.id;
            const name = form.name || "";
            const email = toSegechaEmail(form.email, name);
            const staffId = form.id || uid();
            let next = { ...form, id: staffId, email };
            if (isNew) {
                next = {
                    ...next,
                    firstLogin: true,
                    otp: next.otp || Math.floor(100000 + Math.random() * 900000).toString(),
                    tempPassword: next.tempPassword || "",
                };
            }
            saveItem("staff", next);

            try {
                // 1. Persist the staff record to the backend 'staff' table
                await fetch(`${PAYMENT_API}/api/staff/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
                    body: JSON.stringify(next),
                });

                // 2. If new, create the auth account
                if (isNew && email.includes("@")) {
                    const res = await fetch(`${PAYMENT_API}/api/staff/create-account`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
                        body: JSON.stringify({
                            staffId: next.id,
                            email,
                            phone: next.phone,
                            name,
                            role: next.role,
                            adminKey: ADMIN_KEY,
                        }),
                    });
                    const result = await res.json();
                    if (result.success) {
                        setCreationResult(result);
                        // Sync credentials back to global state
                        setData(prev => ({
                            ...prev,
                            staff: (prev.staff || []).map(s => 
                                s.id === staffId ? { ...s, otp: result.otp, tempPassword: result.tempPassword } : s
                            )
                        }));
                        showToast?.(`Staff account created successfully.`, "success");
                    } else {
                        showToast?.(`Account sync failed: ${result.error || 'Server error'}`, "error");
                    }
                } else if (!isNew) {
                    showToast?.("Staff member updated.", "success");
                    closeModal();
                }
            } catch (err) {
                console.warn("Staff save failed:", err.message);
                showToast?.("Persistence error.", "error");
            }
        };



        return (
            <Modal title={form.id ? "Edit Staff Member" : "Add Staff Member"} onSave={handleStaffSave} S={S} closeModal={closeModal} saveDisabled={hasErrors}>
                {creationResult ? (
                    <div style={{ padding: '4px 0' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                            <div style={{ color: '#059669', fontWeight: 800, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#059669' }} />
                                Account Ready For User
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                Provide these temporary credentials to the staff member. They will be required to change their password on first login.
                            </p>
                            
                            <div style={{ display: 'grid', gap: 12 }}>
                                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Login Email</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>{creationResult.email}</div>
                                </div>
                                {creationResult.tempPassword && (
                                    <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Temporary Password</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>{creationResult.tempPassword}</div>
                                    </div>
                                )}
                                {creationResult.otp && (
                                    <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Mobile OTP</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{creationResult.otp}</div>
                                    </div>
                                )}
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                style={{ width: '100%', marginTop: 16, border: '1px dashed var(--border-subtle)' }}
                                onClick={() => {
                                    const text = `Email: ${creationResult.email}${creationResult.tempPassword ? `\nPassword: ${creationResult.tempPassword}` : ''}${creationResult.otp ? `\nOTP: ${creationResult.otp}` : ''}`;
                                    navigator.clipboard.writeText(text);
                                    showToast?.("Credentials copied to clipboard", "success");
                                }}
                            >
                                Copy All Credentials
                            </Button>
                        </div>
                        <Button variant="primary" style={{ width: '100%' }} onClick={closeModal}>Done</Button>
                    </div>
                ) : (
                    <div style={S.fgg(2)}>

                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <label style={S.lbl}>Internal ID Number</label>
                        <div style={{ ...S.inp, background: "var(--surface-subtle)", color: "var(--brand-primary)", fontWeight: 800, fontFamily: "var(--font-mono)", border: "1px dashed var(--brand-primary)40", display: "flex", alignItems: "center", padding: "0 14px", height: 42 }}>
                            {form.uId || 'AUTO-GENERATED ON SAVE'}
                        </div>
                    </div>
                    <Field label="Full Name" k="name" full form={form} setForm={setForm} S={S} T={T} error={errors.name} />
                    <Field label="Role / Title" k="role" options={ROLES_LIST} form={form} setForm={setForm} S={S} T={T} error={errors.role} />
                    <Field label="Department" k="department" options={DEPTS_LIST} form={form} setForm={setForm} S={S} T={T} />
                    <Field
                        label="Phone Number"
                        k="phone"
                        placeholder={isDrivingRole ? "07XXXXXXXX" : undefined}
                        form={form}
                        setForm={setForm}
                        S={S}
                        T={T}
                        error={errors.phone}
                    />
                    <Field
                        label="Email Address"
                        k="email"
                        type="email"
                        placeholder="name@example.com"
                        form={form}
                        setForm={setForm}
                        S={S}
                        T={T}
                    />
                    {isDrivingRole && (
                        <>
                            <Field label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" form={form} setForm={setForm} S={S} T={T} error={errors.mpesa} />
                            <Field label="License No." k="license" form={form} setForm={setForm} S={S} T={T} error={errors.license} />
                            <Field label="License class" k="class" type="checkbox-group" options={licenceClasses} full form={form} setForm={setForm} S={S} T={T} />
                            <Field label="Assigned Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} form={form} setForm={setForm} S={S} T={T} />
                        </>
                    )}
                    <Field label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} S={S} T={T} error={errors.salary} />
                    <Field label="Date Joined" k="joined" type="date" form={form} setForm={setForm} S={S} T={T} />
                    <Field label="Status" k="status" options={["Active", "On Leave", "Inactive"]} form={form} setForm={setForm} S={S} T={T} />
                    
                    {form.firstLogin && (
                        <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 12, padding: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>One-Time Password (OTP)</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "0.2em" }}>{form.otp}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Provide this to the employee for their initial login at portal.example.com</div>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </Modal>
        );
    }


    // ── TEMPLATE SELECTOR MODAL ──
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
            <Modal title="Send Message" onSave={() => {
                props.showToast("Message draft ready — complete send in your email/SMS app if you opened one from the menu.", "success");
                closeModal();
            }} S={S} closeModal={closeModal} saveLabel="Done">
                <div style={S.fgg(1)}>
                    <div style={S.fg}>
                        <label style={S.lbl}>Select Template</label>
                        <select
                            style={S.inp}
                            value={selectedId}
                            onChange={(e) => setForm((f) => ({ ...f, _selectedTemplateId: e.target.value }))}
                        >
                            {templatesList.length === 0 ? (
                                <option value="">No templates — add some in Settings</option>
                            ) : (
                                templatesList.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                                ))
                            )}
                        </select>
                    </div>
                    
                    <div style={{ marginTop: 20, padding: 20, background: "var(--surface-subtle)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 12 }}>{filledSubject}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{filledBody}</div>
                    </div>
                    
                    <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-dim)" }}>
                        Tip: You can customize these templates in <b>Settings &gt; Message Templates</b>.
                    </div>
                </div>
            </Modal>
        );
    }

    return null;
}
