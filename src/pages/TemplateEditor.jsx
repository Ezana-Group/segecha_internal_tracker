/**
 * TemplateEditor.jsx
 * Full-page overlay editor for Message Templates.
 * Opened from Settings → Message Templates (table view).
 */

import React, { useState, useCallback, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import {
    ArrowLeft,
    X,
    Save,
    Search,
    Mail,
    FileText,
    MessageCircle,
    Briefcase,
    Key,
    Users,
    Navigation,
    IdCard,
    ClipboardList,
    Shield,
    Tag,
    CreditCard,
    MessageSquare,
} from "lucide-react";
import { uid, canonicalTemplateType } from "../utils/formatters";
import { expandMessageTemplateContext } from "../utils/templateContext";
import { buildMailtoUrl, buildWhatsAppUrl } from "../utils/contactLinks";

/* ─── Placeholder groups ─────────────────────────────────────────────── */
const PLACEHOLDER_GROUPS = [
    {
        cat: "BUSINESS",
        filterCat: "Business",
        icon: Briefcase,
        color: "#3b82f6",
        items: [
            { key: "businessName", desc: "Your company / trading name" },
            { key: "company_name", desc: "Alias for businessName" },
            { key: "today", desc: "Today's date" },
            { key: "footer", desc: "Company name + address footer" },
            { key: "baseUrl", desc: "App base URL" },
            { key: "site", desc: "Site / platform name" },
            { key: "supportEmail", desc: "Support email address" },
            { key: "supportPhone", desc: "Support phone number" },
        ],
    },
    {
        cat: "AUTH & VERIFICATION",
        filterCat: "Auth & Verification",
        icon: Key,
        color: "#8b5cf6",
        items: [
            { key: "verifyUrl", desc: "Account verification link" },
            { key: "resetUrl", desc: "Password reset link" },
            { key: "loginEmail", desc: "Email address used to log in" },
            { key: "otp", desc: "One-time password / code" },
            { key: "loginUrl", desc: "Login page URL" },
        ],
    },
    {
        cat: "CUSTOMER",
        filterCat: "Customer",
        icon: Users,
        color: "#10b981",
        items: [
            { key: "firstName", desc: "Customer first name" },
            { key: "lastName", desc: "Customer last name" },
            { key: "customerName", desc: "Full customer name" },
            { key: "customerEmail", desc: "Customer email address" },
            { key: "customerPhone", desc: "Customer phone number" },
            { key: "loyaltyPoints", desc: "Loyalty / reward points" },
            { key: "customerAddress", desc: "Customer physical address" },
        ],
    },
    {
        cat: "INVOICES",
        filterCat: "Invoices",
        icon: FileText,
        color: "#f97316",
        items: [
            { key: "invoiceId", desc: "Invoice reference number" },
            { key: "invoiceUrl", desc: "Link to view invoice" },
            { key: "paymentUrl", desc: "Link to pay invoice" },
            { key: "amount", desc: "Total invoice amount" },
            { key: "amountDue", desc: "Outstanding amount due" },
            { key: "currency", desc: "Currency code (e.g. KES)" },
            { key: "dueDate", desc: "Invoice due date" },
            { key: "mpesaRef", desc: "M-Pesa payment reference" },
            { key: "invoiceStatus", desc: "Invoice status (paid / pending)" },
            { key: "billingMonth", desc: "Month the invoice covers" },
        ],
    },
    {
        cat: "JOURNEYS & WAYBILL",
        filterCat: "Journeys",
        icon: Navigation,
        color: "#6366f1",
        items: [
            { key: "journeyId", desc: "Journey / trip reference ID" },
            { key: "origin", desc: "Loading point" },
            { key: "destination", desc: "Delivery destination" },
            { key: "dest", desc: "Short alias for destination" },
            { key: "cargo", desc: "Cargo / goods description" },
            { key: "truckReg", desc: "Truck registration plate" },
            { key: "trailerReg", desc: "Trailer registration plate" },
            { key: "driverName", desc: "Assigned driver name" },
            { key: "revenue", desc: "Journey revenue amount" },
            { key: "waybillNo", desc: "Waybill document number" },
            { key: "borderPoint", desc: "Border crossing point" },
            { key: "eta", desc: "Estimated time of arrival" },
            { key: "distance", desc: "Journey distance" },
        ],
    },
    {
        cat: "STAFF & DRIVERS",
        filterCat: "Staff & drivers",
        icon: IdCard,
        color: "#ec4899",
        items: [
            { key: "staffName", desc: "Staff member full name" },
            { key: "staffId", desc: "Staff ID / employee number" },
            { key: "driverId", desc: "Driver ID number" },
            { key: "role", desc: "Staff role / job title" },
            { key: "licenseNo", desc: "Driver licence number" },
        ],
    },
    {
        cat: "DOCUMENTS",
        filterCat: "Documents",
        icon: ClipboardList,
        color: "#64748b",
        items: [
            { key: "docLabel", desc: "Document label / name" },
            { key: "docType", desc: "Document type" },
            { key: "expiryDate", desc: "Document expiry date" },
            { key: "downloadUrl", desc: "Link to download document" },
            { key: "uploadedAt", desc: "Date document was uploaded" },
        ],
    },
];

/* ─── WhatsApp category definitions ─────────────────────────────────── */
const WHATSAPP_CATEGORIES = [
    {
        id: "UTILITY",
        icon: Shield,
        label: "Utility",
        desc: "Confirmations, updates, post-purchase management, etc.",
    },
    {
        id: "MARKETING",
        icon: Tag,
        label: "Marketing",
        desc: "Promotions, product announcements, newsletters.",
    },
    {
        id: "AUTHENTICATION",
        icon: CreditCard,
        label: "Authentication",
        desc: "One-time passwords, login codes, verification.",
    },
    {
        id: "SERVICE",
        icon: MessageSquare,
        label: "Service",
        desc: "Customer support, inquiries, general replies.",
    },
];

/* ─── Slug helper ─────────────────────────────────────────────────────── */
function slugify(str) {
    return String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function retitleForType(text, nextType) {
    const current = String(text || "");
    return current.replace(/^(Email|WhatsApp|PDF)\s+/i, `${nextType} `);
}

/* ─── Sample preview context ─────────────────────────────────────────── */
function buildSampleContext(companyName = "Segecha Group Ltd") {
    return expandMessageTemplateContext({
        company_name: companyName,
        businessName: companyName,
        customerName: "Bamburi Cement Ltd",
        firstName: "Sarah",
        customerEmail: "billing@example.com",
        customerPhone: "+254 700 111 222",
        invoiceId: "INV-2026-014",
        amount: "KES 125,000",
        dueDate: "2026-04-15",
        mpesaRef: "QJK1234567",
        journeyId: "J026",
        origin: "Nairobi",
        destination: "Mombasa",
        dest: "Mombasa",
        cargo: "Electronics",
        truckReg: "KCB 100A",
        trailerReg: "ZEA 101",
        waybillNo: "WB-2026-000A",
        borderPoint: "Busia",
        eta: "2026-04-12 14:00",
        distance: "480 km",
        revenue: "KES 85,000",
        driverName: "Peter Ochieng",
        driverId: "DRV-001",
        staffName: "Alice Wambui",
        staffId: "EMP-001",
        otp: "123456",
        verifyUrl: "https://driver.segecha.example/verify",
        resetUrl: "https://driver.segecha.example/reset",
        loginEmail: "james.kamau@example.com",
        footer: `${companyName} · Nairobi`,
        baseUrl: "https://operations.example.com",
        site: "Segecha Internal Tracker",
        loyaltyPoints: "1,250",
    });
}

function fillPreview(text, ctx) {
    if (!text) return "";
    let result = text;
    Object.entries(ctx).forEach(([k, v]) => {
        const re = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
        result = result.replace(re, String(v ?? ""));
    });
    return result;
}

/* ─── Main component ─────────────────────────────────────────────────── */
export function TemplateEditor({ template, onSave, onClose, companyName, orgEmail = "", orgWhatsApp = "", fillTemplate, showToast }) {
    const isNew = !template;

    const [localT, setLocalT] = useState(() => {
        if (template) return { ...template };
        return {
            id: uid(),
            name: "",
            slug: "",
            description: "",
            subject: "",
            body: "",
            type: "Email",
            category: "General",
            _editorMode: "Visual",
            whatsappCategory: "UTILITY",
            pageSize: "A4",
            orientation: "Portrait",
            updatedAt: new Date().toISOString(),
        };
    });

    const [activeType, setActiveType] = useState(() => canonicalTemplateType((template?.type) || "Email"));
    const [phSearch, setPhSearch] = useState("");
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!template?.slug);
    const [testEmail, setTestEmail] = useState(orgEmail || "");
    const [testPhone, setTestPhone] = useState(orgWhatsApp || "");

    const subjectRef = useRef(null);
    const bodyRef = useRef(null);
    const cursorRef = useRef({ lastField: "body", subject: { start: 0, end: 0 }, body: { start: 0, end: 0 } });

    /* ── Sample preview context ─────── */
    const sampleCtx = useMemo(() => buildSampleContext(companyName), [companyName]);

    const rendered = useMemo(() => {
        const fill = fillTemplate
            ? (s) => fillTemplate(s || "", sampleCtx)
            : (s) => fillPreview(s || "", sampleCtx);
        return { subject: fill(localT.subject), body: fill(localT.body) };
    }, [localT.subject, localT.body, fillTemplate, sampleCtx]);

    /* ── Field helpers ────────────────── */
    const patch = useCallback((updates) => {
        setLocalT((prev) => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
    }, []);

    const handleNameChange = useCallback((val) => {
        const updates = { name: val };
        if (!slugManuallyEdited) updates.slug = slugify(val);
        patch(updates);
    }, [patch, slugManuallyEdited]);

    const handleSlugChange = useCallback((val) => {
        setSlugManuallyEdited(true);
        patch({ slug: slugify(val) });
    }, [patch]);

    const handleTypeChange = useCallback((type) => {
        setActiveType(type);
        patch({
            type,
            name: retitleForType(localT.name, type),
            description: retitleForType(localT.description, type),
            ...(slugManuallyEdited ? {} : { slug: slugify(retitleForType(localT.name, type)) }),
            ...(type === "PDF" ? { _editorMode: "HTML" } : {}),
        });
    }, [patch, localT.name, localT.description, slugManuallyEdited]);

    const handleSendTest = useCallback((channel) => {
        const messageText = rendered.body || localT.body || "";
        const subject = rendered.subject || localT.subject || localT.name || "Template Test";
        if (channel === "email") {
            const recipient = (testEmail || "").trim();
            const href = buildMailtoUrl(recipient, subject, messageText);
            if (!href) {
                showToast?.("Enter a test email first.", "warning");
                return;
            }
            window.location.href = href;
            showToast?.("Opening email client for test send.", "success");
            return;
        }
        if (channel === "whatsapp") {
            const recipient = (testPhone || "").trim();
            const wa = buildWhatsAppUrl(recipient, messageText);
            if (!wa) {
                showToast?.("Enter a valid test WhatsApp number first.", "warning");
                return;
            }
            window.open(wa, "_blank", "noopener,noreferrer");
            showToast?.("Opening WhatsApp for test send.", "success");
            return;
        }
    }, [localT.body, localT.name, localT.subject, rendered.body, rendered.subject, showToast, testEmail, testPhone]);

    /* ── Cursor tracking for placeholder insert ─── */
    const rememberCursor = useCallback((field) => {
        const el = field === "subject" ? subjectRef.current : bodyRef.current;
        if (!el) return;
        cursorRef.current[field] = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
        cursorRef.current.lastField = field;
    }, []);

    const insertPlaceholder = useCallback((key, field) => {
        const snippet = `{{${key}}}`;
        const targetField = field || cursorRef.current.lastField || "body";
        const isSubject = targetField === "subject";
        const el = isSubject ? subjectRef.current : bodyRef.current;
        const fallback = cursorRef.current[targetField] || { start: 0, end: 0 };
        const hasLive = el && document.activeElement === el && typeof el.selectionStart === "number";
        const start = hasLive ? el.selectionStart : fallback.start;
        const end = hasLive ? el.selectionEnd : fallback.end;
        const text = isSubject ? (localT.subject || "") : (localT.body || "");
        const next = text.slice(0, start) + snippet + text.slice(end);
        patch(isSubject ? { subject: next } : { body: next });
        requestAnimationFrame(() => {
            const nextEl = isSubject ? subjectRef.current : bodyRef.current;
            if (!nextEl) return;
            nextEl.focus();
            const pos = start + snippet.length;
            try { nextEl.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
            cursorRef.current[targetField] = { start: pos, end: pos };
            cursorRef.current.lastField = targetField;
        });
    }, [localT.subject, localT.body, patch]);

    /* ── Filtered placeholder groups ─── */
    const filteredGroups = useMemo(() => {
        const q = phSearch.trim().toLowerCase();
        if (!q) return PLACEHOLDER_GROUPS;
        return PLACEHOLDER_GROUPS
            .map((g) => ({ ...g, items: g.items.filter((item) => item.key.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)) }))
            .filter((g) => g.items.length > 0);
    }, [phSearch]);

    /* ── Save ─────────────────────────── */
    const handleSave = useCallback(() => {
        if (!localT.name.trim()) {
            showToast?.("Please enter a template name.", "warning");
            return;
        }
        const saved = { ...localT, type: activeType, updatedAt: new Date().toISOString() };
        if (!saved.slug) saved.slug = slugify(saved.name);
        onSave(saved);
        showToast?.(`Template "${saved.name}" saved.`, "success");
        onClose();
    }, [localT, activeType, onSave, onClose, showToast]);

    /* ── Type tabs config ─────────────── */
    const typeTabs = [
        { id: "Email", Icon: Mail },
        { id: "WhatsApp", Icon: MessageCircle },
        { id: "PDF", Icon: FileText },
    ];

    /* ── Character count (WhatsApp) ──── */
    const charCount = (localT.body || "").length;

    return (
        <div className="tpl-editor-overlay">
            {/* ── Top bar ── */}
            <div className="tpl-editor-topbar">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="tpl-editor-back-btn"
                        aria-label="Back to templates"
                    >
                        <ArrowLeft size={17} strokeWidth={2.2} />
                    </button>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                            {isNew ? "Create New Template" : `Edit: ${localT.name || "Template"}`}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--brand-primary)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
                            Content Editor · Drafting
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {(activeType === "Email" || activeType === "PDF") && (
                        <input
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Test email"
                            className="tpl-editor-input"
                            style={{ width: 190, height: 34 }}
                        />
                    )}
                    {(activeType === "WhatsApp" || activeType === "PDF") && (
                        <input
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="Test WhatsApp no."
                            className="tpl-editor-input"
                            style={{ width: 170, height: 34 }}
                        />
                    )}
                    {activeType === "Email" && (
                        <button type="button" onClick={() => handleSendTest("email")} className="tpl-editor-cancel-btn">
                            Send test email
                        </button>
                    )}
                    {activeType === "WhatsApp" && (
                        <button type="button" onClick={() => handleSendTest("whatsapp")} className="tpl-editor-cancel-btn">
                            Send test WhatsApp
                        </button>
                    )}
                    {activeType === "PDF" && (
                        <>
                            <button type="button" onClick={() => handleSendTest("email")} className="tpl-editor-cancel-btn">
                                Test PDF via email
                            </button>
                            <button type="button" onClick={() => handleSendTest("whatsapp")} className="tpl-editor-cancel-btn">
                                Test PDF via WhatsApp
                            </button>
                        </>
                    )}
                    <button type="button" onClick={onClose} className="tpl-editor-cancel-btn">
                        <X size={15} strokeWidth={2} /> Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="tpl-editor-save-btn">
                        <Save size={15} strokeWidth={2} /> Save template
                    </button>
                </div>
            </div>

            {/* ── Type tabs ── */}
            <div className="tpl-editor-type-tabs">
                {typeTabs.map(({ id, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => handleTypeChange(id)}
                        className={`tpl-type-tab${activeType === id ? " is-active" : ""}`}
                    >
                        <Icon size={14} strokeWidth={2} />
                        {id}
                    </button>
                ))}
            </div>

            {/* ── Body: two columns ── */}
            <div className="tpl-editor-body">
                {/* ── LEFT PANEL ── */}
                <div className="tpl-editor-left">
                    {/* Template name */}
                    <div className="tpl-editor-field-group">
                        <label className="tpl-editor-label">Template Name</label>
                        <input
                            className="tpl-editor-input"
                            value={localT.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="e.g. Order Confirmation"
                        />
                    </div>

                    {/* Slug */}
                    <div className="tpl-editor-field-group">
                        <label className="tpl-editor-label">Slug / Unique ID</label>
                        <input
                            className="tpl-editor-input tpl-editor-input--mono"
                            value={localT.slug || ""}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            placeholder="order-confirmation"
                        />
                    </div>

                    {/* Description */}
                    <div className="tpl-editor-field-group">
                        <label className="tpl-editor-label">Description</label>
                        <textarea
                            className="tpl-editor-textarea"
                            rows={2}
                            value={localT.description || ""}
                            onChange={(e) => patch({ description: e.target.value })}
                            placeholder="Internal notes about when this template is used…"
                        />
                    </div>

                    {/* ── EMAIL-specific fields ── */}
                    {activeType === "Email" && (
                        <>
                            <div className="tpl-editor-field-group">
                                <label className="tpl-editor-label">Subject Line</label>
                                <input
                                    ref={subjectRef}
                                    className="tpl-editor-input"
                                    value={localT.subject || ""}
                                    onChange={(e) => patch({ subject: e.target.value })}
                                    onFocus={() => rememberCursor("subject")}
                                    onClick={() => rememberCursor("subject")}
                                    onKeyUp={() => rememberCursor("subject")}
                                    onSelect={() => rememberCursor("subject")}
                                    placeholder="e.g. Invoice {{invoiceId}} from {{businessName}}"
                                />
                                <div className="tpl-editor-tip">
                                    TIP: USE PLACEHOLDERS LIKE <code>{`{{FIRSTNAME}}`}</code> TO PERSONALIZE THE SUBJECT.
                                </div>
                            </div>
                            <div className="tpl-editor-field-group">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <label className="tpl-editor-label" style={{ marginBottom: 0 }}>Email Content</label>
                                    <div className="tpl-editor-mode-toggle">
                                        {["Visual", "HTML"].map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => patch({ _editorMode: mode })}
                                                className={`tpl-mode-btn${(localT._editorMode || "Visual") === mode ? " is-active" : ""}`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    ref={bodyRef}
                                    className={`tpl-editor-textarea tpl-editor-textarea--tall${(localT._editorMode === "HTML") ? " tpl-editor-textarea--code" : ""}`}
                                    value={localT.body || ""}
                                    onChange={(e) => patch({ body: e.target.value })}
                                    onFocus={() => rememberCursor("body")}
                                    onClick={() => rememberCursor("body")}
                                    onKeyUp={() => rememberCursor("body")}
                                    onSelect={() => rememberCursor("body")}
                                    placeholder="Write your message. Use placeholders from the right panel."
                                />
                            </div>
                        </>
                    )}

                    {/* ── WHATSAPP-specific fields ── */}
                    {activeType === "WhatsApp" && (
                        <>
                            <div className="tpl-editor-field-group">
                                <label className="tpl-editor-label">Template Category</label>
                                <div className="tpl-wa-category-grid">
                                    {WHATSAPP_CATEGORIES.map(({ id, icon: CatIcon, label, desc }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => patch({ whatsappCategory: id })}
                                            className={`tpl-category-card${(localT.whatsappCategory || "UTILITY") === id ? " is-selected" : ""}`}
                                        >
                                            <div className="tpl-category-card-icon">
                                                <CatIcon size={18} strokeWidth={2} />
                                            </div>
                                            <div className="tpl-category-card-label">{label}</div>
                                            <div className="tpl-category-card-desc">{desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="tpl-editor-field-group">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <label className="tpl-editor-label" style={{ marginBottom: 0 }}>Message Body</label>
                                    <span className="tpl-char-counter">{charCount} / 1024 CHARACTERS</span>
                                </div>
                                <textarea
                                    ref={bodyRef}
                                    className="tpl-editor-textarea tpl-editor-textarea--tall"
                                    value={localT.body || ""}
                                    onChange={(e) => patch({ body: e.target.value })}
                                    onFocus={() => rememberCursor("body")}
                                    onClick={() => rememberCursor("body")}
                                    onKeyUp={() => rememberCursor("body")}
                                    onSelect={() => rememberCursor("body")}
                                    placeholder="Hi {{firstName}}, your order {{invoiceId}} has been confirmed."
                                    maxLength={1024}
                                />
                            </div>
                        </>
                    )}

                    {/* ── PDF-specific fields ── */}
                    {activeType === "PDF" && (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div className="tpl-editor-field-group">
                                    <label className="tpl-editor-label">Page Size</label>
                                    <select
                                        className="tpl-editor-select"
                                        value={localT.pageSize || "A4"}
                                        onChange={(e) => patch({ pageSize: e.target.value })}
                                    >
                                        {["A4", "A3", "Letter", "Legal"].map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="tpl-editor-field-group">
                                    <label className="tpl-editor-label">Orientation</label>
                                    <select
                                        className="tpl-editor-select"
                                        value={localT.orientation || "Portrait"}
                                        onChange={(e) => patch({ orientation: e.target.value })}
                                    >
                                        {["Portrait", "Landscape"].map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="tpl-editor-field-group">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <label className="tpl-editor-label" style={{ marginBottom: 0 }}>Document HTML Structure</label>
                                    <span className="tpl-html-badge">HTML / CSS SUPPORTED</span>
                                </div>
                                <textarea
                                    ref={bodyRef}
                                    className="tpl-editor-textarea tpl-editor-textarea--tall tpl-editor-textarea--code"
                                    value={localT.body || ""}
                                    onChange={(e) => patch({ body: e.target.value })}
                                    onFocus={() => rememberCursor("body")}
                                    onClick={() => rememberCursor("body")}
                                    onKeyUp={() => rememberCursor("body")}
                                    onSelect={() => rememberCursor("body")}
                                    placeholder={"<h1>{{businessName}}</h1>\n<p>Invoice {{invoiceId}} · {{amount}}</p>"}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* ── RIGHT PANEL ── */}
                <div className="tpl-editor-right">
                    {/* Live preview */}
                    <div className="tpl-editor-preview-header">
                        <span className="tpl-editor-preview-dot" />
                        LIVE PREVIEW
                    </div>

                    {activeType === "Email" && (
                        <div className="tpl-editor-preview-email">
                            <div className="tpl-preview-email-subject">
                                <span className="tpl-preview-label">SUBJECT</span>
                                <span>{rendered.subject || <em style={{ color: "var(--text-dim)" }}>No subject</em>}</span>
                            </div>
                            <div className="tpl-preview-email-body">
                                {(localT._editorMode === "HTML")
                                    ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rendered.body || "") }} />
                                    : <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 13, lineHeight: 1.65 }}>{rendered.body || <em style={{ color: "var(--text-dim)" }}>No body content</em>}</pre>
                                }
                            </div>
                        </div>
                    )}

                    {activeType === "WhatsApp" && (
                        <div className="tpl-editor-preview-whatsapp">
                            <div className="tpl-preview-wa-bubble">
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}>
                                    {rendered.body || <em style={{ color: "rgba(0,0,0,0.4)" }}>No message content</em>}
                                </pre>
                                <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", textAlign: "right", marginTop: 4 }}>12:00 ✓✓</div>
                            </div>
                        </div>
                    )}

                    {activeType === "PDF" && (
                        <div className="tpl-editor-preview-pdf">
                            <div className="tpl-preview-pdf-paper">
                                {localT.subject && (
                                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 8, letterSpacing: "-0.02em" }}>
                                        {rendered.subject}
                                    </div>
                                )}
                                <div
                                    style={{ fontSize: 11, color: "#333", lineHeight: 1.6 }}
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rendered.body || "<em style='color:#999'>No HTML content yet</em>") }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Insert Placeholders */}
                    <div className="tpl-editor-ph-section">
                        <div className="tpl-editor-ph-heading">Insert Placeholders</div>
                        <div style={{ position: "relative", marginBottom: 14 }}>
                            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} />
                            <input
                                className="tpl-editor-ph-search"
                                value={phSearch}
                                onChange={(e) => setPhSearch(e.target.value)}
                                placeholder="Search variables e.g. 'order'…"
                            />
                        </div>

                        <div className="tpl-editor-ph-list">
                            {filteredGroups.map((group) => {
                                const GIcon = group.icon;
                                return (
                                    <div key={group.cat} style={{ marginBottom: 18 }}>
                                        <div className="tpl-ph-cat-label" style={{ color: group.color }}>
                                            <GIcon size={12} strokeWidth={2.2} />
                                            {group.cat}
                                        </div>
                                        {group.items.map((item) => (
                                            <div key={item.key} className="tpl-ph-item">
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <code className="tpl-ph-code" style={{ color: group.color }}>{`{{${item.key}}}`}</code>
                                                    <div className="tpl-ph-desc">{item.desc}</div>
                                                </div>
                                                {activeType === "WhatsApp" ? (
                                                    <button
                                                        type="button"
                                                        className="tpl-ph-insert-btn"
                                                        onClick={() => insertPlaceholder(item.key, "body")}
                                                        title="Insert into body"
                                                    >+</button>
                                                ) : (
                                                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                                        {activeType === "Email" && (
                                                            <button
                                                                type="button"
                                                                className="tpl-ph-insert-btn"
                                                                onClick={() => insertPlaceholder(item.key, "subject")}
                                                                title="Insert into subject"
                                                            >SUBJECT</button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="tpl-ph-insert-btn"
                                                            onClick={() => insertPlaceholder(item.key, "body")}
                                                            title="Insert into body"
                                                        >BODY</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                            {filteredGroups.length === 0 && (
                                <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "20px 0" }}>
                                    No variables match "{phSearch}"
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
