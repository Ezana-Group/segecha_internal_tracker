'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN, today } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, SortableTh, sortCompare, DateRangeFilter, ClearFiltersButton, ThFilterCell, ThTextFilter, ThSelectFilter, ThDateFilter, ThNumberRangeFilter } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function FuelLog() {
    const { S, dark } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [filterTruckId, setFilterTruckId] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStation, setFilterStation] = useState("")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: fuel }, { data: trucks }, { data: journeys }, { data: expenses }] = await Promise.all([
            supabase.from('fuel').select('*').order('date', { ascending: false }),
            supabase.from('trucks').select('*'),
            supabase.from('journeys').select('*'),
            supabase.from('expenses').select('*')
        ])
        setData({ fuel: fuel || [], trucks: trucks || [], journeys: journeys || [], expenses: expenses || [] })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const truckReg = (id: string) => data?.trucks.find((t: any) => t.id === id)?.reg || "—"

    // Duplicated from Dashboard/old Context but isolated here so this module doesn't depend on Context globals
    const truckStats = (tid: string) => {
        const jrns = data?.journeys.filter((j: any) => j.truck === tid) || []
        const fuelEntries = data?.fuel.filter((f: any) => f.truck === tid) || []
        const fuelCost = fuelEntries.reduce((s: any, f: any) => s + (f.litres * f.pricePerL), 0)
        const totalLitres = fuelEntries.reduce((s: any, f: any) => s + f.litres, 0)
        const totalKm = jrns.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.distance, 0)
        const kmPerL = totalLitres > 0 ? totalKm / totalLitres : 0
        return { totalKm, totalLitres, fuelCost, kmPerL }
    }

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
    const closeModal = () => { setModal(null); setForm({}) }

    const saveFuel = async () => {
        if (!form.truck || !form.litres || !form.pricePerL) return toast.error("Truck, Litres, and Price are required")
        const payload = { ...form }
        // Clean foreign keys
        if (!payload.journey) payload.journey = null
        if (!payload.id) {
            payload.id = "F" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('fuel').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Fuel logged")
        } else {
            const { error } = await supabase.from('fuel').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Fuel updated")
        }
        closeModal()
        loadData()
    }

    const delFuel = async (id: string) => {
        if (!confirm("Are you sure you want to remove this fuel record?")) return
        const { error } = await supabase.from('fuel').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Fuel removed")
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Fuel...</div></AppLayout>

    const totalL = data.fuel.reduce((s: any, f: any) => s + f.litres, 0)
    const totalCost = data.fuel.reduce((s: any, f: any) => s + (f.litres * f.pricePerL), 0)
    const avgPrice = totalL > 0 ? (totalCost / totalL).toFixed(1) : 0
    const q = searchQuery.trim().toLowerCase()
    const byTruck = filterTruckId === "" ? data.fuel : data.fuel.filter((f: any) => f.truck === filterTruckId)
    const byDate = byTruck.filter((f: any) => {
        if (dateFrom && (f.date || "") < dateFrom) return false
        if (dateTo && (f.date || "") > dateTo) return false
        if (filterStation !== "" && !(f.station || "").toLowerCase().includes(filterStation.trim().toLowerCase())) return false
        return true
    })
    const filtered = !q ? byDate : byDate.filter((f: any) => {
        const id = (f.id || "").toLowerCase()
        const truck = truckReg(f.truck).toLowerCase()
        const station = (f.station || "").toLowerCase()
        return id.includes(q) || truck.includes(q) || station.includes(q)
    })
    const hasActiveFilters = searchQuery.trim() !== "" || filterTruckId !== "" || filterStation !== "" || dateFrom !== "" || dateTo !== ""
    const clearFilters = () => { setSearchQuery(""); setFilterTruckId(""); setFilterStation(""); setDateFrom(""); setDateTo("") }
    const getSortVal = (f: any, key: string) => {
        switch (key) {
            case 'id': return (f.id || '').toString()
            case 'date': return f.date || ''
            case 'truck': return truckReg(f.truck)
            case 'station': return (f.station || '').toString()
            case 'litres': return Number(f.litres) || 0
            case 'pricePerL': return Number(f.pricePerL) || 0
            case 'total': return (Number(f.litres) || 0) * (Number(f.pricePerL) || 0)
            case 'odom': return Number(f.odom) || 0
            default: return ''
        }
    }
    const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))
    const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>⬡ Fuel Log</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search truck, station, date..." />
                    <select style={{ ...S.inp, width: 160 }} value={filterTruckId} onChange={e => setFilterTruckId(e.target.value)}>
                        <option value="">All Trucks</option>
                        {data.trucks.map((t: any) => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                    <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                    <button style={S.btn()} onClick={() => openModal("fuel", { date: today() })}>+ Fuel Entry</button>
                </div>
            </div>
            <div style={S.grid(4, 3, 1)}>
                {[{ l: "Total Fuel Cost", v: fmt(totalCost), c: "#f97316" }, { l: "Total Litres", v: `${totalL.toLocaleString()} L`, c: "#f59e0b" }, { l: "Avg Price/Litre", v: `KES ${avgPrice}`, c: "#a78bfa" }, { l: "Fill-ups", v: data.fuel.length, c: "#38bdf8" }].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
            </div>
            <div style={S.grid(3, 2, 1)}>
                {data.trucks.map((t: any) => {
                    const st = truckStats(t.id)
                    return (
                        <div key={t.id} style={S.card("#f97316")}>
                            <div style={{ fontWeight: 700, color: S.mtitle.color, marginBottom: 10 }}>{t.reg}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {[{ l: "Fuel Cost", v: fmt(st.fuelCost), c: "#f97316" }, { l: "Litres", v: `${st.totalLitres.toLocaleString()} L`, c: "#f59e0b" }, { l: "Km Covered", v: `${st.totalKm.toLocaleString()} km`, c: "#38bdf8" }, { l: "Efficiency", v: `${fmtN(st.kmPerL, 2)} km/L`, c: "#10b981" }].map(s => (
                                    <div key={s.l} style={{ background: dark ? S.wrap.background : '#f8fafc', borderRadius: 7, padding: 10, border: `1px solid ${S.border}` }}>
                                        <div style={{ fontSize: 9, color: S.kpi.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{s.l}</div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 700 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Entry ID" sortKey="id" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Date" sortKey="date" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Truck ID" sortKey="truck" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Station" sortKey="station" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Litres (L)" sortKey="litres" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Price/L (KES)" sortKey="pricePerL" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Total (KES)" sortKey="total" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Odometer (km)" sortKey="odom" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}></th>
                        </tr>
                        <tr>
                            <ThFilterCell><ThTextFilter value={searchQuery} onChange={setSearchQuery} placeholder="ID..." /></ThFilterCell>
                            <ThFilterCell><ThDateFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} /></ThFilterCell>
                            <ThFilterCell><ThSelectFilter value={filterTruckId} onChange={setFilterTruckId} options={data.trucks.map((t: any) => ({ v: t.id, l: t.reg }))} allLabel="All" /></ThFilterCell>
                            <ThFilterCell><ThTextFilter value={filterStation} onChange={setFilterStation} placeholder="Station" /></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((f: any) => (
                            <tr key={f.id}>
                                <td style={{ ...S.td, fontFamily: "monospace", color: S.mtitle.color }}>{f.id}</td>
                                <td style={S.td}>{f.date}</td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(f.truck)}</td>
                                <td style={S.td}>{f.station || "—"}</td>
                                <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700 }}>{f.litres != null ? f.litres : "—"}</td>
                                <td style={S.td}>{f.pricePerL != null ? `KES ${f.pricePerL}` : "—"}</td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{fmt((f.litres || 0) * (f.pricePerL || 0))}</td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{f.odom != null ? (f.odom).toLocaleString() : "—"}</td>
                                <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("fuel", f)}>Edit</button><button style={S.btn("del")} onClick={() => delFuel(f.id)}>✕</button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modal === "fuel" && (
                <ErpModal title={form.id ? "Edit Fuel Entry" : "Log Fuel Fill-up"} onClose={closeModal} onSave={saveFuel}>
                    <div style={S.fgg(2)}>
                        <F label="Truck" k="truck" options={[{ v: "", l: "-- Select Truck --" }, ...data.trucks.map((t: any) => ({ v: t.id, l: t.reg }))]} form={form} setForm={setForm} />
                        <F label="Date" k="date" type="date" form={form} setForm={setForm} />
                        <F label="Litres" k="litres" type="number" form={form} setForm={setForm} /><F label="Price per Litre (KES)" k="pricePerL" type="number" form={form} setForm={setForm} />
                        <F label="Station Name" k="station" form={form} setForm={setForm} /><F label="Odometer Reading (km)" k="odom" type="number" form={form} setForm={setForm} />
                        <F label="Linked Journey" k="journey" options={[{ v: "", l: "-- None --" }, ...data.journeys.map((j: any) => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} full form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
