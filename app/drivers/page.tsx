'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F, FMultiSelect, KENYA_LICENSE_CLASSES, parseLicenseClasses, serializeLicenseClasses, TableSearch, SortableTh, sortCompare, ClearFiltersButton } from '@/components/ErpShared'
import { DOC_LABELS } from '@/lib/documents'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Drivers() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState("ALL")
    const [filterTruck, setFilterTruck] = useState("ALL")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: drivers }, { data: trucks }, { data: documents }] = await Promise.all([
            supabase.from('drivers').select('*').order('name'),
            supabase.from('trucks').select('*'),
            supabase.from('documents').select('*').eq('entity_type', 'driver')
        ])
        setData({ drivers: drivers || [], trucks: trucks || [], documents: documents || [] })
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
    const filtered = data.drivers.filter((d: any) => {
        if (filterStatus !== "ALL" && (d.status || "") !== filterStatus) return false
        if (filterTruck === "UNASSIGNED" && (d.truck != null && d.truck !== "")) return false
        if (filterTruck !== "ALL" && filterTruck !== "UNASSIGNED" && d.truck !== filterTruck) return false
        if (!q) return true
        const name = (d.name || "").toLowerCase()
        const phone = (d.phone || "").toLowerCase()
        const mpesa = (d.mpesa || "").toLowerCase()
        const license = (d.license || "").toLowerCase()
        const truck = truckReg(d.truck).toLowerCase()
        const classes = (d.class ?? d.license_class ?? "").toString().toLowerCase()
        return name.includes(q) || phone.includes(q) || mpesa.includes(q) || license.includes(q) || truck.includes(q) || classes.includes(q)
    })
    const hasActiveFilters = searchQuery.trim() !== "" || filterStatus !== "ALL" || filterTruck !== "ALL"
    const clearFilters = () => { setSearchQuery(""); setFilterStatus("ALL"); setFilterTruck("ALL") }
    const getSortVal = (d: any, key: string) => {
        switch (key) {
            case 'id': return (d.id || '').toString()
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
    const driverDocStatuses: Record<string, { doc_type: string; status: string; expiry_date: string }[]> = {}
    ;(data?.documents || []).forEach((d: any) => {
        const eid = d.entity_id || d.entityId
        if (!eid) return
        if (!driverDocStatuses[eid]) driverDocStatuses[eid] = []
        driverDocStatuses[eid].push({ doc_type: d.doc_type, status: d.status || 'Valid', expiry_date: d.expiry_date || '' })
    })

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◎ Driver Management</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search name, phone, M-Pesa, license, truck..." />
                    <select style={{ ...S.inp, width: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="ALL">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Suspended">Suspended</option>
                    </select>
                    <select style={{ ...S.inp, width: 140 }} value={filterTruck} onChange={e => setFilterTruck(e.target.value)}>
                        <option value="ALL">All Trucks</option>
                        <option value="UNASSIGNED">Unassigned</option>
                        {data.trucks.map((t: any) => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                    <button style={S.btn()} onClick={() => openModal("driver", { status: "Active", joined: today() })}>+ Add Driver</button>
                </div>
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 600 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Driver ID" sortKey="id" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Name" sortKey="name" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Phone / M-Pesa" sortKey="phone" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="License" sortKey="license" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>Class</th>
                            <SortableTh label="Truck ID" sortKey="truck" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Salary (KES)" sortKey="salary" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Status" sortKey="status" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>Docs</th>
                            <th style={S.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((d: any) => (
                            <tr key={d.id}>
                                <td style={{ ...S.td, fontFamily: "monospace", color: S.mtitle.color }}>{d.id}</td>
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
                                <td style={S.td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                        {(driverDocStatuses[d.id] || []).map((doc: { doc_type: string; status: string; expiry_date: string }) => (
                                            <span
                                                key={doc.doc_type}
                                                title={`${DOC_LABELS[doc.doc_type] || doc.doc_type}: ${doc.status} (${doc.expiry_date})`}
                                                style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    flexShrink: 0,
                                                    cursor: 'help',
                                                    background: doc.status === 'Expired' ? '#ef4444' : doc.status === 'Expiring Soon' ? '#f59e0b' : '#10b981',
                                                }}
                                            />
                                        ))}
                                        {(!driverDocStatuses[d.id] || driverDocStatuses[d.id].length === 0) && (
                                            <span style={{ fontSize: 11, color: S.textDim }}>—</span>
                                        )}
                                    </div>
                                </td>
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
