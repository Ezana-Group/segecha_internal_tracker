/* ─── Field ─────────────────────────────────────────────────────────
   Form field: text | select | checkbox-group
   Props: label | k | form | setForm | type | options | full |
          placeholder | S | T | error | onChange
   Labels use small-caps style. Inputs get a brand-color focus ring.
   ──────────────────────────────────────────────────────────────── */

/* Shared input base — callers pass S.inp for overrides, but we
   inject the focus ring via a <style> block so it works without a
   separate stylesheet. */
const INPUT_BASE = {
    width: "100%",
    padding: "10px 13px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-medium)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontFamily: "var(--font-sans)",
    lineHeight: 1.5,
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxSizing: "border-box",
};

const LABEL_BASE = {
    display: "block",
    fontSize: "10.5px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-muted)",
    marginBottom: 6,
};

const ERROR_STYLE = {
    color: "#EF4444",
    fontSize: "11px",
    marginTop: 4,
    lineHeight: 1.4,
};

export function Field({
    label,
    k,
    form,
    setForm,
    type = "text",
    options,
    full,
    placeholder,
    S = {},
    T = {},
    error,
    onChange,
}) {
    const inputStyle = {
        ...INPUT_BASE,
        ...(S.inp || {}),
        border: error
            ? "1px solid #EF4444"
            : (S.inp?.border || "1px solid var(--border-medium)"),
    };

    const labelStyle = { ...LABEL_BASE, ...(S.lbl || {}) };
    const fieldGroupStyle = { ...( S.fg || {}), gridColumn: full ? "1/-1" : undefined };

    const handleChange = (val) => {
        if (onChange) onChange(val);
        else setForm((f) => ({ ...f, [k]: val }));
    };

    return (
        <div style={fieldGroupStyle}>
            {label && <label style={labelStyle}>{label}</label>}

            {/* ── Checkbox group ── */}
            {type === "checkbox-group" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                    {options.map((o) => {
                        const val   = typeof o === "string" ? o : o.v;
                        const lbl   = typeof o === "string" ? o : o.l;
                        const checked = (form[k] || []).includes(val);
                        return (
                            <label
                                key={val}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    padding: "5px 11px",
                                    borderRadius: "var(--radius-sm)",
                                    background: checked
                                        ? "var(--brand-muted)"
                                        : "var(--surface-subtle)",
                                    border: `1px solid ${checked ? "var(--brand-border)" : "var(--border-subtle)"}`,
                                    color: checked ? "var(--brand-primary)" : "var(--text-secondary)",
                                    transition: "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
                                    userSelect: "none",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    style={{ accentColor: "var(--brand-primary)", width: 13, height: 13, cursor: "pointer" }}
                                    onChange={(e) => {
                                        const current = Array.isArray(form[k])
                                            ? form[k]
                                            : form[k] ? [form[k]] : [];
                                        const next = e.target.checked
                                            ? [...current, val]
                                            : current.filter((x) => x !== val);
                                        handleChange(next);
                                    }}
                                />
                                {lbl}
                            </label>
                        );
                    })}
                </div>

            /* ── Select ── */
            ) : options ? (
                <select
                    style={inputStyle}
                    value={form[k] || ""}
                    onChange={(e) => handleChange(e.target.value)}
                    className="field-input"
                >
                    <option value="">Select…</option>
                    {options.map((o) =>
                        typeof o === "string"
                            ? <option key={o} value={o}>{o}</option>
                            : <option key={o.v} value={o.v}>{o.l}</option>
                    )}
                </select>

            /* ── Text / number / date / etc. ── */
            ) : (
                <input
                    style={inputStyle}
                    type={type}
                    placeholder={placeholder}
                    value={form[k] || ""}
                    onChange={(e) => handleChange(e.target.value)}
                    className="field-input"
                />
            )}

            {error && <p style={ERROR_STYLE}>{error}</p>}
        </div>
    );
}
