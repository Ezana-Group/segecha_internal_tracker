import React, { useState } from "react";
import {
    Users,
    Building2,
    User,
    Plus,
    Phone,
    Mail,
    ExternalLink,
    TrendingUp,
    FileText,
    Edit2,
    AlertCircle,
    Search as SearchIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fmt } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function Customers({ data, isMobile, openModal, customerName, truckReg }) {
    const navigate = useNavigate();

    const customers = data.customers || [];

    const getCustomerStats = (customerId) => {
        const invoices = (data.invoices || []).filter(i => i.customerId === customerId);
        const journeys = (data.journeys || []).filter(j =>
            invoices.some(inv => inv.journey === j.id)
        );
        const totalRevenue = invoices.reduce((s, i) => s + +i.amount, 0);
        const totalPaid = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + +i.amount, 0);

        return {
            journeyCount: journeys.length,
            invoiceCount: invoices.length,
            totalRevenue,
            totalPaid,
            pendingAmount: totalRevenue - totalPaid,
        };
    };

    const refinedCustomers = customers.map(c => {
        const stats = getCustomerStats(c.id);
        return {
            ...c,
            _missions: stats.journeyCount,
            _revenue: stats.totalRevenue,
            _pending: stats.pendingAmount,
            _contact: `${c.phone} ${c.email || ""} ${c.contactPerson || ""}`,
        };
    });

    const {
        filteredRows: sortedCustomers,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: customerFilters,
        applyFilter: handleCustomerFilterChange,
        getUniqueValues: getCustomerUniqueValues,
        searchTerm,
        setSearchTerm,
    } = useTableFilter(refinedCustomers, {
        namespace: "cust",
        initialSort: { col: "name", dir: "asc" },
        searchColumns: ["name", "contactPerson", "email", "uId"],
    });

    return (
        <div className="page-shell">
            <PageHeader
                icon={Building2}
                title="Customers"
                description="Accounts, contacts, and revenue exposure."
                actions={
                    <Button variant="premium" icon={Plus} onClick={() => openModal("customer", { type: "Company" })}>
                        Add Customer
                    </Button>
                }
            />

            {/* Summary Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                {[
                    {
                        label: "Total Clients",
                        value: customers.length,
                        sub: `${customers.filter(c => c.type === "Company").length} Companies · ${customers.filter(c => c.type === "Individual").length} Individuals`,
                        icon: Users,
                        color: "var(--brand-primary)",
                    },
                    {
                        label: "Revenue Generated",
                        value: fmt((data.invoices || []).reduce((s, i) => s + +i.amount, 0)),
                        sub: "Lifetime billing across all clients",
                        icon: TrendingUp,
                        color: "#10b981",
                    },
                    {
                        label: "Active Invoices",
                        value: (data.invoices || []).filter(i => i.status !== "Paid").length,
                        sub: "Awaiting payment confirmation",
                        icon: FileText,
                        color: "#f59e0b",
                    },
                ].map(stat => {
                    const Ic = stat.icon;
                    return (
                        <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md, 12px)", padding: "20px 24px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
                                <Ic size={16} color={stat.color} />
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{stat.sub}</div>
                        </div>
                    );
                })}
            </div>

            {/* Customer Table */}
            <Card style={{ padding: 0, overflow: "hidden" }} className="animate-fade-in">
                {/* Search Bar */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={17} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search customers..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500, outline: "none" }}
                    />
                </div>

                <div className="table-container">
                    <table className="table-modern">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={customerFilters}
                            onFilterChange={handleCustomerFilterChange}
                            getUniqueValues={getCustomerUniqueValues}
                            columns={[
                                { key: "name", label: "Company / Name", sortable: true },
                                { key: "type", label: "Type", sortable: true },
                                { key: "contactPerson", label: "Contact Person", sortable: true },
                                { key: "phone", label: "Phone / Email", sortable: false },
                                { key: "_missions", label: "Journeys", sortable: true, align: "right" },
                                { key: "_revenue", label: "Revenue", sortable: true, align: "right" },
                                { key: "actions", label: "Actions", sortable: false, align: "right" },
                            ]}
                        />
                        <tbody>
                            {sortedCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <AlertCircle size={40} style={{ opacity: 0.2, display: "block", margin: "0 auto 12px" }} />
                                        <div style={{ fontWeight: 600 }}>No clients found matching your filters.</div>
                                    </td>
                                </tr>
                            ) : sortedCustomers.map(c => {
                                const stats = getCustomerStats(c.id);
                                return (
                                    <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td title={c.name}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{
                                                    width: 38, height: 38, borderRadius: 10,
                                                    background: c.type === "Company" ? "rgba(249,115,22,0.1)" : "rgba(16,185,129,0.1)",
                                                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                                }}>
                                                    {c.type === "Company"
                                                        ? <Building2 size={18} color="var(--brand-primary)" />
                                                        : <User size={18} color="#10b981" />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{c.name}</div>
                                                    {c.uId && (
                                                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{c.uId}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="status-col">
                                            <Badge
                                                status={c.type === "Company" ? "Active" : "Paid"}
                                                text={c.type}
                                            />
                                        </td>
                                        <td title={c.contactPerson}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.contactPerson || "—"}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                                                <Phone size={12} color="var(--text-dim)" /> {c.phone}
                                            </div>
                                            {c.email && (
                                                <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                                    <Mail size={10} /> {c.email}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{stats.journeyCount}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{stats.invoiceCount} invoices</div>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 14 }}>{fmt(stats.totalRevenue)}</div>
                                            {stats.totalPaid > 0 && (
                                                <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>Paid: {fmt(stats.totalPaid)}</div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for ${c.name}`}
                                                items={[
                                                    {
                                                        id: "profile",
                                                        label: "View profile",
                                                        icon: ExternalLink,
                                                        onClick: (e) => { e.stopPropagation(); navigate(`/customers/${c.id}`); },
                                                    },
                                                    {
                                                        id: "edit",
                                                        label: "Edit client",
                                                        icon: Edit2,
                                                        onClick: (e) => { e.stopPropagation(); openModal("customer", c); },
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
