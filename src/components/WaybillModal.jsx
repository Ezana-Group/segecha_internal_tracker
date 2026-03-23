import React from "react";
import { uid } from "../utils/formatters";
import { openWaybillPrintWindow } from "../utils/waybillPrint";

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem("segecha_settings") || "{}");
    } catch {
        return {};
    }
}

export function WaybillModal({ waybillModalJourney, waybillForm, setWaybillForm, setData, closeWaybillModal, dark, S, T }) {
    if (!waybillModalJourney || !waybillForm) return null;

    const f = waybillForm;
    const journey = waybillModalJourney;
    const readOnly =
        journey.waybillGenerated &&
        (journey.status === "Completed" || journey.status === "Awaiting Verification");

    const persistWaybill = (formSnapshot, incrementCounter) => {
        const s = getSettings();
        const firstTime = !journey.waybillGenerated;
        if (firstTime && incrementCounter) {
            const newCounter = (s.waybillCounter ?? 1) + 1;
            localStorage.setItem("segecha_settings", JSON.stringify({ ...s, waybillCounter: newCounter }));
        }
        setData((d) => ({
            ...d,
            journeys: d.journeys.map((j) =>
                j.id === journey.id
                    ? { ...j, waybillGenerated: true, waybillNo: formSnapshot.waybillNo, waybillData: formSnapshot }
                    : j
            ),
        }));
    };

    const set = (key, val) => !readOnly && setWaybillForm((prev) => ({ ...prev, [key]: val }));
    const setDoc = (key, val) =>
        !readOnly &&
        setWaybillForm((prev) => ({ ...prev, docs: { ...prev.docs, [key]: val } }));
    const setCargo = (idx, key, val) =>
        !readOnly &&
        setWaybillForm((prev) => {
            const cargo = [...prev.cargo];
            cargo[idx] = { ...cargo[idx], [key]: val };
            return { ...prev, cargo };
        });
    const addCargoRow = () =>
        !readOnly &&
        setWaybillForm((prev) => ({
            ...prev,
            cargo: [
                ...prev.cargo,
                {
                    id: uid(),
                    description: "",
                    hsCode: "",
                    packages: "",
                    grossKg: "",
                    netKg: "",
                    volumeM3: "",
                    declaredValue: "",
                },
            ],
        }));
    const removeCargoRow = (idx) =>
        !readOnly &&
        setWaybillForm((prev) => ({
            ...prev,
            cargo: prev.cargo.filter((_, i) => i !== idx),
        }));

    const saveAndPrint = () => {
        if (readOnly) return;
        persistWaybill(f, true);
        openWaybillPrintWindow(f);
        closeWaybillModal();
    };

    const saveOnly = () => {
        if (readOnly) {
            closeWaybillModal();
            return;
        }
        persistWaybill(f, true);
        closeWaybillModal();
    };

    const sectionTitle = (label) => (
        <div
            style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: T.textFaint,
                padding: "6px 12px 4px",
                background: T.surface2,
                borderBottom: `0.5px solid ${T.border}`,
                borderTop: `1px solid ${T.border}`,
            }}
            className="wb-section-title"
        >
            {label}
        </div>
    );

    const fieldCell = (label, value, onChange, opts = {}) => {
        const ro = readOnly || opts.readOnly;
        const disabledCb = opts.crossBorderOnly && !f.isCrossBorder;
        return (
            <div
                style={{
                    padding: "8px 12px",
                    borderRight: `0.5px solid ${T.border2}`,
                    flex: 1,
                }}
            >
                <div
                    style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        color: T.textFaint,
                        marginBottom: 3,
                    }}
                >
                    {label}
                    {opts.required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
                    {opts.crossBorderOnly && !f.isCrossBorder && (
                        <span style={{ color: T.amber, fontSize: 8, marginLeft: 4 }}>cross-border</span>
                    )}
                </div>
                {opts.select ? (
                    <select
                        style={{
                            ...S.inp,
                            marginBottom: 0,
                            fontSize: 12,
                            opacity: disabledCb ? 0.4 : 1,
                        }}
                        value={value}
                        disabled={ro || disabledCb}
                        onChange={(e) => onChange(e.target.value)}
                    >
                        {opts.select.map((o) => (
                            <option key={o} value={o}>
                                {o}
                            </option>
                        ))}
                    </select>
                ) : opts.textarea ? (
                    <textarea
                        style={{
                            ...S.inp,
                            marginBottom: 0,
                            fontSize: 12,
                            height: 44,
                            resize: "none",
                            opacity: disabledCb ? 0.4 : 1,
                        }}
                        value={value}
                        readOnly={ro}
                        onChange={(e) => onChange(e.target.value)}
                    />
                ) : (
                    <input
                        style={{
                            ...S.inp,
                            marginBottom: 0,
                            fontSize: 12,
                            fontFamily: opts.mono ? "'DM Mono', monospace" : undefined,
                            opacity: disabledCb ? 0.4 : 1,
                            borderColor:
                                opts.required && !value ? T.red + "88" : undefined,
                        }}
                        type={opts.type || "text"}
                        placeholder={opts.placeholder || ""}
                        value={value}
                        readOnly={ro}
                        onChange={(e) => {
                            if (opts.type === "number") {
                                const n = +e.target.value;
                                onChange(Number.isFinite(n) ? n : 0);
                            } else onChange(e.target.value);
                        }}
                    />
                )}
            </div>
        );
    };

    const totalGrossKg = f.cargo.reduce((s, c) => s + (+c.grossKg || 0), 0);
    const totalNetKg = f.cargo.reduce((s, c) => s + (+c.netKg || 0), 0);
    const totalPackages = f.cargo.reduce((s, c) => s + (+c.packages || 0), 0);
    const totalDeclared = f.cargo.reduce((s, c) => s + (+c.declaredValue || 0), 0);

    return (
        <div
            style={{
                ...S.ovl,
                alignItems: "flex-start",
                padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
                overflowY: "auto",
                overscrollBehavior: "contain",
            }}
            onClick={() => closeWaybillModal()}
        >
            <div
                style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    width: "min(900px,98vw)",
                    maxHeight: "min(92dvh, 920px)",
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    boxShadow: dark
                        ? "0 24px 64px rgba(0,0,0,0.7)"
                        : "0 24px 64px rgba(0,0,0,0.18)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 18px",
                        borderBottom: `1px solid ${T.border}`,
                        background: T.surface2,
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: T.text,
                                fontFamily: "'Syne', sans-serif",
                            }}
                        >
                            Road Freight Waybill — {f.waybillNo}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                            {journey.origin} → {journey.dest} · {journey.date}
                            {f.isCrossBorder && (
                                <span
                                    style={{
                                        marginLeft: 8,
                                        background: T.blueBg,
                                        color: T.blue,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: "1px 7px",
                                        borderRadius: 4,
                                    }}
                                >
                                    Cross-border
                                </span>
                            )}
                            {!f.isCrossBorder && (
                                <span
                                    style={{
                                        marginLeft: 8,
                                        background: T.greenBg,
                                        color: T.green,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: "1px 7px",
                                        borderRadius: 4,
                                    }}
                                >
                                    Domestic
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {!readOnly && (
                            <label
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    color: T.textDim,
                                    cursor: "pointer",
                                    padding: "5px 10px",
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 6,
                                    background: T.surface,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={f.isCrossBorder}
                                    onChange={(e) => set("isCrossBorder", e.target.checked)}
                                />
                                Cross-border mode
                            </label>
                        )}
                        <button style={S.btn("ghost")} onClick={() => closeWaybillModal()}>
                            {readOnly ? "Close" : "Cancel"}
                        </button>
                        {!readOnly && (
                            <>
                                <button style={S.btn("ghost")} onClick={saveOnly}>
                                    Save
                                </button>
                                <button style={S.btn("primary")} onClick={saveAndPrint}>
                                    Save & Print
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ padding: 0 }}>
                    {!readOnly && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 14px",
                                background: T.amberBg,
                                borderBottom: `1px solid ${T.amber}33`,
                                fontSize: 11,
                                color: T.amber,
                                flexWrap: "wrap",
                            }}
                        >
                            <span style={{ fontWeight: 600 }}>Fields marked</span>
                            <span style={{ color: T.red, fontWeight: 700 }}>*</span>
                            <span>
                                are required. Pre-filled sections come from fleet data and Settings → Waybill
                                Defaults.
                            </span>
                            <span
                                style={{
                                    background: T.blueBg,
                                    color: T.blue,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                }}
                            >
                                CB
                            </span>
                            <span>— enable Cross-border mode to unlock.</span>
                        </div>
                    )}
                    {readOnly && (
                        <div
                            style={{
                                padding: "8px 14px",
                                background: T.blueBg,
                                fontSize: 12,
                                color: T.blue,
                                fontWeight: 600,
                            }}
                        >
                            View only — this journey is completed or awaiting verification.
                        </div>
                    )}

                    {sectionTitle("1 · Carrier (transporter) — pre-filled from Settings → Waybill Defaults")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `0.5px solid ${T.border2}`,
                        }}
                    >
                        {fieldCell("Company name", f.carrierName, (v) => set("carrierName", v), {
                            required: true,
                        })}
                        {fieldCell("KRA PIN", f.carrierKraPin, (v) => set("carrierKraPin", v), {
                            required: true,
                            mono: true,
                            placeholder: "P000000000A",
                        })}
                        {fieldCell("NTSA transport licence no.", f.carrierNtsa, (v) => set("carrierNtsa", v), {
                            mono: true,
                        })}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell("Physical address", f.carrierAddress, (v) => set("carrierAddress", v))}
                        {fieldCell("Phone / WhatsApp", f.carrierPhone, (v) => set("carrierPhone", v), {
                            mono: true,
                            placeholder: "+254700000000",
                        })}
                        {fieldCell("Email", f.carrierEmail, (v) => set("carrierEmail", v))}
                    </div>

                    {sectionTitle("2 · Vehicle & driver — pre-filled from fleet data")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr",
                            borderBottom: `0.5px solid ${T.border2}`,
                        }}
                    >
                        {fieldCell("Vehicle registration", f.vehicleReg, (v) => set("vehicleReg", v), {
                            required: true,
                            mono: true,
                        })}
                        {fieldCell("Trailer / chassis reg.", f.trailerReg, (v) => set("trailerReg", v), {
                            mono: true,
                        })}
                        {fieldCell("Vehicle type", f.vehicleType, (v) => set("vehicleType", v))}
                        {fieldCell("Max payload (tonnes)", f.maxPayload, (v) => set("maxPayload", v), {
                            mono: true,
                        })}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell("Driver full name", f.driverName, (v) => set("driverName", v), {
                            required: true,
                        })}
                        {fieldCell("ID / Passport no.", f.driverIdNo, (v) => set("driverIdNo", v), {
                            required: true,
                            mono: true,
                        })}
                        {fieldCell("PSV / DL licence no.", f.driverLicence, (v) => set("driverLicence", v), {
                            mono: true,
                        })}
                        {fieldCell("Driver phone", f.driverPhone, (v) => set("driverPhone", v), { mono: true })}
                    </div>

                    {sectionTitle("3 · Consignor (shipper / sender)")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr",
                            borderBottom: `0.5px solid ${T.border2}`,
                        }}
                    >
                        {fieldCell("Full name / company", f.consignorName, (v) => set("consignorName", v), {
                            required: true,
                        })}
                        {fieldCell("KRA PIN", f.consignorKraPin, (v) => set("consignorKraPin", v), {
                            mono: true,
                            placeholder: "P000000000A",
                        })}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell(
                            "Physical address / loading point",
                            f.consignorAddress,
                            (v) => set("consignorAddress", v),
                            { required: true }
                        )}
                        {fieldCell("Phone", f.consignorPhone, (v) => set("consignorPhone", v), { mono: true })}
                        {fieldCell("Date & time of loading", f.loadingDateTime, (v) => set("loadingDateTime", v), {
                            type: "datetime-local",
                        })}
                    </div>

                    {sectionTitle("4 · Consignee (receiver)")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr",
                            borderBottom: `0.5px solid ${T.border2}`,
                        }}
                    >
                        {fieldCell("Full name / company", f.consigneeName, (v) => set("consigneeName", v), {
                            required: true,
                        })}
                        {fieldCell(
                            "KRA PIN (required cross-border)",
                            f.consigneeKraPin,
                            (v) => set("consigneeKraPin", v),
                            { mono: true, crossBorderOnly: true }
                        )}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell(
                            "Delivery address / off-loading point",
                            f.consigneeAddress,
                            (v) => set("consigneeAddress", v),
                            { required: true }
                        )}
                        {fieldCell("Phone", f.consigneePhone, (v) => set("consigneePhone", v), { mono: true })}
                        {fieldCell(
                            "Expected delivery date",
                            f.expectedDelivery,
                            (v) => set("expectedDelivery", v),
                            { type: "date" }
                        )}
                    </div>

                    {sectionTitle("5 · Route — pre-filled from journey")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr",
                            borderBottom: `0.5px solid ${T.border2}`,
                        }}
                    >
                        {fieldCell("Origin county / town", f.origin, (v) => set("origin", v), { required: true })}
                        {fieldCell("Destination country / town", f.destination, (v) => set("destination", v), {
                            required: true,
                        })}
                        {fieldCell(
                            "Border crossing point",
                            f.borderPoint,
                            (v) => set("borderPoint", v),
                            { crossBorderOnly: true, placeholder: "e.g. Malaba / Busia" }
                        )}
                        {fieldCell("Est. distance (km)", String(f.estDistance), (v) => set("estDistance", +v), {
                            mono: true,
                            type: "number",
                        })}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell(
                            "Approved transit route",
                            f.transitRoute,
                            (v) => set("transitRoute", v),
                            { crossBorderOnly: true, placeholder: "e.g. Northern Corridor — A109" }
                        )}
                        {fieldCell("Odometer at loading (km)", f.odomAtLoading, (v) => set("odomAtLoading", v), {
                            mono: true,
                        })}
                        {fieldCell("Odometer at delivery (km)", f.odomAtDelivery, (v) => set("odomAtDelivery", v), {
                            mono: true,
                        })}
                    </div>

                    {sectionTitle(
                        "6 · Cargo description" +
                            (f.isCrossBorder ? " · HS codes required for cross-border" : "")
                    )}
                    <div style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                        <table style={{ ...S.tbl, minWidth: "100%" }}>
                            <thead>
                                <tr>
                                    {["#", "Description of goods", f.isCrossBorder ? "HS code" : null, "Packages", "Gross kg", "Net kg", "Vol m³", "Declared value (KES)", ""]
                                        .filter(Boolean)
                                        .map((h) => (
                                            <th key={h} style={{ ...S.th, padding: "6px 8px", fontSize: 9 }}>
                                                {h}
                                            </th>
                                        ))}
                                </tr>
                            </thead>
                            <tbody>
                                {f.cargo.map((c, i) => (
                                    <tr key={c.id}>
                                        <td
                                            style={{
                                                ...S.td,
                                                fontSize: 11,
                                                color: T.textFaint,
                                                textAlign: "center",
                                                width: 28,
                                            }}
                                        >
                                            {i + 1}
                                        </td>
                                        <td style={S.td}>
                                            <input
                                                style={{ ...S.inp, marginBottom: 0, fontSize: 12 }}
                                                value={c.description}
                                                readOnly={readOnly}
                                                onChange={(e) => setCargo(i, "description", e.target.value)}
                                                placeholder="e.g. Maize flour, 50kg bags"
                                            />
                                        </td>
                                        {f.isCrossBorder && (
                                            <td style={S.td}>
                                                <input
                                                    style={{
                                                        ...S.inp,
                                                        marginBottom: 0,
                                                        fontSize: 12,
                                                        fontFamily: "'DM Mono', monospace",
                                                        width: 80,
                                                    }}
                                                    value={c.hsCode}
                                                    readOnly={readOnly}
                                                    onChange={(e) => setCargo(i, "hsCode", e.target.value)}
                                                    placeholder="1101.00"
                                                />
                                            </td>
                                        )}
                                        <td style={S.td}>
                                            <input
                                                style={{ ...S.inp, marginBottom: 0, fontSize: 12, width: 70 }}
                                                value={c.packages}
                                                readOnly={readOnly}
                                                onChange={(e) => setCargo(i, "packages", e.target.value)}
                                            />
                                        </td>
                                        <td style={S.td}>
                                            <input
                                                style={{
                                                    ...S.inp,
                                                    marginBottom: 0,
                                                    fontSize: 12,
                                                    fontFamily: "'DM Mono', monospace",
                                                    width: 80,
                                                }}
                                                value={c.grossKg}
                                                readOnly={readOnly}
                                                onChange={(e) => setCargo(i, "grossKg", e.target.value)}
                                            />
                                        </td>
                                        <td style={S.td}>
                                            <input
                                                style={{
                                                    ...S.inp,
                                                    marginBottom: 0,
                                                    fontSize: 12,
                                                    fontFamily: "'DM Mono', monospace",
                                                    width: 80,
                                                }}
                                                value={c.netKg}
                                                readOnly={readOnly}
                                                onChange={(e) => setCargo(i, "netKg", e.target.value)}
                                            />
                                        </td>
                                        <td style={S.td}>
                                            <input
                                                style={{ ...S.inp, marginBottom: 0, fontSize: 12, width: 70 }}
                                                value={c.volumeM3}
                                                readOnly={readOnly}
                                                onChange={(e) => setCargo(i, "volumeM3", e.target.value)}
                                            />
                                        </td>
                                        <td style={S.td}>
                                            <input
                                                style={{
                                                    ...S.inp,
                                                    marginBottom: 0,
                                                    fontSize: 12,
                                                    fontFamily: "'DM Mono', monospace",
                                                    width: 110,
                                                }}
                                                value={c.declaredValue}
                                                readOnly={readOnly}
                                                onChange={(e) => setCargo(i, "declaredValue", e.target.value)}
                                            />
                                        </td>
                                        <td style={S.td}>
                                            {!readOnly && f.cargo.length > 1 && (
                                                <button type="button" style={S.btn("del")} onClick={() => removeCargoRow(i)}>
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td
                                        colSpan={f.isCrossBorder ? 3 : 2}
                                        style={{ ...S.td, textAlign: "right", fontSize: 10, fontWeight: 700 }}
                                    >
                                        Totals
                                    </td>
                                    <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                                        {totalPackages || ""}
                                    </td>
                                    <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                                        {totalGrossKg ? totalGrossKg.toLocaleString("en-KE") : ""}
                                    </td>
                                    <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                                        {totalNetKg ? totalNetKg.toLocaleString("en-KE") : ""}
                                    </td>
                                    <td style={S.td} />
                                    <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                                        {totalDeclared ? "KES " + totalDeclared.toLocaleString("en-KE") : ""}
                                    </td>
                                    <td style={S.td} />
                                </tr>
                            </tbody>
                        </table>
                        {!readOnly && (
                            <button
                                style={{ ...S.btn("ghost"), fontSize: 11, margin: "8px 12px" }}
                                onClick={addCargoRow}
                            >
                                + Add cargo line
                            </button>
                        )}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell("Nature of goods", f.cargoNature, (v) => set("cargoNature", v), {
                            select: ["General", "Perishable", "Hazardous", "Restricted", "Perishable + Hazardous"],
                        })}
                        {fieldCell(
                            "Special handling instructions",
                            f.specialHandling,
                            (v) => set("specialHandling", v),
                            { placeholder: "e.g. Keep dry, do not stack" }
                        )}
                    </div>

                    {sectionTitle("7 · Freight charges")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell("Agreed freight (KES)", f.agreedFreight, (v) => set("agreedFreight", v), {
                            mono: true,
                        })}
                        {fieldCell("Payment terms", f.paymentTerms, (v) => set("paymentTerms", v), {
                            select: ["Collect", "Prepaid", "Third Party"],
                        })}
                        {fieldCell("Advance / deposit paid (KES)", f.advancePaid, (v) => set("advancePaid", v), {
                            mono: true,
                        })}
                        {fieldCell("Balance due on delivery (KES)", f.balanceDue, (v) => set("balanceDue", v), {
                            mono: true,
                        })}
                    </div>

                    {sectionTitle("8 · Documents accompanying consignment")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            padding: "10px 12px",
                            gap: "4px 0",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {[
                            ["commercialInvoice", "Commercial invoice", false],
                            ["packingList", "Packing list", false],
                            ["kraCustomsEntry", "KRA customs entry / IDF", true],
                            ["certOfOrigin", "Certificate of origin (COMESA/EAC)", true],
                            ["comesaLicence", "COMESA carrier licence", true],
                            ["transitBond", "Goods in transit bond", true],
                            ["phytoSanitary", "Phytosanitary / health cert.", false],
                            ["kebsCertificate", "KEBS certificate of conformity", false],
                            ["t1Document", "T1 transit document", true],
                            ["dangerousGoodsDecl", "Dangerous goods declaration", false],
                            ["insuranceCert", "Insurance certificate", false],
                        ].map(([key, label, cbOnly]) => (
                            <label
                                key={key}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                    fontSize: 12,
                                    color: cbOnly && !f.isCrossBorder ? T.textFaint : T.textDim,
                                    cursor: readOnly ? "default" : "pointer",
                                    padding: "3px 0",
                                    opacity: cbOnly && !f.isCrossBorder ? 0.5 : 1,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!f.docs[key]}
                                    disabled={readOnly || (cbOnly && !f.isCrossBorder)}
                                    onChange={(e) => setDoc(key, e.target.checked)}
                                />
                                {label}
                                {cbOnly && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: T.blue,
                                            fontWeight: 600,
                                            padding: "0 4px",
                                            background: T.blueBg,
                                            borderRadius: 2,
                                        }}
                                    >
                                        CB
                                    </span>
                                )}
                            </label>
                        ))}
                        <div style={{ display: "flex", alignItems: "center", gap: 7, gridColumn: "1/-1" }}>
                            <input
                                type="checkbox"
                                checked={String(f.docs.other || "").trim() !== ""}
                                disabled={readOnly}
                                onChange={(e) =>
                                    setDoc("other", e.target.checked ? (f.docs.other || "Other") : "")
                                }
                            />
                            <span style={{ fontSize: 12, color: T.textDim }}>Other:</span>
                            <input
                                style={{ ...S.inp, marginBottom: 0, fontSize: 12, flex: 1, maxWidth: 280 }}
                                value={typeof f.docs.other === "string" ? f.docs.other : ""}
                                readOnly={readOnly}
                                onChange={(e) => setDoc("other", e.target.value)}
                                placeholder="Specify…"
                            />
                        </div>
                    </div>

                    {sectionTitle("9 · Condition of goods & seal")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell("Condition at loading", f.conditionAtLoading, (v) =>
                            set("conditionAtLoading", v)
                        )}
                        {fieldCell(
                            "Seal number(s) / container no.",
                            f.sealNo,
                            (v) => set("sealNo", v),
                            { mono: true, crossBorderOnly: true }
                        )}
                        {fieldCell(
                            "Exceptions at loading (NIL if none)",
                            f.exceptionsAtLoading,
                            (v) => set("exceptionsAtLoading", v)
                        )}
                    </div>

                    {sectionTitle("10 · Delivery receipt — completed on delivery")}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `0.5px solid ${T.border2}`,
                        }}
                    >
                        {fieldCell(
                            "Date & time of delivery",
                            f.deliveryDateTime,
                            (v) => set("deliveryDateTime", v),
                            { type: "datetime-local", placeholder: "Fill on delivery" }
                        )}
                        {fieldCell(
                            "Odometer at delivery (km)",
                            f.odomAtDeliveryFinal,
                            (v) => set("odomAtDeliveryFinal", v),
                            { mono: true }
                        )}
                        {fieldCell(
                            "Condition of goods on arrival",
                            f.conditionOnArrival,
                            (v) => set("conditionOnArrival", v)
                        )}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            borderBottom: `1px solid ${T.border}`,
                        }}
                    >
                        {fieldCell(
                            "Exceptions / damage on delivery (NIL if none)",
                            f.exceptionsOnDelivery,
                            (v) => set("exceptionsOnDelivery", v)
                        )}
                        {fieldCell(
                            "Balance freight received (KES)",
                            f.balanceReceived,
                            (v) => set("balanceReceived", v),
                            { mono: true }
                        )}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            padding: "16px 18px",
                            justifyContent: "flex-end",
                            borderTop: `1px solid ${T.border}`,
                            background: T.surface2,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                color: T.textFaint,
                                marginRight: "auto",
                                alignSelf: "center",
                            }}
                        >
                            Waybill no.{" "}
                            <span
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontWeight: 600,
                                    color: T.text,
                                }}
                            >
                                {f.waybillNo}
                            </span>
                            {f.isCrossBorder ? (
                                <span style={{ color: T.blue, marginLeft: 8 }}>
                                    Cross-border · 4 copies required · KRA PIN mandatory
                                </span>
                            ) : (
                                <span style={{ color: T.green, marginLeft: 8 }}>
                                    Domestic · 4 copies required
                                </span>
                            )}
                        </div>
                        {!readOnly && (
                            <>
                                <button style={S.btn("ghost")} onClick={() => closeWaybillModal()}>
                                    Cancel
                                </button>
                                <button style={S.btn("ghost")} onClick={saveOnly}>
                                    Save without printing
                                </button>
                                <button
                                    style={{ ...S.btn("primary"), padding: "8px 20px" }}
                                    onClick={saveAndPrint}
                                >
                                    Save & Print waybill
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
