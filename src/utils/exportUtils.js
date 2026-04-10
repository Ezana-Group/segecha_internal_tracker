import * as XLSX from 'xlsx';
import { readSettings } from './settingsStore';

/**
 * Generates a multi-sheet Excel workbook from the application data.
 * @param {Object} data - The global application state object.
 */
/**
 * Generates a multi-sheet Excel workbook from the application data.
 * @param {Object} data - The global application state object.
 */
export const exportToExcel = (data) => {
    try {
        const wb = XLSX.utils.book_new();

        const getDriver = (id) => data.drivers?.find(d => d.id === id)?.name || id || 'N/A';
        const getTruck = (id) => data.trucks?.find(t => t.id === id)?.reg || id || 'N/A';
        const getCustomer = (id) => data.customers?.find(c => c.id === id)?.name || id || 'N/A';
        const getStaff = (id) => {
            const s = data.staff?.find(x => x.id === id) || data.drivers?.find(x => x.id === id) || data.turnboys?.find(x => x.id === id);
            return s?.name || id || 'N/A';
        };

        // 1. Journeys Sheet
        if (data.journeys && data.journeys.length > 0) {
            const journeysData = data.journeys.map(j => ({
                'Mission ID': j.uId || j.id,
                'Date': j.date,
                'Origin': j.origin,
                'Destination': j.dest,
                'Customer': getCustomer(j.customerId),
                'Delivery To': getCustomer(j.deliveryCustomerId),
                'Vehicle': getTruck(j.truck),
                'Driver': getDriver(j.driver),
                'Turnboy': data.turnboys?.find(tb => tb.id === j.turnboyId)?.name || j.turnboyId || '',
                'Distance (KM)': j.distance,
                'Revenue': j.revenue,
                'Status': j.status,
                'Cargo': j.cargoType || j.cargo || '',
                'Waybill': j.waybillNo || ''
            }));
            const ws = XLSX.utils.json_to_sheet(journeysData);
            XLSX.utils.book_append_sheet(wb, ws, 'Journeys');
        }

        // 2. Invoices Sheet
        if (data.invoices && data.invoices.length > 0) {
            const invoicesData = data.invoices.map(i => ({
                'Invoice ID': i.id,
                'Customer': i.client || getCustomer(i.customerId),
                'Date': i.date || i.issued,
                'Due Date': i.dueDate || i.due,
                'Amount': i.amount,
                'Paid Amount': i.paidAmount || 0,
                'Balance': Number(i.amount || 0) - Number(i.paidAmount || 0),
                'Status': i.status
            }));
            const ws = XLSX.utils.json_to_sheet(invoicesData);
            XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
        }

        // 3. Expenses Sheet
        if (data.expenses && data.expenses.length > 0) {
            const expensesData = data.expenses.map(e => ({
                'Exp ID': e.uId || e.id,
                'Date': e.date,
                'Vehicle': getTruck(e.truck),
                'Category': e.cat,
                'Sub-Category': e.subCat || '',
                'Description': e.desc,
                'Amount': e.amount,
                'Status': e.status || (e._pendingApproval ? 'Pending' : 'Processed')
            }));
            const ws = XLSX.utils.json_to_sheet(expensesData);
            XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        }

        // 4. Fuel Logs Sheet (Fixed data source)
        const fuelSource = data.fuel || data.fuelLogs || [];
        if (fuelSource.length > 0) {
            const fuelExport = fuelSource.map(f => ({
                'Log ID': f.uId || f.id,
                'Date': f.date,
                'Vehicle': getTruck(f.truck || f.truckId),
                'Driver': getDriver(f.driver || f.driverId),
                'Litres': f.litres,
                'Price/L': f.pricePerL || '',
                'Amount (KES)': f.amount || (Number(f.litres || 0) * Number(f.pricePerL || 0)),
                'Station': f.station,
                'Status': f.status || (f._pendingApproval ? 'Pending' : 'Approved')
            }));
            const ws = XLSX.utils.json_to_sheet(fuelExport);
            XLSX.utils.book_append_sheet(wb, ws, 'Fuel Logs');
        }

        // 5. Payroll Sheet
        if (data.payroll && data.payroll.length > 0) {
            const payrollData = data.payroll.map(p => ({
                'Month': p.month,
                'Employee': getStaff(p.driver || p.staffId),
                'Base Salary': p.baseSalary,
                'Allowance': p.allowance,
                'Deductions': p.deductions,
                'Net Amount': Number(p.baseSalary || 0) + Number(p.allowance || 0) - Number(p.deductions || 0),
                'Status': p.status,
                'M-Pesa Ref': p.mpesaRef || ''
            }));
            const ws = XLSX.utils.json_to_sheet(payrollData);
            XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
        }

        // 6. Fleet (Trucks)
        if (data.trucks && data.trucks.length > 0) {
            const fleetData = data.trucks.map(t => ({
                'ID': t.uId || t.id,
                'Registration': t.reg,
                'Make/Model': t.make || '',
                'Year': t.year || '',
                'Odometer (KM)': t.odom,
                'Status': t.status,
                'Driver': getDriver(t.driver),
                'Insurance Due': t.insuranceDue || '',
                'NTSA Due': t.ntsaDue || ''
            }));
            const ws = XLSX.utils.json_to_sheet(fleetData);
            XLSX.utils.book_append_sheet(wb, ws, 'Trucks');
        }

        // 7. Trailers (NEW)
        if (data.trailers && data.trailers.length > 0) {
            const trailerData = data.trailers.map(t => ({
                'ID': t.uId || t.id,
                'Registration': t.reg,
                'Type': t.type || '',
                'Make': t.make || '',
                'Status': t.status,
                'Assigned Truck': getTruck(t.truck)
            }));
            const ws = XLSX.utils.json_to_sheet(trailerData);
            XLSX.utils.book_append_sheet(wb, ws, 'Trailers');
        }

        // 8. Maintenance (NEW)
        const maintenanceSource = data.maintenanceLogs || data.maintenance || [];
        if (maintenanceSource.length > 0) {
            const mData = maintenanceSource.map(m => ({
                'Date': m.date,
                'Vehicle': getTruck(m.truck),
                'Type': m.type || '',
                'Description': m.desc || '',
                'Cost': m.cost || 0,
                'Odometer': m.odom || ''
            }));
            const ws = XLSX.utils.json_to_sheet(mData);
            XLSX.utils.book_append_sheet(wb, ws, 'Maintenance');
        }

        // 9. Customers Sheet
        if (data.customers && data.customers.length > 0) {
            const customersData = data.customers.map(c => ({
                'ID': c.uId || c.id,
                'Name': c.name,
                'Contact Person': c.contactPerson || '',
                'Phone': c.phone || '',
                'Email': c.email || '',
                'Address': c.address || ''
            }));
            const ws = XLSX.utils.json_to_sheet(customersData);
            XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        }

        // 10. Employees (Drivers & Staff)
        const allStaff = [
            ...(data.drivers || []).map(d => ({ ...d, role: 'Driver' })),
            ...(data.staff || []).map(s => ({ ...s, role: 'Admin/Staff' })),
            ...(data.turnboys || []).map(t => ({ ...t, role: 'Turnboy' }))
        ];
        if (allStaff.length > 0) {
            const staffData = allStaff.map(s => ({
                'ID': s.uId || s.id,
                'Name': s.name,
                'Role': s.role,
                'Phone': s.phone || '',
                'M-Pesa': s.mpesa || '',
                'ID No': s.idNo || ''
            }));
            const ws = XLSX.utils.json_to_sheet(staffData);
            XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        }

        // 11. Incidents
        if (data.incidents && data.incidents.length > 0) {
            const incidentsData = data.incidents.map((i) => ({
                'Incident ID': i.uId || i.id,
                'Date': i.date || '',
                'Type': i.incidentType || i.type || '',
                'Truck': getTruck(i.truck),
                'Driver': getDriver(i.driver),
                'Status': i.status || '',
                'Description': i.description || '',
                'Location': i.location || '',
            }));
            const ws = XLSX.utils.json_to_sheet(incidentsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Incidents');
        }

        // 12. Assets
        if (data.assets && data.assets.length > 0) {
            const assetsData = data.assets.map((a) => ({
                'Asset ID': a.uId || a.id,
                'Name': a.name || '',
                'Category': a.category || '',
                'Purchase Date': a.purchaseDate || '',
                'Cost': a.cost || 0,
                'Depreciation Method': a.depreciationMethod || '',
                'Useful Life (Years)': a.usefulLifeYears || '',
                'Salvage Value': a.salvageValue || 0,
                'Status': a.status || '',
            }));
            const ws = XLSX.utils.json_to_sheet(assetsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        }

        // 13. Documents
        if (data.documents && data.documents.length > 0) {
            const docsData = data.documents.map((d) => ({
                'Document ID': d.id,
                'Entity Type': d.entityType || '',
                'Entity ID': d.entityId || '',
                'Type': d.docType || '',
                'Label': d.label || '',
                'URL': d.url || '',
                'Expiry Date': d.expiryDate || '',
            }));
            const ws = XLSX.utils.json_to_sheet(docsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Documents');
        }

        // 14. M-Pesa ledger from settings snapshot
        const settings = readSettings();
        const mpesaRows = Array.isArray(settings.mpesaTransactions) ? settings.mpesaTransactions : [];
        if (mpesaRows.length > 0) {
            const mpesaData = mpesaRows.map((m) => ({
                'Txn ID': m.id || '',
                'Date': m.date || m.txnDate || m.txn_date || '',
                'Direction': m.direction || '',
                'Amount': m.amount || 0,
                'Reference': m.reference || '',
                'Counterparty': m.counterpartyName || m.counterpartyPhone || '',
                'Linked Type': m.linkedType || '',
                'Linked ID': m.linkedId || '',
                'Status': m.status || '',
            }));
            const ws = XLSX.utils.json_to_sheet(mpesaData);
            XLSX.utils.book_append_sheet(wb, ws, 'Mpesa');
        }

        // 15. Payslip Dispatch Queue
        if (data.payslipDispatchQueue && data.payslipDispatchQueue.length > 0) {
            const qData = data.payslipDispatchQueue.map((q) => ({
                'Queue ID': q.id,
                'Payroll ID': q.payrollId,
                'Recipient Email': q.recipientEmail,
                'Status': q.status,
                'Attempts': q.attempts || 0,
                'Scheduled At': q.scheduledAt || '',
                'Sent At': q.sentAt || '',
                'Last Error': q.lastError || '',
            }));
            const ws = XLSX.utils.json_to_sheet(qData);
            XLSX.utils.book_append_sheet(wb, ws, 'Payslip_Queue');
        }

        // 16. Ledger Entries
        if (data.ledgerEntries && data.ledgerEntries.length > 0) {
            const lData = data.ledgerEntries.map((l) => ({
                'Entry ID': l.id,
                'Entry Date': l.entryDate,
                'Source Type': l.sourceType,
                'Source ID': l.sourceId,
                'Account Code': l.accountCode,
                'Account Name': l.accountName,
                'Debit': l.debit || 0,
                'Credit': l.credit || 0,
                'Currency': l.currency || 'KES',
                'Notes': l.notes || '',
            }));
            const ws = XLSX.utils.json_to_sheet(lData);
            XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
        }

        // Generate and download file
        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Segecha_Tracker_Full_Export_${timestamp}.xlsx`);
        
        return true;
    } catch (error) {
        console.error('Excel Export failed:', error);
        return false;
    }
};

/**
 * Generates a simple CSV for a specific data array.
 */
export const exportToCSV = (dataArray, filename) => {
    try {
        if (!dataArray || dataArray.length === 0) return false;
        const ws = XLSX.utils.json_to_sheet(dataArray);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (error) {
        console.error('CSV Export failed:', error);
        return false;
    }
};

/**
 * Exports all main tables as individual CSV files.
 */
export const exportAllToCSV = (data) => {
    const sets = [
        { d: data.journeys, n: 'Journeys' },
        { d: data.invoices, n: 'Invoices' },
        { d: data.expenses, n: 'Expenses' },
        { d: data.fuel || data.fuelLogs, n: 'Fuel_Logs' },
        { d: data.drivers, n: 'Drivers' },
        { d: data.staff, n: 'Staff' },
        { d: data.customers, n: 'Customers' },
        { d: data.trucks, n: 'Fleet' },
        { d: data.trailers, n: 'Trailers' },
        { d: data.maintenanceLogs || data.maintenance, n: 'Maintenance' },
        { d: data.payroll, n: 'Payroll' },
        { d: data.turnboys, n: 'Turnboys' },
        { d: data.incidents, n: 'Incidents' },
        { d: data.assets, n: 'Assets' },
        { d: data.documents, n: 'Documents' },
        { d: (readSettings().mpesaTransactions || []), n: 'Mpesa_Transactions' },
        { d: data.payslipDispatchQueue, n: 'Payslip_Dispatch_Queue' },
        { d: data.ledgerEntries, n: 'Ledger_Entries' },
    ];

    let count = 0;
    sets.forEach(s => {
        if (s.d && s.d.length > 0) {
            setTimeout(() => exportToCSV(s.d, s.n), count * 500); // Staggered to prevent browser blocking
            count++;
        }
    });

    return count > 0;
};
