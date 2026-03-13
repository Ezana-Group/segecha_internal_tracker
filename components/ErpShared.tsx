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

/** True if this record was flagged during import (user should fix and clear the note/desc) */
export function hasImportFlag(text: string | null | undefined): boolean {
    return typeof text === 'string' && text.includes('[Import')
}

/** Badge for table rows that need import review — visible in main ERP */
export function ImportReviewBadge({ notesOrDesc }: { notesOrDesc: string | null | undefined }) {
    const { S } = useErpContext()
    if (!hasImportFlag(notesOrDesc)) return null
    return (
        <span
            style={{
                ...S.badge('Pending'),
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #f59e0b',
                fontSize: 10,
                padding: '2px 8px',
            }}
            title="Imported with warning — fix in notes/description and remove this flag"
        >
            Needs review
        </span>
    )
}

/** Search box for table pages — placeholder and value controlled by parent */
export function TableSearch({ value, onChange, placeholder = "Search..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    const { S } = useErpContext()
    return (
        <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...S.inp, width: 200, minWidth: 160 }}
        />
    )
}

/** Date range filter — From / To; empty string = no filter on that side */
export function DateRangeFilter({ from, to, onFromChange, onToChange, style = {} }: { from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void; style?: React.CSSProperties }) {
    const { S } = useErpContext()
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
            <input type="date" value={from} onChange={e => onFromChange(e.target.value)} style={{ ...S.inp, width: 130 }} title="From date" />
            <span style={{ color: S.kpi?.color || '#64748b', fontSize: 12 }}>→</span>
            <input type="date" value={to} onChange={e => onToChange(e.target.value)} style={{ ...S.inp, width: 130 }} title="To date" />
        </span>
    )
}

/** Clear all filters button — show when hasActiveFilters, call onClear to reset */
export function ClearFiltersButton({ onClear, hasActiveFilters }: { onClear: () => void; hasActiveFilters: boolean }) {
    const { S } = useErpContext()
    if (!hasActiveFilters) return null
    return (
        <button type="button" onClick={onClear} style={{ ...S.btn('ghost'), fontSize: 12, padding: '6px 10px' }} title="Clear all filters and search">
            Clear filters
        </button>
    )
}

/** Compare two values for table sort: numbers, ISO dates, then strings. Use with sortCompare(a, b, sortDir). */
export function sortCompare(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
    const na = a == null || a === ''
    const nb = b == null || b === ''
    if (na && nb) return 0
    if (na) return dir === 'asc' ? 1 : -1
    if (nb) return dir === 'asc' ? -1 : 1
    const numA = typeof a === 'number' ? a : Number(a)
    const numB = typeof b === 'number' ? b : Number(b)
    if (!Number.isNaN(numA) && !Number.isNaN(numB) && (typeof a === 'number' || typeof b === 'number' || (typeof a === 'string' && typeof b === 'string' && /^\d/.test(String(a)) && /^\d/.test(String(b))))) {
        const out = numA < numB ? -1 : numA > numB ? 1 : 0
        return dir === 'asc' ? out : -out
    }
    const sa = String(a).toLowerCase()
    const sb = String(b).toLowerCase()
    const out = sa < sb ? -1 : sa > sb ? 1 : 0
    return dir === 'asc' ? out : -out
}

/** Sortable table header — click to sort by this column (toggles asc/desc if already selected). */
export function SortableTh({
    label,
    sortKey,
    currentSortKey,
    currentSortDir,
    onSort,
    style = {},
}: {
    label: string
    sortKey: string
    currentSortKey: string | null
    currentSortDir: 'asc' | 'desc'
    onSort: (key: string) => void
    style?: React.CSSProperties
}) {
    const { S } = useErpContext()
    const active = currentSortKey === sortKey
    return (
        <th
            style={{ ...S.th, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
            onClick={() => onSort(sortKey)}
            title={`Sort by ${label}`}
        >
            {label}
            {active && <span style={{ marginLeft: 4, opacity: 0.9 }}>{currentSortDir === 'asc' ? '↑' : '↓'}</span>}
        </th>
    )
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
