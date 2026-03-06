'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN } from '@/lib/ErpContext'
import { ErpModal, F } from '@/components/ErpShared'
import { TYRE_WARN_KM } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Tyres() {
    const { S, dark } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: trucks }, { data: expenses }] = await Promise.all([
            supabase.from('trucks').select('*').order('reg', { ascending: true }),
            supabase.from('expenses').select('*').eq('cat', 'Tyre').order('date', { ascending: false })
        ])
        setData({ trucks: trucks || [], expenses: expenses || [] })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const truckReg = (id: string) => data?.trucks.find((t: any) => t.id === id)?.reg || "—"

    const tyreStatus = (t: any) => {
        const kmSinceChange = typeof t.odom === 'number' && typeof t.tyreOdom === 'number' ? t.odom - t.tyreOdom : 0
        const limit = typeof t.tyreLimit === 'number' ? t.tyreLimit : 80000
        const remaining = limit - kmSinceChange
        const pct = Math.min((kmSinceChange / limit) * 100, 100)
        let status = "OK"
        if (remaining <= 0) status = "Overdue"
        else if (remaining <= TYRE_WARN_KM) status = "Due Soon"
        return { kmSinceChange, remaining, pct, status }
    }

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }

    const saveTruck = async () => {
        const payload = { ...form }
        const { error } = await supabase.from('trucks').update({
            odom: payload.odom,
            tyreOdom: payload.tyreOdom,
            tyreLimit: payload.tyreLimit
        }).eq('id', payload.id)
        if (error) return toast.error(error.message)
        toast.success("Odometer & Tyre Info updated")
        setModal(null)
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Tyre Health...</div></AppLayout>

    return (
        <AppLayout>
            <div style={S.ph}>◍ Tyre Health Monitor</div>
            <div style={S.grid(3, 2, 1)}>
                {data.trucks.map((t: any) => {
                    const ts = tyreStatus(t)
                    const alertColor = ts.status === "Overdue" ? "#ef4444" : ts.status === "Due Soon" ? "#f97316" : "#10b981"
                    return (
                        <div key={t.id} style={S.card(alertColor)}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 17, color: S.mtitle.color }}>{t.reg}</div>
                                    <div style={{ fontSize: 12, color: S.kpi.color }}>{t.make} · {t.type}</div>
                                </div>
                                <span style={S.badge(ts.status)}>{ts.status}</span>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: S.kpi.color }}>Tyre usage</span>
                                    <span style={{ color: alertColor, fontWeight: 700 }}>{ts.kmSinceChange.toLocaleString()} / {(t.tyreLimit || 80000).toLocaleString()} km</span>
                                </div>
                                <div style={{ ...S.bar(), height: 10 }}><div style={S.barFill(ts.pct, alertColor)} /></div>
                                <div style={{ fontSize: 11, color: S.kpi.color, marginTop: 5, textAlign: "right" }}>{fmtN(ts.pct, 1)}% worn</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                {[
                                    { l: "Km Since Change", v: `${ts.kmSinceChange.toLocaleString()} km`, c: S.mtitle.color },
                                    { l: "Remaining", v: ts.remaining <= 0 ? `${Math.abs(ts.remaining).toLocaleString()} km over!` : `${ts.remaining.toLocaleString()} km`, c: alertColor },
                                    { l: "Changed At", v: `${(t.tyreOdom || 0).toLocaleString()} km`, c: S.td.color },
                                    { l: "Current Odom", v: `${(t.odom || 0).toLocaleString()} km`, c: S.td.color },
                                ].map((s: any) => (
                                    <div key={s.l} style={{ background: dark ? S.wrap.background : '#f8fafc', borderRadius: 7, padding: 10, border: `1px solid ${S.border}` }}>
                                        <div style={{ fontSize: 9, color: S.kpi.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{s.l}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</div>
                                    </div>
                                ))}
                            </div>
                            {ts.status !== "OK" && (
                                <div style={{ background: alertColor + (dark ? "18" : "22"), border: `1px solid ${alertColor}66`, borderRadius: 8, padding: 10, fontSize: 12, color: alertColor, fontWeight: 600 }}>
                                    {ts.status === "Overdue" ? "⛔ Tyres must be changed immediately!" : "⚠️ Schedule tyre change soon."}
                                </div>
                            )}
                            <button style={{ ...S.btn("sm"), marginTop: 12 }} onClick={() => openModal("truck", t)}>Update Odometer / Tyre Info</button>
                        </div>
                    )
                })}
            </div>
            <div style={S.card()}>
                <div style={{ fontWeight: 700, color: S.mtitle.color, marginBottom: 16, fontSize: 14 }}>📊 Tyre Cost History</div>
                <div style={{ ...S.card(), overflowX: "auto" as any, border: 'none', padding: 0 }}>
                    <table style={S.tbl}>
                        <thead><tr>{["Date", "Truck", "Description", "Cost"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {data.expenses.map((e: any) => (
                                <tr key={e.id}>
                                    <td style={S.td}>{e.date}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(e.truck)}</td>
                                    <td style={S.td}>{e.desc}</td>
                                    <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700 }}>{fmt(e.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {modal === "truck" && (
                <ErpModal title="Update Tyre Profile" onClose={() => setModal(null)} onSave={saveTruck}>
                    <div style={S.fgg(2)}>
                        <F label="Current Odometer (km)" k="odom" type="number" form={form} setForm={setForm} />
                        <F label="Odometer at last change (km)" k="tyreOdom" type="number" form={form} setForm={setForm} />
                        <F label="Tyre Limit (km)" k="tyreLimit" type="number" form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
