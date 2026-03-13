'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F, FMultiSelect, KENYA_LICENSE_CLASSES, parseLicenseClasses, serializeLicenseClasses, TableSearch, SortableTh, sortCompare } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Drivers() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: drivers }, { data: trucks }] = await Promise.all([
            supabase.from('drivers').select('*').order('name'),
            supabase.from('trucks').select('*')
        ])
        setData({ drivers: drivers || [], trucks: trucks || [] })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const truckReg = (id: string) => data?.trucks.find((t: any) => t.id === id)?.reg || "—"

    const openModal = (type: string, item: any = {}) => {
        setModal(type)
        const raw = item.class ?? item.license_class
        setForm({ ...item, class: parseLicenseClasses(raw) })
    }
    const closeModal = () => { setModal(null); setForm({}) }

    const saveDriver = async () => {
        if (!form.name) return toast.error("Name is required")
        const payload = { ...form }
        if (Array.isArray(payload.class)) payload.class = serializeLicenseClasses(payload.class)
        // Clean empty strings to null for foreign keys
        if (!payload.truck) payload.truck = null
        if (!payload.id) {
            payload.id = "D" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('drivers').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Driver added")
        } else {
            const { error } = await supabase.from('drivers').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Driver updated")
        }
        closeModal()
        loadData()
    }

    const delDriver = async (id: string) => {
        if (!confirm("Are you sure you want to remove this driver?")) return
        const { error } = await supabase.from('drivers').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Driver removed")
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Drivers...</div></AppLayout>

    const q = searchQuery.trim().toLowerCase()
    const filtered = !q ? data.drivers : data.drivers.filter((d: any) => {
        const name = (d.name || "").toLowerCase()
        const phone = (d.phone || "").toLowerCase()
        const mpesa = (d.mpesa || "").toLowerCase()
        const license = (d.license || "").toLowerCase()
        const truck = truckReg(d.truck).toLowerCase()
        const classes = (d.class ?? d.license_class ?? "").toString().toLowerCase()
        return name.includes(q) || phone.includes(q) || mpesa.includes(q) || license.includes(q) || truck.includes(q) || classes.includes(q)
    })
    const getSortVal = (d: any, key: string) => {
        switch (key) {
            case 'name': return (d.name || '').toString()
            case 'phone': return (d.phone || '').toString()
            case 'license': return (d.license || '').toString()
            case 'truck': return truckReg(d.truck)
            case 'salary': return Number(d.salary) || 0
            case 'status': return (d.status || '').toString()
            default: return ''
        }
    }
    const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
    const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◎ Driver Management</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search name, phone, M-Pesa, license, truck..." />
                    <button style={S.btn()} onClick={() => openModal("driver", { status: "Active", joined: today() })}>+ Add Driver</button>
                </div>
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 600 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Driver" sortKey="name" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Phone / M-Pesa" sortKey="phone" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="License" sortKey="license" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>Class</th>
                            <SortableTh label="Truck" sortKey="truck" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Salary" sortKey="salary" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Status" sortKey="status" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((d: any) => (
                            <tr key={d.id}>
                                <td style={{ ...S.td, fontWeight: 700, color: S.mtitle.color }}>{d.name}</td>
                                <td style={S.td}><div>{d.phone}</div><div style={{ fontSize: 10, color: S.kpi.color }}>💚 {d.mpesa}</div></td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{d.license}</td>
                                <td style={S.td}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {(() => {
                                            const classes = parseLicenseClasses(d.class ?? d.license_class)
                                            return classes.length ? classes.map((c) => <span key={c} style={S.pill('#f97316')}>{c}</span>) : '—'
                                        })()}
                                    </div>
                                </td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(d.truck)}</td>
                                <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(d.salary)}/mo</td>
                                <td style={S.td}><span style={S.badge(d.status)}>{d.status}</span></td>
                                <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("driver", d)}>Edit</button><button style={S.btn("del")} onClick={() => delDriver(d.id)}>✕</button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modal === "driver" && (
                <ErpModal title={form.id ? "Edit Driver" : "Add Driver"} onClose={closeModal} onSave={saveDriver} wide>
                    <div style={S.fgg(2)}>
                        <F label="Full Name" k="name" full form={form} setForm={setForm} /><F label="Phone" k="phone" form={form} setForm={setForm} /><F label="M-Pesa Number" k="mpesa" placeholder="07XXXXXXXX" form={form} setForm={setForm} />
                        <F label="License No." k="license" form={form} setForm={setForm} />
                        <FMultiSelect label="License classes (Kenya)" k="class" options={KENYA_LICENSE_CLASSES} form={form} setForm={setForm} full />
                        <F label="Monthly Salary (KES)" k="salary" type="number" form={form} setForm={setForm} /><F label="Date Joined" k="joined" type="date" form={form} setForm={setForm} />
                        <F label="Assigned Truck" k="truck" options={[{ v: "", l: "-- None --" }, ...data.trucks.map((t: any) => ({ v: t.id, l: t.reg }))]} form={form} setForm={setForm} />
                        <F label="Status" k="status" options={["Active", "Inactive", "Suspended"]} form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
