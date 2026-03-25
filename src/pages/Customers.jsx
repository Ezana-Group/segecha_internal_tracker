import React, { useState } from "react";
import { 
    Users, 
    Building2, 
    User, 
    Plus, 
    Phone, 
    Mail, 
    ExternalLink,
    ChevronRight,
    TrendingUp,
    FileText,
    CreditCard,
    Edit2,
    AlertCircle,
    Search as SearchIcon
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
            pendingAmount: totalRevenue - totalPaid
        };
    };

    // Refine customers for sorting and filtering
    const refinedCustomers = customers.map(c => {
        const stats = getCustomerStats(c.id);
        return {
            ...c,
            _missions: stats.journeyCount,
            _revenue: stats.totalRevenue,
            _pending: stats.pendingAmount,
            _contact: `${c.phone} ${c.email || ""} ${c.contactPerson || ""}`
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
        setSearchTerm
    } = useTableFilter(refinedCustomers, { 
        namespace: "cust", 
        initialSort: { col: "name", dir: "asc" },
        searchColumns: ["name", "contactPerson", "email", "uId"]
    });

    return (
        <div className="page-shell">
            <PageHeader
                icon={Building2}
                title="Customers"
                description="Accounts, contacts, and revenue exposure."
                actions={
                    <Button variant="premium" icon={Plus} onClick={() => openModal("customer", { type: "Company" })}>
                        Add client
                    </Button>
                }
            />

            {/* Top Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
                <Card title="Total Clients" icon={Users} accent="var(--brand-primary)">
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{customers.length}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                        {customers.filter(c => c.type === "Company").length} Companies • {customers.filter(c => c.type === "Individual").length} Individuals
                    </div>
                </Card>
                <Card title="Revenue Generated" icon={TrendingUp} accent="#10b981">
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>
                        {fmt((data.invoices || []).reduce((s, i) => s + +i.amount, 0))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Lifetime billing across all clients</div>
                </Card>
                <Card title="Active Invoices" icon={FileText} accent="#f59e0b">
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>
                        {(data.invoices || []).filter(i => i.status !== "Paid").length}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Awaiting payment confirmation</div>
                </Card>
            </div>

            {/* Customer List */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search clients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
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
                                { key: "uId", label: "Client ID", sortable: true },
                                { key: "name", label: "Client Name", sortable: true },
                                { key: "type", label: "Type", sortable: true },
                                { key: "contactPerson", label: "Contact Info", sortable: true },
                                { key: "_missions", label: "Missions", sortable: true, align: "right" },
                                { key: "_pending", label: "Financials (Bal)", sortable: true, align: "right" },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {sortedCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No clients found matching your filters.</div>
                                    </td>
                                </tr>
                            ) : sortedCustomers.map(c => {
                                const stats = getCustomerStats(c.id);
                                return (
                                    <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td className="sticky-col" title={c.uId || c.id.slice(0, 8).toUpperCase()}>
                                            <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                {c.uId || c.id.slice(0, 8).toUpperCase()}
                                            </div>
                                        </td>
                                        <td title={c.name}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    {c.type === "Company" ? <Building2 size={18} color="var(--brand-primary)" /> : <User size={18} color="#10b981" />}
                                                </div>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{c.name}</div>
                                            </div>
                                        </td>
                                        <td className="status-col" title={c.type}>
                                            <Badge 
                                                status={c.type === "Company" ? "Active" : "Paid"} 
                                                text={c.type} 
                                            />
                                        </td>
                                        <td title={`${c.phone} ${c.email || ""} ${c.contactPerson || ""}`}>
                                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                <Phone size={12} color="var(--text-dim)" /> {c.phone}
                                            </div>
                                            {c.contactPerson && (
                                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                                                    Attn: {c.contactPerson}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right" }} title={`${stats.journeyCount} Missions, ${stats.invoiceCount} Invoices`}>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{stats.journeyCount} Missions</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{stats.invoiceCount} Invoices</div>
                                        </td>
                                        <td style={{ textAlign: "right" }} title={`Rev: ${fmt(stats.totalRevenue)}, Paid: ${fmt(stats.totalPaid)}`}>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 14 }}>{fmt(stats.totalRevenue)}</div>
                                            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>{stats.totalPaid > 0 ? `Paid: ${fmt(stats.totalPaid)}` : 'No payments'}</div>
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for ${c.name}`}
                                                items={[
                                                    {
                                                        id: "profile",
                                                        label: "View profile",
                                                        icon: ExternalLink,
                                                        onClick: (e) => {
                                                            e.stopPropagation();
                                                            navigate(`/customers/${c.id}`);
                                                        },
                                                    },
                                                    {
                                                        id: "edit",
                                                        label: "Edit client",
                                                        icon: Edit2,
                                                        onClick: (e) => {
                                                            e.stopPropagation();
                                                            openModal("customer", c);
                                                        },
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
