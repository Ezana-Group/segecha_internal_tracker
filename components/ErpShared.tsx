'use client'

import { useErpContext } from '@/lib/ErpContext'

export function ErpModal({ title, onSave, onClose, children, wide }: any) {
    const { S } = useErpContext()
    return (
        <div style={S.ovl} onClick={onClose}>
            <div style={{ ...S.mbox, width: wide ? "min(720px,95vw)" : "min(560px,95vw)" }} onClick={e => e.stopPropagation()}>
                <div style={S.mtitle}>{title}</div>
                {children}
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                    <button style={S.btn()} onClick={onSave}>Save</button>
                    <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    )
}

export function F({ label, k, type = "text", options, full, placeholder, form, setForm }: any) {
    const { S } = useErpContext()
    return (
        <div style={{ ...S.fg, gridColumn: full ? "1/-1" : undefined }}>
            <label style={S.lbl}>{label}</label>
            {options ? (
                <select style={S.inp} value={form[k] || ""} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))}>
                    <option value="">Select…</option>
                    {options.map((o: any) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
            ) : (
                <input style={S.inp} type={type} placeholder={placeholder} value={form[k] || ""} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} />
            )}
        </div>
    )
}
