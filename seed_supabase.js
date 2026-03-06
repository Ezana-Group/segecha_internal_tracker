const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// We need to parse the seed data. It's an exported JS object from lib/seed-data.ts
// Usually, it's easier to just copy the object here since we know it.
const SEED = {
    trucks: [
        { id: "T001", reg: "KCB 100A", make: "Isuzu FVR", year: 2020, type: "Rigid", capacity: 7, driver: "D001", status: "Active", odom: 142300, tyreOdom: 110000, tyreLimit: 60000 },
        { id: "T002", reg: "KDA 200B", make: "Mercedes Actros", year: 2019, type: "Semi-Trailer", capacity: 28, driver: "D002", status: "Active", odom: 310500, tyreOdom: 270000, tyreLimit: 60000 },
        { id: "T003", reg: "KDD 300C", make: "Man TGS", year: 2021, type: "Tipper", capacity: 20, driver: "D003", status: "Maintenance", odom: 87200, tyreOdom: 60000, tyreLimit: 60000 },
    ],
    drivers: [
        { id: "D001", name: "James Kamau", phone: "0712 345 678", license: "PSV/LIC/2019/00234", class: "Class G", status: "Active", truck: "T001", joined: "2021-03-10", salary: 45000, mpesa: "0712345678" },
        { id: "D002", name: "Peter Ochieng", phone: "0723 456 789", license: "PSV/LIC/2018/00891", class: "Class G", status: "Active", truck: "T002", joined: "2020-06-15", salary: 55000, mpesa: "0723456789" },
        { id: "D003", name: "Samuel Mwangi", phone: "0734 567 890", license: "PSV/LIC/2020/00412", class: "Class CE", status: "Active", truck: "T003", joined: "2022-01-20", salary: 50000, mpesa: "0734567890" },
    ],
    journeys: [
        // Convert empty strings to null for dates/foreign keys to appease Postgres strictly typed constraints
        { id: "J001", truck: "T001", driver: "D001", origin: "Nairobi", dest: "Mombasa", date: "2025-03-01", "endDate": "2025-03-02", distance: 480, revenue: 85000, cargo: "Electronics", weight: 5.5, status: "Completed", notes: "Cleared SGR checkpoint" },
        { id: "J002", truck: "T002", driver: "D002", origin: "Nairobi", dest: "Kampala", date: "2025-03-03", "endDate": "2025-03-05", distance: 680, revenue: 140000, cargo: "FMCG Goods", weight: 25, status: "Completed", notes: "Transit through Busia" },
        { id: "J003", truck: "T001", driver: "D001", origin: "Mombasa", dest: "Nairobi", date: "2025-03-05", "endDate": "2025-03-06", distance: 480, revenue: 75000, cargo: "Spare Parts", weight: 6, status: "Completed", notes: "" },
        { id: "J004", truck: "T002", driver: "D002", origin: "Nairobi", dest: "Dar es Salaam", date: "2025-03-10", "endDate": null, distance: 840, revenue: 175000, cargo: "Machinery", weight: 22, status: "In Transit", notes: "TAZARA border" },
        { id: "J005", truck: "T001", driver: "D001", origin: "Nairobi", dest: "Eldoret", date: "2025-03-12", "endDate": null, distance: 315, revenue: 55000, cargo: "Cement", weight: 7, status: "Loading", notes: "" },
    ],
    fuel: [
        { id: "F001", truck: "T001", date: "2025-03-01", litres: 120, "pricePerL": 175, station: "Total Mlolongo", journey: "J001", odom: 141900 },
        { id: "F002", truck: "T002", date: "2025-03-03", litres: 200, "pricePerL": 173, station: "Shell Industrial Area", journey: "J002", odom: 310000 },
        { id: "F003", truck: "T001", date: "2025-03-05", litres: 100, "pricePerL": 176, station: "Kobil Mombasa", journey: "J003", odom: 142200 },
        { id: "F004", truck: "T002", date: "2025-03-04", litres: 180, "pricePerL": 172, station: "Total Naivasha", journey: "J002", odom: 310300 },
        { id: "F005", truck: "T001", date: "2025-03-12", litres: 90, "pricePerL": 177, station: "Shell Westlands", journey: "J005", odom: 142250 },
    ],
    expenses: [
        { id: "E001", truck: "T001", cat: "Maintenance", amount: 28000, date: "2025-03-08", desc: "Oil change + air filter", journey: null },
        { id: "E002", truck: "T002", cat: "Toll", amount: 4500, date: "2025-03-03", desc: "Nairobi Expressway + Kisumu road", journey: "J002" },
        { id: "E003", truck: "T003", cat: "Maintenance", amount: 95000, date: "2025-03-06", desc: "Gearbox overhaul", journey: null },
        { id: "E004", truck: "T001", cat: "Permit", amount: 8500, date: "2025-03-01", desc: "Overweight permit KEBS", journey: "J001" },
        { id: "E005", truck: "T002", cat: "Allowance", amount: 12000, date: "2025-03-05", desc: "Driver allowance Kampala trip", journey: "J002" },
        { id: "E006", truck: "T002", cat: "Toll", amount: 6200, date: "2025-03-10", desc: "Kenya-Tanzania border fees", journey: "J004" },
        { id: "E007", truck: "T001", cat: "Tyre", amount: 32000, date: "2025-03-09", desc: "2x rear tyres replacement", journey: null },
    ],
    invoices: [
        { id: "INV-001", client: "Bamburi Cement Ltd", phone: "0700111222", journey: "J001", amount: 85000, issued: "2025-03-02", due: "2025-03-16", status: "Paid", "mpesaRef": "QJK2345678", "paidDate": "2025-03-10", notes: "Payment via M-Pesa Paybill" },
        { id: "INV-002", client: "Bidco Africa", phone: "0700333444", journey: "J002", amount: 140000, issued: "2025-03-06", due: "2025-03-20", status: "Paid", "mpesaRef": "QJK8901234", "paidDate": "2025-03-18", notes: "" },
        { id: "INV-003", client: "East African Breweries", phone: "0700555666", journey: "J003", amount: 75000, issued: "2025-03-07", due: "2025-03-21", status: "Overdue", "mpesaRef": null, "paidDate": null, notes: "Follow up required" },
        { id: "INV-004", client: "Kapa Oil Refineries", phone: "0700777888", journey: "J004", amount: 175000, issued: "2025-03-11", due: "2025-03-25", status: "Pending", "mpesaRef": null, "paidDate": null, notes: "Awaiting delivery confirmation" },
    ],
    payroll: [
        { id: "PAY-001", driver: "D001", month: "2025-02", "baseSalary": 45000, allowance: 8000, deductions: 2000, status: "Paid", "mpesaRef": "PAY2345678", "paidDate": "2025-02-28" },
        { id: "PAY-002", driver: "D002", month: "2025-02", "baseSalary": 55000, allowance: 12000, deductions: 2500, status: "Paid", "mpesaRef": "PAY8901234", "paidDate": "2025-02-28" },
        { id: "PAY-003", driver: "D003", month: "2025-02", "baseSalary": 50000, allowance: 5000, deductions: 2000, status: "Paid", "mpesaRef": "PAY5678901", "paidDate": "2025-02-28" },
        { id: "PAY-004", driver: "D001", month: "2025-03", "baseSalary": 45000, allowance: 10000, deductions: 2000, status: "Pending", "mpesaRef": null, "paidDate": null },
        { id: "PAY-005", driver: "D002", month: "2025-03", "baseSalary": 55000, allowance: 15000, deductions: 2500, status: "Pending", "mpesaRef": null, "paidDate": null },
        { id: "PAY-006", driver: "D003", month: "2025-03", "baseSalary": 50000, allowance: 6000, deductions: 2000, status: "Pending", "mpesaRef": null, "paidDate": null },
    ],
};

const supabase = createClient(
    'https://okrjfhcwqebhrfcnnydw.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcmpmaGN3cWViaHJmY25ueWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgxNTUzOCwiZXhwIjoyMDg4MzkxNTM4fQ.QdL1AqkrU86YAopiMsTnlULWXFZ61WGNzoMmsal27GU'
);

async function seed() {
    console.log("Starting Seed Process...");
    // 1. Insert Drivers
    for (const item of SEED.drivers) {
        // Need to temporarily remove 'truck' fk because trucks don't exist yet!
        const { truck, ...cleanItem } = item;
        const { error } = await supabase.from('drivers').upsert(cleanItem);
        if (error) console.error("Drivers error:", error.message);
    }
    console.log("Drivers OK");

    // 2. Insert Trucks (they link to drivers)
    for (const item of SEED.trucks) {
        const { error } = await supabase.from('trucks').upsert(item);
        if (error) console.error("Trucks error:", error.message);
    }
    console.log("Trucks OK");

    // 3. Update Drivers with their truck assignments now that trucks exist
    for (const item of SEED.drivers) {
        const { error } = await supabase.from('drivers').update({ truck: item.truck }).eq('id', item.id);
        if (error) console.error("Drivers update error:", error.message);
    }
    console.log("Driver FK constraints OK");

    // 4. Journeys
    for (const item of SEED.journeys) {
        const { error } = await supabase.from('journeys').upsert(item);
        if (error) console.error("Journeys error:", error.message);
    }
    console.log("Journeys OK");

    // 5. Fuel
    for (const item of SEED.fuel) {
        const { error } = await supabase.from('fuel').upsert(item);
        if (error) console.error("Fuel error:", error.message);
    }
    console.log("Fuel OK");

    // 6. Expenses
    for (const item of SEED.expenses) {
        const { error } = await supabase.from('expenses').upsert(item);
        if (error) console.error("Expenses error:", error.message);
    }
    console.log("Expenses OK");

    // 7. Invoices
    for (const item of SEED.invoices) {
        const { error } = await supabase.from('invoices').upsert(item);
        if (error) console.error("Invoices error:", error.message);
    }
    console.log("Invoices OK");

    // 8. Payroll
    for (const item of SEED.payroll) {
        const { error } = await supabase.from('payroll').upsert(item);
        if (error) console.error("Payroll error:", error.message);
    }
    console.log("Payroll OK");
    console.log("DONE!");
}

seed();
