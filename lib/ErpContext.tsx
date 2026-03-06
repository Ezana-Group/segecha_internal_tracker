'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { SEED, SC, TYRE_WARN_KM } from './seed-data'

export { SC, TYRE_WARN_KM }

export const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase()
export const today = () => new Date().toISOString().split("T")[0]
export const fmt = (n: number | string) => `KES ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`
export const fmtN = (n: number | string, d = 1) => Number(n || 0).toFixed(d)

interface ErpContextType {
    dark: boolean
    setDark: (d: boolean) => void
    S: any // Styles object
}

const ErpContext = createContext<ErpContextType | undefined>(undefined)

export function ErpProvider({ children }: { children: ReactNode }) {
    const [dark, setDark] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('segecha-dark')
        if (saved === 'true') {
            setDark(true)
            document.documentElement.classList.add('dark')
        }
    }, [])

    const T = dark ? {
        bg: "#0c0e14", surface: "#10141f", sidebar: "#0e1220",
        border: "#1c2235", border2: "#131722",
        text: "#e2e8f0", textMid: "#c9d1e0", textDim: "#8892a4",
        textFaint: "#4a5568", textGhost: "#2d3748",
        inputBg: "#0c0e14", inputBorder: "#1c2235", inputText: "#e2e8f0",
        rowHover: "#1c2235", shadow: "#000a",
    } : {
        bg: "#f1f5f9", surface: "#ffffff", sidebar: "#ffffff",
        border: "#e2e8f0", border2: "#f1f5f9",
        text: "#0f172a", textMid: "#1e293b", textDim: "#475569",
        textFaint: "#94a3b8", textGhost: "#cbd5e1",
        inputBg: "#f8fafc", inputBorder: "#e2e8f0", inputText: "#0f172a",
        rowHover: "#f8fafc", shadow: "#0002",
    }

    const S = {
        wrap: { fontFamily: "'IBM Plex Sans', sans-serif", background: T.bg, minHeight: "100vh", color: T.textMid, display: "flex", flexDirection: "column", transition: "background 0.2s, color 0.2s" },
        ph: { fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 20, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as any },
        grid: (d: number, t?: number, m?: number) => ({ display: "grid", gridTemplateColumns: `repeat(${d}, 1fr)`, gap: 16, marginBottom: 20 }),
        card: (accent?: string) => ({ background: T.surface, border: `1px solid ${accent ? accent + "33" : T.border}`, borderRadius: 12, padding: 18, borderTop: accent ? `3px solid ${accent}` : undefined, boxShadow: "none" }),
        kpi: { fontSize: 11, color: T.textFaint, textTransform: "uppercase" as any, letterSpacing: 1, marginBottom: 6 },
        val: (c?: string) => ({ fontSize: 26, fontWeight: 800, color: c || T.text, letterSpacing: -0.8, lineHeight: 1 }),
        sub: { fontSize: 11, color: T.textDim, marginTop: 5 },
        tbl: { width: "100%", borderCollapse: "collapse" as any, fontSize: 13 },
        th: { padding: "9px 12px", textAlign: "left" as any, color: T.textFaint, fontSize: 11, textTransform: "uppercase" as any, letterSpacing: 1, borderBottom: `1px solid ${T.border}`, fontWeight: 700, background: T.surface },
        td: { padding: "11px 12px", borderBottom: `1px solid ${T.border2}`, color: T.textDim, verticalAlign: "middle" as any },
        badge: (s: string) => ({ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: (SC[s as keyof typeof SC] || "#64748b") + "22", color: SC[s as keyof typeof SC] || "#64748b", border: `1px solid ${(SC[s as keyof typeof SC] || "#64748b")}44` }),
        btn: (v?: string) => ({ padding: v === "sm" ? "5px 12px" : "9px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, fontSize: v === "sm" ? 12 : 14, background: v === "del" ? "#ef444415" : v === "ghost" ? (dark ? "#ffffff10" : "#00000010") : v === "green" ? "linear-gradient(135deg,#059669,#10b981)" : v === "orange" ? "linear-gradient(135deg,#d97706,#f97316)" : "linear-gradient(135deg, #f97316, #ef4444)", color: v === "del" ? "#ef4444" : v === "ghost" ? T.textDim : "#fff" }),
        inp: { background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 7, padding: "9px 12px", color: T.inputText, fontSize: 14, width: "100%", boxSizing: "border-box" as any },
        lbl: { fontSize: 11, color: T.textFaint, marginBottom: 5, display: "block", fontWeight: 700, textTransform: "uppercase" as any, letterSpacing: 0.5 },
        fg: { marginBottom: 14 },
        fgg: (n: number) => ({ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 14 }),
        ovl: { position: "fixed" as any, inset: 0, background: "#00000099", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
        mbox: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, width: "min(560px, 95vw)", maxHeight: "88vh", overflowY: "auto" as any },
        mtitle: { fontSize: 18, fontWeight: 800, marginBottom: 22, color: T.text },
        pill: (c?: string) => ({ background: (c || "#f97316") + "18", color: c || "#f97316", border: `1px solid ${c || "#f97316"}33`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }),
        bar: () => ({ height: 6, borderRadius: 3, background: T.border, overflow: "hidden", flex: 1 }),
        barFill: (pct: number, c: string) => ({ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: c, borderRadius: 3, transition: "width 0.6s ease" }),
        alertBox: (c: string) => ({ background: c + (dark ? "12" : "18"), border: `1px solid ${c}44`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }),
    }

    return (
        <ErpContext.Provider value={{ dark, setDark, S }}>
            {children}
        </ErpContext.Provider>
    )
}

export const useErpContext = () => {
    const context = useContext(ErpContext)
    if (!context) throw new Error('useErpContext must be used within an ErpProvider')
    return context
}
