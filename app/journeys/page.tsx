'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F } from '@/components/ErpShared'
import { STATUSES_JOURNEY } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Journeys() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [filterTruck, setFilterTruck] = useState("ALL")
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: journeys }, { data: trucks }, { data: drivers }] = await Promise.all([
            supabase.from('journeys').select('*').order('date', { ascending: false }),
            supabase.from('trucks').select('*'),
            supabase.from('drivers').select('*')
        ])
        setData({ journeys: journeys || [], trucks: trucks || [], drivers: drivers || [] })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const truckReg = (id: string) => data?.trucks.find((t: any) => t.id === id)?.reg || "—"
    const driverName = (id: string) => data?.drivers.find((d: any) => d.id === id)?.name || "—"

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
    const closeModal = () => { setModal(null); setForm({}) }

    const saveJourney = async () => {
        if (!form.truck || !form.origin || !form.dest) return toast.error("Truck, Origin, and Destination are required")
        const payload = { ...form }
        // Clean foreign keys
        if (!payload.driver) payload.driver = null
        if (!payload.endDate) payload.endDate = null
        if (!payload.id) {
            payload.id = "J" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('journeys').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Journey logged")
        } else {
            const { error } = await supabase.from('journeys').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Journey updated")
        }
        closeModal()
        loadData()
    }

    const delJourney = async (id: string) => {
        if (!confirm("Are you sure you want to remove this journey record?")) return
        const { error } = await supabase.from('journeys').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Journey removed")
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Journeys...</div></AppLayout>

    const filtered = filterTruck === "ALL" ? data.journeys : data.journeys.filter((j: any) => j.truck === filterTruck)
    const totalKm = data.journeys.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.distance, 0)

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={S.ph}>◐ Journey Log</div>
                <div style={{ display: "flex", gap: 10 }}>
                    <select style={{ ...S.inp, width: 160 }} value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
                        <option value="ALL">All Trucks</option>
                        {data.trucks.map((t: any) => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                    <button style={S.btn()} onClick={() => openModal("journey", { date: today(), status: "Loading" })}>+ Log Journey</button>
                </div>
            </div>
            <div style={S.grid(4, 3, 1)}>
                {[{ l: "Total Journeys", v: data.journeys.length, c: "#38bdf8" }, { l: "Completed", v: data.journeys.filter((j: any) => j.status === "Completed").length, c: "#10b981" }, { l: "In Transit", v: data.journeys.filter((j: any) => j.status === "In Transit").length, c: "#3b82f6" }, { l: "Total Distance", v: `${totalKm.toLocaleString()} km`, c: "#a78bfa" }].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 800 }}>
                    <thead><tr>{["Route", "Truck", "Driver", "Date", "Cargo", "Weight", "Distance", "Revenue", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map((j: any) => (
                            <tr key={j.id}>
                                <td style={{ ...S.td, fontWeight: 700, color: S.mtitle.color }}>{j.origin} → {j.dest}</td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(j.truck)}</td>
                                <td style={S.td}>{driverName(j.driver)}</td>
                                <td style={S.td}>{j.date}</td>
                                <td style={S.td}>{j.cargo || "—"}</td>
                                <td style={S.td}>{j.weight ? `${j.weight}T` : "—"}</td>
                                <td style={S.td}>{j.distance} km</td>
                                <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(j.revenue)}</td>
                                <td style={S.td}><span style={S.badge(j.status)}>{j.status}</span></td>
                                <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("journey", j)}>Edit</button><button style={S.btn("del")} onClick={() => delJourney(j.id)}>✕</button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modal === "journey" && (
                <ErpModal title={form.id ? "Edit Journey" : "Log Journey"} onClose={closeModal} onSave={saveJourney}>
                    <div style={S.fgg(2)}>
                        <F label="Origin" k="origin" form={form} setForm={setForm} /><F label="Destination" k="dest" form={form} setForm={setForm} />
                        <F label="Truck" k="truck" options={[{ v: "", l: "-- Select Truck --" }, ...data.trucks.map((t: any) => ({ v: t.id, l: t.reg }))]} form={form} setForm={setForm} />
                        <F label="Driver" k="driver" options={[{ v: "", l: "-- Select Driver --" }, ...data.drivers.map((d: any) => ({ v: d.id, l: d.name }))]} form={form} setForm={setForm} />
                        <F label="Departure Date" k="date" type="date" form={form} setForm={setForm} /><F label="Arrival Date" k="endDate" type="date" form={form} setForm={setForm} />
                        <F label="Distance (km)" k="distance" type="number" form={form} setForm={setForm} /><F label="Revenue (KES)" k="revenue" type="number" form={form} setForm={setForm} />
                        <F label="Cargo Description" k="cargo" form={form} setForm={setForm} /><F label="Weight (Tonnes)" k="weight" type="number" form={form} setForm={setForm} />
                        <F label="Status" k="status" options={STATUSES_JOURNEY} form={form} setForm={setForm} /><F label="Notes" k="notes" form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
