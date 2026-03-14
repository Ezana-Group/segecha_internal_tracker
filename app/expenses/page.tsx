'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, ImportReviewBadge, hasImportFlag, SortableTh, sortCompare, DateRangeFilter, ClearFiltersButton, ThFilterCell, ThTextFilter, ThSelectFilter, ThDateFilter, ThNumberRangeFilter } from '@/components/ErpShared'
import { CATS } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function Expenses() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [filterTruckId, setFilterTruckId] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [filterNeedsReview, setFilterNeedsReview] = useState<"ALL" | "YES">("ALL")
    const [filterCategory, setFilterCategory] = useState("")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [filterAmountMin, setFilterAmountMin] = useState("")
    const [filterAmountMax, setFilterAmountMax] = useState("")
    const [filterDesc, setFilterDesc] = useState("")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: expenses }, { data: trucks }, { data: journeys }] = await Promise.all([
            supabase.from('expenses').select('*').order('date', { ascending: false }),
            supabase.from('trucks').select('*'),
            supabase.from('journeys').select('*')
        ])
        setData({ expenses: expenses || [], trucks: trucks || [], journeys: journeys || [] })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
    const closeModal = () => { setModal(null); setForm({}) }

    const saveExpense = async () => {
        if (!form.truck || !form.cat || !form.amount) return toast.error("Truck, Category, and Amount are required")
        const payload = { ...form }
        // Clean empty strings to null for foreign keys
        if (!payload.journey) payload.journey = null
        if (!payload.id) {
            payload.id = "E" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('expenses').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Expense added")
        } else {
            const { error } = await supabase.from('expenses').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Expense updated")
        }
        closeModal()
        loadData()
    }

    const delExpense = async (id: string) => {
        if (!confirm("Are you sure you want to remove this expense?")) return
        const { error } = await supabase.from('expenses').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Expense removed")
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Expenses...</div></AppLayout>

    const truckReg = (id: string) => data?.trucks.find((t: any) => t.id === id)?.reg || "—"
    const q = searchQuery.trim().toLowerCase()
    const filtered = data.expenses.filter((e: any) => {
        if (filterTruckId !== "" && e.truck !== filterTruckId) return false
        if (filterNeedsReview === "YES" && !hasImportFlag(e.desc)) return false
        if (filterCategory !== "" && e.cat !== filterCategory) return false
        if (dateFrom && (e.date || "") < dateFrom) return false
        if (dateTo && (e.date || "") > dateTo) return false
        const amt = Number(e.amount)
        if (filterAmountMin !== "" && !Number.isNaN(Number(filterAmountMin)) && (Number.isNaN(amt) || amt < Number(filterAmountMin))) return false
        if (filterAmountMax !== "" && !Number.isNaN(Number(filterAmountMax)) && (Number.isNaN(amt) || amt > Number(filterAmountMax))) return false
        if (filterDesc !== "" && !(e.desc || "").toLowerCase().includes(filterDesc.trim().toLowerCase())) return false
        if (!q) return true
        const id = (e.id || "").toLowerCase()
        const cat = (e.cat || "").toLowerCase()
        const desc = (e.desc || "").toLowerCase()
        const truck = truckReg(e.truck).toLowerCase()
        return id.includes(q) || cat.includes(q) || desc.includes(q) || truck.includes(q)
    })
    const needsReviewCount = data.expenses.filter((e: any) => hasImportFlag(e.desc)).length
    const hasActiveFilters = searchQuery.trim() !== "" || filterTruckId !== "" || filterNeedsReview !== "ALL" || filterCategory !== "" || dateFrom !== "" || dateTo !== "" || filterAmountMin !== "" || filterAmountMax !== "" || filterDesc !== ""
    const clearFilters = () => { setSearchQuery(""); setFilterTruckId(""); setFilterNeedsReview("ALL"); setFilterCategory(""); setDateFrom(""); setDateTo(""); setFilterAmountMin(""); setFilterAmountMax(""); setFilterDesc("") }
    const getSortVal = (e: any, key: string) => {
        switch (key) {
            case 'id': return (e.id || '').toString()
            case 'date': return e.date || ''
            case 'truck': return truckReg(e.truck)
            case 'cat': return (e.cat || '').toString()
            case 'desc': return (e.desc || '').toString()
            case 'amount': return Number(e.amount) || 0
            default: return ''
        }
    }
    const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))
    const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◇ Expense Tracker</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search category, description, date, truck..." />
                    <select style={{ ...S.inp, width: 140 }} value={filterTruckId} onChange={e => setFilterTruckId(e.target.value)}>
                        <option value="">All Trucks</option>
                        {data.trucks.map((t: any) => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                    <select style={{ ...S.inp, width: 120 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="">All Categories</option>
                        {CATS.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select style={{ ...S.inp, width: 120 }} value={filterNeedsReview} onChange={e => setFilterNeedsReview(e.target.value as "ALL" | "YES")}>
                        <option value="ALL">All</option>
                        <option value="YES">Needs review ({needsReviewCount})</option>
                    </select>
                    <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                    <button style={S.btn()} onClick={() => openModal("expense", { date: today() })}>+ Add Expense</button>
                </div>
            </div>
            <div style={S.grid(4, 3, 1)}>
                {["Maintenance", "Toll", "Permit", "Tyre"].map(cat => {
                    const tot = data.expenses.filter((e: any) => e.cat === cat).reduce((s: any, e: any) => s + +e.amount, 0)
                    return <div key={cat} style={S.card("#f59e0b")}><div style={S.kpi}>{cat}</div><div style={S.val("#f59e0b")}>{fmt(tot)}</div></div>
                })}
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 700 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Expense ID" sortKey="id" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Date" sortKey="date" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Truck ID" sortKey="truck" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Category" sortKey="cat" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Description" sortKey="desc" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Amount (KES)" sortKey="amount" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>Notes</th>
                            <th style={S.th}></th>
                        </tr>
                        <tr>
                            <ThFilterCell><ThTextFilter value={searchQuery} onChange={setSearchQuery} placeholder="ID..." /></ThFilterCell>
                            <ThFilterCell><ThDateFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} /></ThFilterCell>
                            <ThFilterCell><ThSelectFilter value={filterTruckId} onChange={setFilterTruckId} options={data.trucks.map((t: any) => ({ v: t.id, l: t.reg }))} allLabel="All" /></ThFilterCell>
                            <ThFilterCell><ThSelectFilter value={filterCategory} onChange={setFilterCategory} options={CATS} allLabel="All" /></ThFilterCell>
                            <ThFilterCell><ThTextFilter value={filterDesc} onChange={setFilterDesc} placeholder="Description" /></ThFilterCell>
                            <ThFilterCell><ThNumberRangeFilter min={filterAmountMin} max={filterAmountMax} onMinChange={setFilterAmountMin} onMaxChange={setFilterAmountMax} placeholderMin="Min" placeholderMax="Max" /></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                            <ThFilterCell></ThFilterCell>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((e: any) => (
                            <tr key={e.id}>
                                <td style={{ ...S.td, fontFamily: "monospace", color: S.mtitle.color }}>{e.id}</td>
                                <td style={S.td}>{e.date}</td>
                                <td style={{ ...S.td, color: "#f97316", fontWeight: 700 }}>{truckReg(e.truck)}</td>
                                <td style={S.td}><span style={S.badge("Loading")}>{e.cat}</span></td>
                                <td style={S.td}>{e.desc}</td>
                                <td style={{ ...S.td, color: "#f59e0b", fontWeight: 700 }}>{fmt(e.amount)}</td>
                                <td style={S.td}><ImportReviewBadge notesOrDesc={e.desc} /></td>
                                <td style={S.td}><div style={{ display: "flex", gap: 6 }}><button style={S.btn("sm")} onClick={() => openModal("expense", e)}>Edit</button><button style={S.btn("del")} onClick={() => delExpense(e.id)}>✕</button></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {modal === "expense" && (
                <ErpModal title={form.id ? "Edit Expense" : "Add Expense"} onClose={closeModal} onSave={saveExpense}>
                    <div style={S.fgg(2)}>
                        <F label="Truck" k="truck" options={[{ v: "", l: "-- Select Truck --" }, ...data.trucks.map((t: any) => ({ v: t.id, l: t.reg }))]} form={form} setForm={setForm} />
                        <F label="Category" k="cat" options={CATS} form={form} setForm={setForm} />
                        <F label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} /><F label="Date" k="date" type="date" form={form} setForm={setForm} />
                        <F label="Description" k="desc" full form={form} setForm={setForm} />
                        <F label="Linked Journey" k="journey" options={[{ v: "", l: "-- None --" }, ...data.journeys.map((j: any) => ({ v: j.id, l: `${j.origin}→${j.dest}` }))]} full form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
