'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, sortCompare, ClearFiltersButton } from '@/components/ErpShared'
import { SC, TRUCK_TYPES, STATUSES_TRUCK, TYRE_WARN_KM } from '@/lib/seed-data'
import { DOC_LABELS } from '@/lib/documents'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Fleet() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterType, setFilterType] = useState("ALL")
    const [filterStatus, setFilterStatus] = useState("ALL")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'reg', dir: 'asc' })
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [
            { data: trucks }, { data: drivers }, { data: journeys },
            { data: fuel }, { data: expenses }, { data: documents }
        ] = await Promise.all([
            supabase.from('trucks').select('*').order('reg'),
            supabase.from('drivers').select('*'),
            supabase.from('journeys').select('*'),
            supabase.from('fuel').select('*'),
            supabase.from('expenses').select('*'),
            supabase.from('documents').select('*').eq('entity_type', 'truck')
        ])
        setData({
            trucks: trucks || [], drivers: drivers || [],
            journeys: journeys || [], fuel: fuel || [],
            expenses: expenses || [], documents: documents || []
        })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const truckStats = (tid: string) => {
        const jrns = data?.journeys.filter((j: any) => j.truck === tid) || []
        const rev = jrns.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.revenue, 0)
        const fuelEntries = data?.fuel.filter((f: any) => f.truck === tid) || []
        const fuelCost = fuelEntries.reduce((s: any, f: any) => s + (f.litres * f.pricePerL), 0)
        const totalLitres = fuelEntries.reduce((s: any, f: any) => s + f.litres, 0)
        const totalKm = jrns.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.distance, 0)
        const kmPerL = totalLitres > 0 ? totalKm / totalLitres : 0
        const otherExp = data?.expenses.filter((e: any) => e.truck === tid).reduce((s: any, e: any) => s + +e.amount, 0) || 0
        const exp = fuelCost + otherExp
        return { rev, exp, profit: rev - exp, trips: jrns.length, totalKm, totalLitres, fuelCost, kmPerL }
    }

    const tyreStatus = (truck: any) => {
        const kmSinceChange = truck.odom - truck.tyreOdom
        const remaining = truck.tyreLimit - kmSinceChange
        const pct = (kmSinceChange / truck.tyreLimit) * 100
        const status = remaining <= 0 ? "Overdue" : remaining <= TYRE_WARN_KM ? "Due Soon" : "OK"
        return { kmSinceChange, remaining, pct, status }
    }

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
    const closeModal = () => { setModal(null); setForm({}) }

    const saveTruck = async () => {
        if (!form.reg) return toast.error("Registration is required")
        const payload = { ...form }
        // Clean empty strings to null for foreign keys to prevent UUID constraint errors
        if (!payload.driver) payload.driver = null
        if (!payload.id) {
            payload.id = "T" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('trucks').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Truck added")
        } else {
            const { error } = await supabase.from('trucks').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Truck updated")
        }
        closeModal()
        loadData()
    }

    const delTruck = async (id: string) => {
        if (!confirm("Are you sure you want to remove this truck?")) return
        const { error } = await supabase.from('trucks').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Truck removed")
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Fleet...</div></AppLayout>

    const q = searchQuery.trim().toLowerCase()
    const filteredTrucks = data.trucks.filter((t: any) => {
        if (filterType !== "ALL" && (t.type || "") !== filterType) return false
        if (filterStatus !== "ALL" && (t.status || "") !== filterStatus) return false
        if (!q) return true
        const reg = (t.reg || "").toLowerCase()
        const make = (t.make || "").toLowerCase()
        const type = (t.type || "").toLowerCase()
        return reg.includes(q) || make.includes(q) || type.includes(q)
    })
    const hasActiveFilters = searchQuery.trim() !== "" || filterType !== "ALL" || filterStatus !== "ALL"
    const clearFilters = () => { setSearchQuery(""); setFilterType("ALL"); setFilterStatus("ALL") }
    const truckDocStatuses: Record<string, { doc_type: string; status: string; expiry_date: string }[]> = {}
    ;(data?.documents || []).forEach((d: any) => {
        const eid = d.entity_id || d.entityId
        if (!eid) return
        if (!truckDocStatuses[eid]) truckDocStatuses[eid] = []
        truckDocStatuses[eid].push({ doc_type: d.doc_type, status: d.status || 'Valid', expiry_date: d.expiry_date || '' })
    })
    const getSortVal = (t: any, key: string) => {
        switch (key) {
            case 'reg': return (t.reg || '').toString()
            case 'make': return (t.make || '').toString()
            case 'type': return (t.type || '').toString()
            case 'status': return (t.status || '').toString()
            case 'odom': return Number(t.odom) || 0
            default: return ''
        }
    }
    const sortedTrucks = [...filteredTrucks].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◉ Fleet Management</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search reg, make, type..." />
                    <select style={{ ...S.inp, width: 130 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="ALL">All Types</option>
                        {TRUCK_TYPES.map((ty: string) => <option key={ty} value={ty}>{ty}</option>)}
                    </select>
                    <select style={{ ...S.inp, width: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="ALL">All Status</option>
                        {STATUSES_TRUCK.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select style={{ ...S.inp, width: 140 }} value={sort.key} onChange={e => setSort(prev => ({ ...prev, key: e.target.value }))} title="Sort by">
                        <option value="reg">Sort: Registration</option>
                        <option value="make">Sort: Make</option>
                        <option value="type">Sort: Type</option>
                        <option value="status">Sort: Status</option>
                        <option value="odom">Sort: Odometer</option>
                    </select>
                    <select style={{ ...S.inp, width: 100 }} value={sort.dir} onChange={e => setSort(prev => ({ ...prev, dir: e.target.value as 'asc' | 'desc' }))}>
                        <option value="asc">↑ A–Z</option>
                        <option value="desc">↓ Z–A</option>
                    </select>
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                    <button style={S.btn()} onClick={() => openModal("truck", { status: "Active", tyreLimit: 60000 })}>+ Add Truck</button>
                </div>
            </div>
            <div style={S.grid(3, 2, 1)}>
                {sortedTrucks.map((t: any) => {
                    const st = truckStats(t.id)
                    const ts = tyreStatus(t)
                    const drv = data.drivers.find((d: any) => d.id === t.driver)
                    return (
                        <div key={t.id} style={{ ...S.card(SC[t.status as keyof typeof SC]) }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 18, color: S.mtitle.color }}>{t.reg}</div>
                                    <div style={{ fontSize: 12, color: S.kpi.color }}>{t.make} · {t.year} · {t.type}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {["Trailer", "Skeletal Trailer"].includes(t.type) && <span style={{ ...S.badge("Active"), background: "#64748b22", color: "#64748b" }}>Trailer</span>}
                                    <span style={S.badge(t.status)}>{t.status}</span>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: S.kpi.color, marginBottom: 4 }}>👤 {["Trailer", "Skeletal Trailer"].includes(t.type) ? "—" : (drv?.name || "No driver")}</div>
                            <div style={{ fontSize: 12, color: S.kpi.color, marginBottom: 10 }}>⚖️ {t.capacity}T · 🛣️ {(t.odom || 0).toLocaleString()} km</div>
                            <div style={{ fontSize: 11, color: ts.status === "OK" ? "#10b981" : SC[ts.status as keyof typeof SC], marginBottom: 10, fontWeight: 600 }}>
                                🔵 Tyres: {ts.status === "Overdue" ? `Overdue ${Math.abs(ts.remaining).toLocaleString()}km` : ts.status === "Due Soon" ? `Due in ${ts.remaining.toLocaleString()}km` : `OK — ${ts.remaining.toLocaleString()}km left`}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 mb-2">
                                <span className="text-xs text-slate-400 mr-1">Docs:</span>
                                {(truckDocStatuses[t.id] || []).map((doc: { doc_type: string; status: string; expiry_date: string }) => (
                                    <div
                                        key={doc.doc_type}
                                        title={`${DOC_LABELS[doc.doc_type] || doc.doc_type}: ${doc.status} (${doc.expiry_date})`}
                                        className={`w-2.5 h-2.5 rounded-full cursor-help flex-shrink-0 ${
                                            doc.status === 'Expired' ? 'bg-red-500' :
                                            doc.status === 'Expiring Soon' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    />
                                ))}
                                {(!truckDocStatuses[t.id] || truckDocStatuses[t.id].length === 0) && (
                                    <span className="text-xs text-slate-400">No documents added</span>
                                )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                                {[{ l: "Revenue", v: fmt(st.rev), c: "#10b981" }, { l: "Expenses", v: fmt(st.exp), c: "#f59e0b" }, { l: "Profit", v: fmt(st.profit), c: st.profit >= 0 ? "#3b82f6" : "#ef4444" }].map(s => (
                                    <div key={s.l} style={{ background: S.wrap.background === '#0c0e14' ? S.wrap.background : "#f8fafc", borderRadius: 8, padding: 10, textAlign: "center", border: `1px solid ${S.border}` }}>
                                        <div style={{ fontSize: 9, color: S.kpi.color, marginBottom: 3, textTransform: "uppercase" }}>{s.l}</div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: s.c }}>{s.v}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button style={S.btn("sm")} onClick={() => openModal("truck", t)}>Edit</button>
                                <button style={S.btn("del")} onClick={() => delTruck(t.id)}>Remove</button>
                            </div>
                        </div>
                    )
                })}
            </div>
            {modal === "truck" && (
                <ErpModal title={form.id ? "Edit Truck" : "Add Truck"} onClose={closeModal} onSave={saveTruck}>
                    <div style={S.fgg(2)}>
                        <F label="Registration No." k="reg" form={form} setForm={setForm} /><F label="Make / Model" k="make" form={form} setForm={setForm} />
                        <F label="Year" k="year" type="number" form={form} setForm={setForm} /><F label="Capacity (tonnes)" k="capacity" type="number" form={form} setForm={setForm} />
                        <F label="Type" k="type" options={TRUCK_TYPES} form={form} setForm={setForm} /><F label="Status" k="status" options={STATUSES_TRUCK} form={form} setForm={setForm} />
                        <F label="Odometer (km)" k="odom" type="number" form={form} setForm={setForm} /><F label="Assigned Driver" k="driver" options={[{ v: "", l: "-- None --" }, ...data.drivers.map((d: any) => ({ v: d.id, l: d.name }))]} form={form} setForm={setForm} />
                        <F label="Odometer at last tyre change (km)" k="tyreOdom" type="number" form={form} setForm={setForm} /><F label="Tyre change interval (km)" k="tyreLimit" type="number" form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
