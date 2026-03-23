export function Field({ label, k, form, setForm, type = "text", options, full, placeholder, S, T, error, onChange }) {
    return (
        <div style={{ ...S.fg, gridColumn: full ? "1/-1" : undefined }}>
            <label style={S.lbl}>{label}</label>
            {type === "checkbox-group" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                    {options.map(o => {
                        const val = typeof o === "string" ? o : o.v;
                        const label = typeof o === "string" ? o : o.l;
                        const isChecked = (form[k] || []).includes(val);
                        return (
                            <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", background: isChecked ? T.sidebar : "transparent", padding: "4px 10px", borderRadius: 6, border: `1px solid ${isChecked ? T.border : "transparent"}` }}>
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                        const current = Array.isArray(form[k]) ? form[k] : (form[k] ? [form[k]] : []);
                                        const next = e.target.checked ? [...current, val] : current.filter(x => x !== val);
                                        if (onChange) onChange(next);
                                        else setForm(f => ({ ...f, [k]: next }));
                                    }}
                                />
                                {label}
                            </label>
                        );
                    })}
                </div>
            ) : options ? (
                <select
                    style={{ ...S.inp, border: error ? "1px solid #DC2626" : S.inp.border }}
                    value={form[k] || ""}
                    onChange={e => {
                        if (onChange) onChange(e.target.value);
                        else setForm(f => ({ ...f, [k]: e.target.value }));
                    }}
                >
                    <option value="">Select…</option>
                    {options.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
            ) : (
                <input
                    style={{ ...S.inp, border: error ? "1px solid #DC2626" : S.inp.border }}
                    type={type}
                    placeholder={placeholder}
                    value={form[k] || ""}
                    onChange={e => {
                        if (onChange) onChange(e.target.value);
                        else setForm(f => ({ ...f, [k]: e.target.value }));
                    }}
                />
            )}
            {error && (
                <p style={{ color: '#DC2626', fontSize: 11, marginTop: 3 }}>{error}</p>
            )}
        </div>
    );
}
