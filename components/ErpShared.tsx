'use client'

import { useErpContext } from '@/lib/ErpContext'

/** Kenya driver license classes (NTSA) — use for multiselect */
export const KENYA_LICENSE_CLASSES = ['A1', 'A2', 'A3', 'B', 'C1', 'C', 'CE', 'CD', 'D1', 'D2', 'D3', 'E', 'F', 'G'] as const

/** Normalize "Class G" / "class CE" → "G", "CE" */
function normalizeLicenseClass(s: string): string {
    const t = s.trim().replace(/^class\s+/i, '')
    return t.trim()
}

/** Parse stored license_class / class (JSON array or comma-separated or single) into string[].
 * Normalizes "Class G" → "G" so old data matches the multiselect options. */
export function parseLicenseClasses(value: unknown): string[] {
    let raw: string[] = []
    if (Array.isArray(value)) raw = value.filter((x): x is string => typeof x === 'string')
    else if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim()
        if (trimmed.startsWith('[')) {
            try {
                const arr = JSON.parse(trimmed)
                raw = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [trimmed]
            } catch {
                raw = [trimmed]
            }
        } else raw = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    }
    const normalized = raw.map(normalizeLicenseClass).filter(Boolean)
    return [...new Set(normalized)]
}

/** Serialize selected license classes for DB (single TEXT column) */
export function serializeLicenseClasses(classes: string[]): string {
    return classes.length ? JSON.stringify(classes) : ''
}

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

/** Multiselect as clickable pills — good for fixed options (e.g. Kenya license classes). value in form[k] = string[] */
export function FMultiSelect({ label, k, options, form, setForm, full }: { label: string; k: string; options: readonly string[]; form: any; setForm: (fn: (f: any) => any) => void; full?: boolean }) {
    const { S } = useErpContext()
    const selected: string[] = Array.isArray(form[k]) ? form[k] : parseLicenseClasses(form[k])
    const toggle = (opt: string) => {
        setForm((f: any) => ({
            ...f,
            [k]: selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt].sort(),
        }))
    }
    return (
        <div style={{ ...S.fg, gridColumn: full ? "1/-1" : undefined }}>
            <label style={S.lbl}>{label}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {options.map((opt) => {
                    const isSelected = selected.includes(opt)
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            style={{
                                ...S.pill(isSelected ? '#10b981' : undefined),
                                cursor: 'pointer',
                                border: `1px solid ${isSelected ? '#10b981' : (S as any).lbl?.color || '#94a3b8'}33`,
                                background: isSelected ? '#10b98118' : undefined,
                            }}
                        >
                            {opt}
                        </button>
                    )
                })}
            </div>
            {selected.length > 0 && (
                <div style={{ fontSize: 11, color: (S as any).textFaint, marginTop: 6 }}>
                    Selected: {selected.join(', ')}
                </div>
            )}
        </div>
    )
}
