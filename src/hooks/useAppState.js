import { useState, useEffect, useCallback, useRef } from "react";
import { SEED } from "../constants/seed";
import { today, uid } from "../utils/formatters";
import { TYRE_WARN_KM } from "../constants/nav";
import { PAYMENT_API, ADMIN_KEY, DRIVER_PORTAL_URL } from "../utils/env";
import { readSettings, patchSettings, syncSettingsFromServer, syncSettingsToServer } from "../utils/settingsStore.js";
import { mergeProfilePermissions } from "../utils/profilePermissions.js";
import { expandMessageTemplateContext } from "../utils/templateContext.js";
import { readPreviewFromSession, writePreviewToSession } from "../constants/previewNav.js";
import { adminAuth } from "../utils/adminAuth";

const LAST_SYNC_KEY = "segecha_last_server_sync";

const STORAGE_KEY = "segecha_tracker_v2";

/** Append seed templates whose ids are missing from saved data (keeps PDF/SMS rows when older saves overwrote the array). */
function mergeTemplateList(seedTemplates, savedTemplates) {
    const saved = Array.isArray(savedTemplates) ? [...savedTemplates] : [];
    const have = new Set(saved.map((t) => t?.id).filter(Boolean));
    for (const t of seedTemplates || []) {
        if (t?.id && !have.has(t.id)) {
            saved.push(t);
            have.add(t.id);
        }
    }
    return saved;
}

export function useAppState() {
    // P1.1 — localStorage-backed state
    const [data, setData] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            // If we have saved data, use it; otherwise, check if we should start fresh
            // or use SEED. For production alignment, we prefer empty if reset was called.
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...SEED,
                    ...parsed,
                    trucks: parsed.trucks ?? [],
                    trailers: parsed.trailers ?? [],
                    drivers: parsed.drivers ?? [],
                    journeys: parsed.journeys ?? [],
                    fuel: parsed.fuel ?? [],
                    expenses: parsed.expenses ?? [],
                    invoices: parsed.invoices ?? [],
                    payroll: parsed.payroll ?? [],
                    customers: parsed.customers ?? [],
                    staff: parsed.staff ?? [],
                    maintenance_logs: parsed.maintenance_logs ?? [],
                    templates: mergeTemplateList(SEED.templates, parsed.templates)
                };
            }
            // If no saved data, check if we just did a reset
            const lastSync = localStorage.getItem(LAST_SYNC_KEY);
            if (lastSync === 'CLEAN_WIPE') return { ...SEED, trucks: [], drivers: [], journeys: [], fuel: [], expenses: [], incidents: [], customers: [], trailers: [], staff: [], payroll: [], invoices: [], documents: [] };

            return SEED;
        } catch {
            return SEED;
        }
    });

    const [loading, setLoading] = useState(false);

    const fetchTrackerData = useCallback(async () => {
        if (!PAYMENT_API || !ADMIN_KEY) return;
        setLoading(true);
        try {
            const token = adminAuth.getToken();
            
            // 1. Sync Settings from Server
            await syncSettingsFromServer(token);

            // 2. Sync Full Data
            const res = await fetch(`${PAYMENT_API}/api/tracker/data`, {
                headers: {
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (res.status === 401) {
                console.warn("Session expired. Clearing token.");
                adminAuth.clearSession();
                return;
            }
            if (res.ok) {
                const result = await res.json();
                if (result.success && result.data) {
                    const serverData = result.data.tables || result.data;
                    setData(d => ({ ...d, ...serverData }));
                }
            }
        } catch (e) {
            console.warn("Initial data sync failed:", e.message);
        } finally {
            setLoading(false);
        }
    }, [setData]);

    useEffect(() => {
        fetchTrackerData();
    }, [fetchTrackerData]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error("Storage save error:", e);
        }
    }, [data]);

    // Auto-sync to server on every data change (debounced 1.5s)
    const autoSyncTimerRef = useRef(null);
    useEffect(() => {
        if (!PAYMENT_API || !ADMIN_KEY) return;
        // Don't auto-sync back "empty" state if we are still loading or if data matches SEED too closely
        if (loading) return;

        if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = setTimeout(async () => {
            try {
                const token = adminAuth.getToken();
                await fetch(`${PAYMENT_API}/api/tracker/data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': ADMIN_KEY,
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(data),
                });
            } catch { /* silent */ }
        }, 1500);
        return () => { if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current); };
    }, [data, loading]);

    // Toast state
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = "success") => {
        const id = Date.now();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    }, []);

    // Modal / form state
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({});
    const [filterTruck, setFilterTruck] = useState("ALL");
    const [invoicePreview, setInvoicePreview] = useState(null);
    const [sideOpen, setSideOpen] = useState(false);
    const [dark, setDark] = useState(() => {
        try {
            const s = readSettings();
            return s.defaultDarkMode === 'dark';
        } catch { return false; }
    });

    const [verifyModal, setVerifyModal] = useState(null); // holds journey awaiting verification
    const [pendingVerifications, setPendingVerifications] = useState([]);
    const backendOfflineToastAtRef = useRef(0);
    const [rejectReason, setRejectReason] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyMsg, setVerifyMsg] = useState('');
    const [rejectedFields, setRejectedFields] = useState([]);

    const [importSession, setImportSession] = useState(null);
    const [importHistory, setImportHistory] = useState([]);

    const [previewMode, setPreviewModeState] = useState(() => readPreviewFromSession());

    const setPreviewMode = useCallback((next) => {
        setPreviewModeState(next);
        writePreviewToSession(next);
    }, []);

    const clearPreviewMode = useCallback(() => {
        setPreviewModeState(null);
        writePreviewToSession(null);
    }, []);

    const [waybillModalJourney, setWaybillModalJourney] = useState(null);
    const [waybillForm, setWaybillForm] = useState(null);

    const [backups, setBackups] = useState([]);
    const [backupsLoading, setBackupsLoading] = useState(false);

    const openModal = (type, item = {}) => { setModal(type); setForm({ ...item }); };
    const closeModal = () => { setModal(null); setForm({}); };

    const closeWaybillModal = () => {
        setWaybillModalJourney(null);
        setWaybillForm(null);
    };

    const openWaybillGenerator = useCallback((journey) => {
        if (!journey?.id) return;
        let s = {};
        try {
            s = readSettings();
        } catch { /* ignore */ }

        const getInvClient = (jid) => {
            const inv = data.invoices?.find((i) => (i.journeyId || i.journey) === jid);
            return inv?.client || "";
        };

        if (journey.waybillData) {
            setWaybillForm(journey.waybillData);
            setWaybillModalJourney(journey);
            return;
        }

        const counter = s.waybillCounter ?? 1;
        const prefix = (s.waybillPrefix || s.wbPrefix || "WB").replace(/\s+/g, "");
        const year = new Date().getFullYear();
        const waybillNo = `${prefix}-${year}-${String(counter).padStart(5, "0")}`;

        const crossRules = getCrossBorderRules();
        const destLower = (journey.dest || "").toLowerCase();
        const isCrossBorder = crossRules.some((r) => r.keywords.some((k) => destLower.includes(k)));
        let borderPoint = "";
        for (const r of crossRules) {
            if (r.keywords.some((k) => destLower.includes(k))) {
                borderPoint = r.borderPoint;
                break;
            }
        }

        const truck = data.trucks.find((t) => t.id === journey.truck) || {};
        const driver = data.drivers.find((d) => d.id === journey.driver) || {};
        const trailerReg =
            (journey.trailer && data.trailers?.find((t) => t.id === journey.trailer)?.reg) || "";

        const billingCustomer = (data.customers || []).find((c) => c.id === journey.customerId) || {};
        const deliveryCustomer = (data.customers || []).find((c) => c.id === journey.deliveryCustomerId) || {};

        const endOdom = journey.endOdom ?? journey.finalOdom;

        const loadingDt = journey.date
            ? `${journey.date}T08:00`
            : "";

        const form = {
            waybillNo,
            generatedAt: new Date().toISOString(),
            generatedBy: "Admin",
            isCrossBorder,

            carrierName: s.wbCarrierName || s.companyName || "Segecha Group Ltd",
            carrierKraPin: s.wbCarrierKraPin || s.pinNumber || "",
            carrierNtsa: s.wbCarrierNtsa || "",
            carrierAddress: s.wbCarrierAddress || s.address || "",
            carrierPhone: s.wbCarrierPhone || s.phone || s.companyPhone || "",
            carrierEmail: s.wbCarrierEmail || s.email || "",

            vehicleReg: truck.reg || "",
            trailerReg: s.wbTrailerReg || trailerReg || truck.trailerReg || "",
            vehicleType: truck.type || "",
            maxPayload: truck.capacity != null ? String(truck.capacity) : "",

            driverName: driver.name || "",
            driverIdNo: driver.idNo || driver.nationalId || driver.idNumber || "",
            driverLicence: driver.license || "",
            driverPhone: driver.phone || "",

            consignorName: billingCustomer.name || getInvClient(journey.id),
            consignorKraPin: "",
            consignorAddress: billingCustomer.address || journey.origin || "",
            consignorPhone: billingCustomer.phone || "",
            loadingDateTime: loadingDt,

            consigneeName: deliveryCustomer.name || "",
            consigneeKraPin: "",
            consigneeAddress: deliveryCustomer.address || journey.dest || "",
            consigneePhone: deliveryCustomer.phone || "",
            expectedDelivery: "",

            origin: journey.origin || "",
            destination: journey.dest || "",
            borderPoint,
            transitRoute: isCrossBorder ? "Northern Corridor — A109 Mombasa–Nairobi–Malaba" : "",
            estDistance: Number(journey.distance) || 0,
            odomAtLoading: journey.startOdom != null ? String(journey.startOdom) : "",
            odomAtDelivery: endOdom != null ? String(endOdom) : "",

            cargo: [
                {
                    id: "c1",
                    description: journey.cargo || "",
                    hsCode: "",
                    packages: "",
                    grossKg: journey.weight ? String(Number(journey.weight) * 1000) : "",
                    netKg: "",
                    volumeM3: "",
                    declaredValue: "",
                },
            ],
            cargoNature: "General",
            specialHandling: "",
            sealNo: "",
            conditionAtLoading: "Good condition",
            exceptionsAtLoading: "NIL",

            agreedFreight: journey.revenue ? String(journey.revenue) : "",
            paymentTerms: "Collect",
            advancePaid: "",
            balanceDue: journey.revenue ? String(journey.revenue) : "",

            docs: {
                commercialInvoice: isCrossBorder,
                packingList: isCrossBorder,
                kraCustomsEntry: isCrossBorder,
                certOfOrigin: false,
                comesaLicence: isCrossBorder,
                transitBond: isCrossBorder,
                phytoSanitary: false,
                kebsCertificate: false,
                t1Document: isCrossBorder,
                dangerousGoodsDecl: false,
                insuranceCert: true,
                other: "",
            },

            deliveryDateTime: "",
            odomAtDeliveryFinal: "",
            conditionOnArrival: "",
            exceptionsOnDelivery: "NIL",
            balanceReceived: "",
        };

        setWaybillForm(form);
        setWaybillModalJourney(journey);
    }, [data.trucks, data.drivers, data.trailers, data.invoices, data.customers]);

    const saveItem = async (col, item, options = {}) => {
        const skipClose = options?.skipClose === true;
        let isNew = false;
        let finalItem = { ...item };

        // 1. Prepare data (ID generation, mileage calculation, etc.)
        if (col === 'journeys') {
            if (finalItem.startOdom && finalItem.finalOdom) {
                finalItem.distance = Number(finalItem.finalOdom) - Number(finalItem.startOdom);
            }
        }

        const currentData = data[col] || [];
        const i = currentData.findIndex(x => x.id === finalItem.id);

        if (i < 0) {
            isNew = true;
            let uId = finalItem.uId;
            if (!uId) {
                try {
                    const settings = readSettings();
                    const prefixes = {
                        trucks: settings.vehicleIdPrefix || 'TRK-',
                        drivers: settings.driverIdPrefix || 'DRV-',
                        turnboys: settings.turnboyIdPrefix || 'TBY-',
                        staff: settings.staffIdPrefix || 'EMP-',
                        payroll: settings.payrollIdPrefix || 'PAY-',
                        customers: settings.customerIdPrefix || 'CLT-',
                        trailers: settings.trailerIdPrefix || 'TRL-',
                        journeys: settings.journeyIdPrefix || 'MSN-',
                        fuel: settings.fuelIdPrefix || 'FL-',
                        expenses: settings.expenseIdPrefix || 'EXP-',
                    };

                    if (prefixes[col]) {
                        window._uIdCounters = window._uIdCounters || {};
                        if (!window._uIdCounters[col]) {
                            let maxNum = currentData.length;
                            for (const item of currentData) {
                                if (item.uId && typeof item.uId === 'string' && item.uId.startsWith(prefixes[col])) {
                                    const numStr = item.uId.replace(prefixes[col], '');
                                    const num = parseInt(numStr, 10);
                                    if (!isNaN(num) && num > maxNum) maxNum = num;
                                }
                            }
                            window._uIdCounters[col] = maxNum;
                        }
                        window._uIdCounters[col] += 1;
                        uId = prefixes[col] + String(window._uIdCounters[col]).padStart(3, '0');
                    }
                } catch (e) {
                    console.error("Error generating uId:", e);
                }
            }
            finalItem = { ...finalItem, id: finalItem.id || uid(), uId };
        }

        // 2. Sync to server BEFORE updating local state to ensure FK integrity for sequential calls
        // Or at least return the promise. For FK integrity, we MUST wait for the server success.
        if (PAYMENT_API) {
            try {
                const token = adminAuth.getToken();
                const res = await fetch(`${PAYMENT_API}/api/admin/${col}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-key": ADMIN_KEY,
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(finalItem),
                });
                
                const result = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const errorMsg = result.error || res.statusText || "Server error";
                    console.error(`Sync failed for ${col}:`, errorMsg);
                    throw new Error(errorMsg);
                }
                
                // If backend returned an updated item (e.g. with server-side fields), use it
                if (result.item) finalItem = { ...finalItem, ...result.item };
            } catch (err) {
                console.error(`Sync failed for ${col}:`, err.message);
                showToast(`Could not save ${col} to server: ` + err.message, "error");
                throw err; // Re-throw so caller can stop sequencing
            }
        }

        // 3. Update local state
        setData(d => {
            const arr = [...(d[col] || [])];
            const idx = arr.findIndex(x => x.id === finalItem.id);
            if (idx >= 0) arr[idx] = finalItem;
            else arr.push(finalItem);
            return { ...d, [col]: arr };
        });

        if (!options?.silent) {
            if (isNew && col === 'drivers') {
                const portalUrl = `${DRIVER_PORTAL_URL.replace(/\/$/, "")}/set-password`;
                const msg = `Welcome to Segecha, ${item.name || "Driver"}. Your account is ready. Set your password: ${portalUrl}`;
                console.log("NOTIFY_DRIVER:", { phone: item.phone, email: item.email });

                if (PAYMENT_API && !ADMIN_KEY.includes("change-this")) {
                    fetch(`${PAYMENT_API}/api/notifications/send`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "DRIVER_WELCOME",
                            driverId: item.id,
                            phone: item.phone,
                            email: item.email,
                            message: msg,
                            adminKey: ADMIN_KEY,
                        }),
                    })
                        .then(async (r) => {
                            const j = await r.json().catch(() => ({}));
                            if (r.ok && j.success) {
                                showToast(
                                    j.sent ? "Driver saved. Welcome SMS sent." : "Driver saved. Notification logged (no SMS — check server).",
                                    "success"
                                );
                            } else {
                                showToast("Driver saved. SMS notify failed: " + (j.error || r.status), "success");
                            }
                        })
                        .catch((err) => {
                            console.warn("Notification API failed:", err.message);
                            showToast("Driver saved. Could not reach notification service.", "success");
                        });
                } else {
                    showToast("Driver saved. Configure VITE_ADMIN_KEY and API to send welcome SMS.", "success");
                }
            } else {
                showToast("Record saved", "success");
            }
        }

        if (!skipClose) closeModal();
    };

    const delItem = async (col, id, label) => {
        const desc = label ? `"${label}"` : 'this record';
        if (!window.confirm(`Delete ${desc}? This cannot be undone.`)) return;

        if (PAYMENT_API) {
            try {
                const token = adminAuth.getToken();
                const res = await fetch(`${PAYMENT_API}/api/admin/${col}/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'x-admin-key': ADMIN_KEY,
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                const j = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(j.error || res.statusText || "Delete failed");
                }
                
                // Successfully deleted on server, now update local
                setData(d => ({ ...d, [col]: (d[col] || []).filter(x => x.id !== id) }));
                showToast(`${label || 'Record'} deleted`, "success");
            } catch (err) {
                console.error(`Delete failed for ${col}:`, err.message);
                showToast(`Could not delete from server: ` + err.message, "error");
            }
        } else {
            // No API, just local (demo mode)
            setData(d => ({ ...d, [col]: (d[col] || []).filter(x => x.id !== id) }));
            showToast(`${label || 'Record'} removed locally`, "success");
        }
    };

    const markPayrollPaid = async (id) => {
        const item = data.payroll.find(p => p.id === id);
        if (!item) return;

        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/payroll/${id}/pay`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-admin-key": ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error("Could not mark as paid on server");
            
            setData(d => ({
                ...d,
                payroll: d.payroll.map(p => p.id === id ? { ...p, status: "Paid" } : p)
            }));
            showToast("Payroll record marked as Paid", "success");
        } catch (err) {
            showToast("Failed to sync status: " + err.message, "error");
        }
    };

    /** Update system settings and sync to server */
    const updateSettings = async (patch) => {
        const next = patchSettings(patch);
        const token = adminAuth.getToken();
        const success = await syncSettingsToServer(token);
        if (!success) {
            console.warn("Settings updated locally but failed to persist to server.");
        }
        return next;
    };

    /** Unified helper for staff/driver account credential resets */
    const resetAccountCredentials = async (type, entity, forcePasswordReset = false) => {
        if (!PAYMENT_API) return;
        const res = await fetch(`${PAYMENT_API}/api/${type}/account/regenerate-credentials`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-admin-key": ADMIN_KEY 
            },
            body: JSON.stringify({
                [`${type}Id`]: entity.id,
                email: entity.email || entity.name,
                phone: entity.phone || "",
                name: entity.name,
                role: entity.role,
                forcePasswordReset,
                adminKey: ADMIN_KEY,
            }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        
        setData(prev => ({
            ...prev,
            [type]: (prev[type] || []).map(x =>
                x.id === entity.id ? { ...x, ...j, firstLogin: true } : x
            )
        }));
        return j;
    };

    /** Unified helper for staff account deletion */
    const deleteStaffAccount = async (staffId) => {
        if (!PAYMENT_API) return;
        const res = await fetch(`${PAYMENT_API}/api/staff/account/${staffId}?adminKey=${encodeURIComponent(ADMIN_KEY)}`, { method: "DELETE" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        
        setData(prev => ({
            ...prev,
            staff: (prev.staff || []).filter(x => x.id !== staffId),
            payroll: (prev.payroll || []).filter(p => p.driver !== staffId),
        }));
    };

    /** Unified helper for driver account deletion */
    const deleteDriverAccount = async (driverId) => {
        if (!PAYMENT_API) return;
        const res = await fetch(`${PAYMENT_API}/api/driver/account/${driverId}?adminKey=${encodeURIComponent(ADMIN_KEY)}`, { method: "DELETE" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        
        setData(prev => ({
            ...prev,
            drivers: (prev.drivers || []).filter(x => x.id !== driverId),
            journeys: (prev.journeys || []).filter(x => x.driver !== driverId),
            fuel: (prev.fuel || []).filter(x => x.driver !== driverId && x._submittedBy !== driverId),
            expenses: (prev.expenses || []).filter(x => x.driver !== driverId && x._submittedBy !== driverId),
            payroll: (prev.payroll || []).filter(p => p.driver !== driverId),
        }));
    };


    const markInvoicePaid = async (id) => {
        const item = data.invoices.find(i => i.id === id);
        if (!item) return;
        const updated = {
            ...item,
            status: "Paid",
            paidAmount: +item.amount,
            paidDate: today(),
            mpesaRef: "QJK" + uid().slice(0, 7),
            payments: [...(item.payments || []), {
                id: uid().slice(0, 8),
                date: today(),
                amount: +item.amount - (+item.paidAmount || 0),
                method: 'Quick Pay',
                ref: "QJK" + uid().slice(0, 7),
                notes: 'Marked as paid by admin'
            }]
        };
        try {
            await saveItem("invoices", updated);
            showToast("Invoice marked as paid and synced", "success");
        } catch (e) {
            // error already handled
        }
    };

    const addInvoicePayment = async (payment) => {
        const inv = data.invoices.find(i => i.id === payment.invoiceId);
        if (!inv) throw new Error("Invoice not found");

        const newPayments = [...(inv.payments || []), { ...payment, id: payment.id || uid().slice(0, 8) }];
        const newPaidAmount = newPayments.reduce((s, p) => s + +p.amount, 0);
        const newStatus = newPaidAmount >= +inv.amount ? "Paid" : "Partial";

        const updatedInvoice = {
            ...inv,
            paidAmount: newPaidAmount,
            status: newStatus,
            payments: newPayments,
            paidDate: newStatus === "Paid" ? today() : inv.paidDate
        };

        try {
            // 1. Save the payment record for audit
            await saveItem("payments", payment);
            // 2. Sync invoice status to backend
            await saveItem("invoices", updatedInvoice);
            showToast("Payment logged and invoice updated", "success");
        } catch (e) {
            console.error("Payment logging failed:", e);
            throw e;
        }
    };

    const resetData = () => {
        if (window.confirm("Reset all local data to demo data? This cannot be undone.")) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
        }
    };

    const hardResetSystem = async () => {
        if (!window.confirm("CRITICAL: This will permanently delete ALL data from BOTH this browser and the production server. This cannot be undone. Continue?")) {
            return;
        }

        try {
            const res = await fetch(`${PAYMENT_API}/api/admin/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': ADMIN_KEY
                }
            });
            const result = await res.json().catch(() => ({}));

            if (res.ok) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.setItem(LAST_SYNC_KEY, 'CLEAN_WIPE');
                showToast("System reset successful. Reloading...", "success");
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast("Server reset failed: " + (result.error || "Unknown error"), "error");
            }
        } catch (e) {
            showToast("Connection error during reset: " + e.message, "error");
        }
    };

    const verifyJourney = async (journeyId, approved, rejectionReason = '', rejectedFieldsToPass = []) => {
        setVerifyLoading(true);
        setVerifyMsg('');
        let resultPayload = null;
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/journey/${journeyId}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ approved, rejectionReason, rejectedFields: rejectedFieldsToPass }),
            });
            if (res.status === 401) { adminAuth.clearSession(); return; }
            const result = await res.json();
            resultPayload = result;
            if (result.success) {
                const action = result.action || 'completion';
                const msg = action === 'start'
                    ? approved
                        ? 'Trip start approved. Driver can now proceed to arrival.'
                        : 'Trip start rejected. Driver can update and re-submit.'
                    : approved
                        ? 'Journey marked as completed.'
                        : 'Journey returned to in transit.';
                setVerifyMsg(msg);

                // Update local copy if the journey exists in this browser workspace.
                setData(d => ({
                    ...d,
                    journeys: d.journeys.map(j => (j.id === journeyId ? { ...j, ...(result.journey || {}) } : j)),
                }));

                // Refresh incoming queue from server-side snapshot.
                await fetchPendingVerifications();

                setTimeout(() => {
                    setVerifyModal(null);
                    setVerifyMsg('');
                    setRejectReason('');
                    setRejectedFields([]);
                }, 1000);
            } else {
                setVerifyMsg('Error: ' + result.error);
            }
        } catch (e) {
            setVerifyMsg('Error: ' + e.message);
        }
        setVerifyLoading(false);
        return resultPayload;
    };

    const verifySubmission = async (id, type, approved, reason = '', rejectedFields = []) => {
        setVerifyLoading(true);
        setVerifyMsg('');
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/submission/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ id, type, approved, reason, rejectedFields }),
            });
            if (res.status === 401) { adminAuth.clearSession(); return; }
            const result = await res.json();
            if (result.success) {
                setVerifyMsg(approved ? 'Submission approved.' : 'Submission rejected.');

                // Update local copy
                const col = type === 'fuel' ? 'fuel' : type === 'expense' ? 'expenses' : 'incidents';
                setData(d => ({
                    ...d,
                    [col]: (d[col] || []).map(item => item.id === id ? { ...item, ...result.item } : item)
                }));

                await fetchPendingVerifications();

                setTimeout(() => {
                    setVerifyModal(null);
                    setVerifyMsg('');
                    setRejectReason('');
                }, 1000);
            } else {
                setVerifyMsg('Error: ' + result.error);
            }
        } catch (e) {
            setVerifyMsg('Error: ' + e.message);
        }
        setVerifyLoading(false);
    };

    const syncToServer = useCallback(async () => {
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/tracker/data`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-key": ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ data }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
            showToast("Server snapshot updated via PostgreSQL sync.", "success");
            fetchBackups();
            return true;
        } catch (e) {
            showToast("Sync failed: " + e.message, "error");
            return false;
        }
    }, [data, showToast]);

    const fetchBackups = useCallback(async () => {
        setBackupsLoading(true);
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/tracker/backups`, {
                headers: {
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (res.status === 401) { adminAuth.clearSession(); return; }
            const j = await res.json();
            if (j.success) {
                setBackups(j.backups || []);
            }
        } catch (e) {
            console.warn("Failed to fetch backups:", e.message);
        }
        setBackupsLoading(false);
    }, []);

    const createManualBackup = async () => {
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/tracker/backup-now`, {
                method: 'POST',
                headers: {
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const j = await res.json();
            if (j.success) {
                showToast(j.message, "success");
                fetchBackups();
            } else {
                showToast("Backup failed: " + j.error, "error");
            }
        } catch (e) {
            showToast("Backup connection error: " + e.message, "error");
        }
    };

    const restoreFromBackup = async (filename) => {
        if (!window.confirm(`Are you SURE you want to restore from "${filename}"? This will overwrite ALL current data.`)) return;

        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/tracker/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ filename })
            });
            const j = await res.json();
            if (j.success) {
                showToast("System restored successfully. Reloading data...", "success");
                // Force a reload to get the new state from server/JSON
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast("Restore failed: " + j.error, "error");
            }
        } catch (e) {
            showToast("Restore connection error: " + e.message, "error");
        }
    };

    const downloadBackup = async (filename) => {
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/tracker/backups/download/${filename}`, {
                headers: {
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            showToast("Backup download failed: " + e.message, "error");
        }
    };

    const uploadBackup = async (file) => {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result;
                const token = adminAuth.getToken();
                const res = await fetch(`${PAYMENT_API}/api/tracker/upload-backup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': ADMIN_KEY,
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ filename: file.name, content })
                });
                const j = await res.json();
                if (j.success) {
                    showToast("Backup uploaded successfully.", "success");
                    fetchBackups();
                } else {
                    showToast("Upload failed: " + j.error, "error");
                }
            };
            reader.readAsText(file);
        } catch (e) {
            showToast("Upload error: " + e.message, "error");
        }
    };

    const fetchPendingVerifications = useCallback(async () => {
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/journeys/pending-verification`, {
                headers: {
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (res.status === 401) {
                adminAuth.clearSession();
                return;
            }
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const result = await res.json();
            const pendingJourneys = result.journeys || [];
            const pendingFuel = result.fuel || [];
            const pendingExpenses = result.expenses || [];
            const incidents = result.incidents || [];
            const documents = result.documents || [];
            const customers = result.customers || [];

            // Combine for the global pending badge (sidebar)
            const combined = [
                ...pendingJourneys.map(j => ({ ...j, _itemType: 'journey' })),
                ...pendingFuel.map(f => ({ ...f, _itemType: 'fuel' })),
                ...pendingExpenses.map(e => ({ ...e, _itemType: 'expense' })),
                ...incidents.map(i => ({ ...i, _itemType: 'incident' }))
            ];
            setPendingVerifications(combined);

            // Merge everything into local state lists
            setData(d => {
                const nextData = { ...d };
                let changed = false;

                if (documents && JSON.stringify(d.documents) !== JSON.stringify(documents)) {
                    nextData.documents = documents;
                    changed = true;
                }

                if (customers.length > 0) {
                    const nextCust = [...(d.customers || [])];
                    customers.forEach(pc => {
                        const idx = nextCust.findIndex(c => c.id === pc.id);
                        if (idx >= 0) {
                            // Check for changes (e.g. name, phone, etc.)
                            if (JSON.stringify(nextCust[idx]) !== JSON.stringify(pc)) {
                                nextCust[idx] = { ...nextCust[idx], ...pc };
                                changed = true;
                            }
                        } else {
                            nextCust.push(pc);
                            changed = true;
                        }
                    });
                    nextData.customers = nextCust;
                }

                if (pendingJourneys.length > 0) {
                    const nextJourneys = [...(d.journeys || [])];
                    pendingJourneys.forEach(pj => {
                        const idx = nextJourneys.findIndex(j => j.id === pj.id);
                        if (idx >= 0) {
                            if (nextJourneys[idx].status !== pj.status || nextJourneys[idx].customerId !== pj.customerId) {
                                nextJourneys[idx] = { ...nextJourneys[idx], ...pj };
                                changed = true;
                            }
                        } else {
                            nextJourneys.push(pj);
                            changed = true;
                        }
                    });
                    nextData.journeys = nextJourneys;
                }

                if (pendingFuel.length > 0) {
                    const nextFuel = [...(d.fuel || [])];
                    pendingFuel.forEach(pf => {
                        const idx = nextFuel.findIndex(f => f.id === pf.id);
                        if (idx >= 0) {
                            if (nextFuel[idx]._pendingApproval !== pf._pendingApproval) {
                                nextFuel[idx] = { ...nextFuel[idx], ...pf };
                                changed = true;
                            }
                        } else {
                            nextFuel.push(pf);
                            changed = true;
                        }
                    });
                    nextData.fuel = nextFuel;
                }

                if (pendingExpenses.length > 0) {
                    const nextExp = [...(d.expenses || [])];
                    pendingExpenses.forEach(pe => {
                        const idx = nextExp.findIndex(e => e.id === pe.id);
                        if (idx >= 0) {
                            if (nextExp[idx]._pendingApproval !== pe._pendingApproval) {
                                nextExp[idx] = { ...nextExp[idx], ...pe };
                                changed = true;
                            }
                        } else {
                            nextExp.push(pe);
                            changed = true;
                        }
                    });
                    nextData.expenses = nextExp;
                }

                if (incidents.length > 0) {
                    const nextIncidents = [...(d.incidents || [])];
                    incidents.forEach(pi => {
                        const idx = nextIncidents.findIndex(i => i.id === pi.id);
                        if (idx >= 0) {
                            if (JSON.stringify(nextIncidents[idx]) !== JSON.stringify(pi)) {
                                nextIncidents[idx] = { ...nextIncidents[idx], ...pi };
                                changed = true;
                            }
                        } else {
                            nextIncidents.push(pi);
                            changed = true;
                        }
                    });
                    nextData.incidents = nextIncidents;
                }

                return changed ? nextData : d;
            });
        } catch (e) {
            const msg = String(e?.message || "");
            const offline = msg.includes("Failed to fetch") || msg.includes("ERR_CONNECTION_REFUSED");
            if (offline) {
                const now = Date.now();
                if (now - backendOfflineToastAtRef.current > 60000) {
                    backendOfflineToastAtRef.current = now;
                    showToast("Backend is offline. Some server features are temporarily unavailable.", "warning");
                }
            } else {
                showToast("Could not load pending verifications from server.", "warning");
            }
            setPendingVerifications([]);
        }
    }, [showToast]);

    const fetchImportHistory = useCallback(async () => {
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/import-history`, {
                headers: {
                    'x-admin-key': ADMIN_KEY,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (res.status === 401) {
                adminAuth.clearSession();
                return;
            }
            if (res.ok) {
                const result = await res.json();
                setImportHistory(result.history || []);
            }
        } catch (e) {
            console.warn("Could not load import history:", e.message);
        }
    }, []);

    useEffect(() => {
        // Poll server for incoming approval requests (driver portal writes to server).
        fetchPendingVerifications();
        fetchImportHistory();
        const id = setInterval(() => {
            fetchPendingVerifications();
            fetchImportHistory();
        }, 15000);
        return () => clearInterval(id);
    }, [fetchPendingVerifications, fetchImportHistory]);

    // ─── EXCEL IMPORT ENGINE ─────────────────────────────────────────────────

    const parseExcelDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            return d.toISOString().split('T')[0];
        }
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
        return null;
    };

    const findTruckByReg = (reg) => {
        if (!reg) return null;
        const clean = String(reg).trim().toUpperCase().replace(/\s+/g, ' ');
        return data.trucks.find(t =>
            t.reg.toUpperCase().replace(/\s+/g, ' ') === clean
        ) || null;
    };

    const parseNumeric = (val) => {
        if (val === null || val === undefined || val === '' || val === '???') return null;
        const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? null : n;
    };

    const tripStatusMap = (progressTracking) => {
        if (!progressTracking) return 'Completed';
        const pt = String(progressTracking).toLowerCase();
        if (pt.includes('awaiting') || pt.includes('pending') || pt.includes('deposit only')) return 'In Transit';
        if (pt.includes('fully paid') || pt.includes('complete')) return 'Completed';
        return 'Completed';
    };

    const expenseCatFromDesc = (desc) => {
        if (!desc) return 'Other';
        const d = String(desc).toLowerCase();
        if (d.includes('insurance') || d.includes('insuarance')) return 'Insurance';
        if (d.includes('licence') || d.includes('license') || d.includes('permit') || d.includes('comesa') || d.includes('ntsa')) return 'Permit';
        if (d.includes('salary') || d.includes('salaries')) return 'Salary';
        if (d.includes('maintenance')) return 'Maintenance';
        return 'Other';
    };

    const runExcelImport = async (file) => {
        return new Promise((resolve, reject) => {
            if (!window.XLSX) { reject(new Error('SheetJS not loaded yet — wait a moment and try again')); return; }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = window.XLSX.read(e.target.result, { type: 'array', cellDates: true });

                    const session = {
                        fileName: file.name,
                        parsedAt: new Date().toISOString(),
                        sheets: {
                            trips: { valid: [], errors: [] },
                            expenses: { valid: [], errors: [] },
                            maintenance: { valid: [], errors: [] },
                        },
                        committed: false,
                    };

                    const tripsSheet = wb.Sheets['Trips_2025'];
                    if (tripsSheet) {
                        const rows = window.XLSX.utils.sheet_to_json(tripsSheet, {
                            header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd'
                        });

                        const headers = rows[1] || []; // Headers are on row 2 (index 1)
                        const hMap = (rawHeaders, aliases) => {
                            const map = {};
                            rawHeaders.forEach((h, i) => {
                                const norm = String(h || '').toLowerCase().trim();
                                for (const [field, aliasList] of Object.entries(aliases)) {
                                    if (aliasList.includes(norm) && !(field in map)) map[field] = i;
                                }
                            });
                            return map;
                        };

                        const tripAliases = {
                            vehicle: ['vehicle', 'truck', 'truck id', 'vehicle reg', 'reg'],
                            date: ['date', 'departure date', 'trip date'],
                            origin: ['origin', 'from', 'departure'],
                            destination: ['destination', 'to', 'arrival', 'dest'],
                            startOdo: ['start odom', 'start odometer', 'opening mileage', 'opening odom'],
                            endOdo: ['end odom', 'end odometer', 'closing mileage', 'closing odom'],
                            standardDist: ['standard distance', 'km', 'dist'],
                            grossIncome: ['gross income', 'revenue', 'income', 'amount'],
                            fuelLitres: ['fuel(l)', 'litres', 'liters', 'fuel litres'],
                            fuelPrice: ['fuel price (per litre)', 'price per litre', 'price/l'],
                            driverMileage: ['driver millage', 'driver mileage', 'mileage allowance'],
                            turnboy: ['turn-boy', 'turnboy', 'turnboy allowance'],
                            roadUsers: ['road users fee', 'road users', 'tolls'],
                            otherExp: ['other expenses', 'additional expenses'],
                            progressTrack: ['status', 'progress tracking', 'trip status'],
                        };

                        const col = hMap(headers, tripAliases);
                        const dataRows = rows.slice(2).filter(r => r.some(v => v !== null));

                        dataRows.forEach((row, idx) => {
                            const get = (field) => row[col[field]] ?? null;

                            const rawRow = {
                                vehicle: get('vehicle'),
                                date: get('date'),
                                origin: get('origin'),
                                destination: get('destination'),
                                startOdo: get('startOdo'),
                                endOdo: get('endOdo'),
                                standardDist: get('standardDist'),
                                grossIncome: get('grossIncome'),
                                fuelLitres: get('fuelLitres'),
                                fuelPrice: get('fuelPrice'),
                                driverMileage: get('driverMileage'),
                                turnboy: get('turnboy'),
                                roadUsers: get('roadUsers'),
                                otherExp: get('otherExp'),
                                progressTrack: get('progressTrack'),
                            };

                            const errors = [];
                            const warnings = [];

                            const truck = findTruckByReg(rawRow.vehicle);
                            if (!rawRow.vehicle) errors.push({ field: 'Vehicle', msg: 'Vehicle registration is missing' });
                            else if (!truck) warnings.push({ field: 'Vehicle', msg: `Truck "${rawRow.vehicle}" not found in fleet` });

                            const date = parseExcelDate(rawRow.date);
                            if (!date) errors.push({ field: 'Date', msg: 'Date is missing or invalid' });

                            if (!rawRow.origin) errors.push({ field: 'Origin', msg: 'Origin is missing' });
                            if (!rawRow.destination) errors.push({ field: 'Destination', msg: 'Destination is missing' });

                            const distance = parseNumeric(rawRow.standardDist);
                            if (!distance || distance <= 0) errors.push({ field: 'Standard Distance', msg: 'Standard distance is missing or zero' });

                            const revenue = parseNumeric(rawRow.grossIncome);
                            if (!revenue || revenue <= 0) errors.push({ field: 'Gross Income', msg: 'Gross income is missing or zero' });

                            const fuelLitres = parseNumeric(rawRow.fuelLitres);
                            const fuelPrice = parseNumeric(rawRow.fuelPrice);
                            if (fuelLitres && !fuelPrice) warnings.push({ field: 'Fuel Price', msg: 'Fuel litres present but price missing' });

                            const mapped = {
                                _rowNum: idx + 3,
                                _sheetName: 'Trips_2025',
                                _rawVehicle: rawRow.vehicle,

                                journeyId: uid(), truck: truck?.id || '', date: date || '',
                                origin: rawRow.origin || '', dest: rawRow.destination || '', distance: distance || 0,
                                revenue: revenue || 0, status: tripStatusMap(rawRow.progressTrack),
                                startOdom: parseNumeric(rawRow.startOdo), endOdom: parseNumeric(rawRow.endOdo),

                                hasFuel: !!(fuelLitres && fuelPrice), fuelLitres: fuelLitres || 0, fuelPrice: fuelPrice || 0,

                                driverMileage: parseNumeric(rawRow.driverMileage) || 0, turnboy: parseNumeric(rawRow.turnboy) || 0,
                                roadUsers: parseNumeric(rawRow.roadUsers) || 0, otherExp: parseNumeric(rawRow.otherExp) || 0,

                                errors, warnings,
                                accepted: errors.length === 0,
                                edited: false,
                            };

                            if (errors.length > 0) session.sheets.trips.errors.push(mapped);
                            else session.sheets.trips.valid.push(mapped);
                        });
                    }

                    const fixedSheet = wb.Sheets['Fixed_Expenses'];
                    if (fixedSheet) {
                        const rows = window.XLSX.utils.sheet_to_json(fixedSheet, { header: 1, defval: null, raw: true });
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthDates = months.map((_, i) => `2025-${String(i + 1).padStart(2, '0')}-01`);
                        const dataRows = rows.slice(2).filter(r => r[0] !== null);

                        dataRows.forEach((row, idx) => {
                            const itemName = row[0];
                            if (!itemName) return;

                            months.forEach((month, mIdx) => {
                                const amount = parseNumeric(row[3 + mIdx]);
                                if (!amount || amount <= 0) return;

                                const errors = [];
                                const mapped = {
                                    _rowNum: idx + 3, _sheetName: 'Fixed_Expenses', _monthName: month,
                                    expenseId: uid(), truck: '', date: monthDates[mIdx],
                                    cat: expenseCatFromDesc(itemName), amount: Math.round(amount),
                                    desc: `${itemName} (${month} 2025)`,
                                    errors, warnings: [], accepted: true, edited: false,
                                };
                                if (errors.length > 0) session.sheets.expenses.errors.push(mapped);
                                else session.sheets.expenses.valid.push(mapped);
                            });
                        });
                    }

                    const maintSheet = wb.Sheets['Maintenance'];
                    if (maintSheet) {
                        const rows = window.XLSX.utils.sheet_to_json(maintSheet, {
                            header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd'
                        });
                        const dataRows = rows.slice(3).filter(r => r.some(v => v !== null));

                        dataRows.forEach((row, idx) => {
                            const rawRow = {
                                vehicleReg: row[1], task: row[3], cost: row[6], dateUnder: row[7],
                                odomReading: row[9], notes: row[10], addlNotes: row[11],
                            };

                            const errors = [];
                            const warnings = [];

                            const truck = findTruckByReg(rawRow.vehicleReg);
                            if (!rawRow.vehicleReg) errors.push({ field: 'Vehicle Reg', msg: 'Vehicle registration is missing' });
                            else if (!truck) warnings.push({ field: 'Vehicle Reg', msg: `Truck "${rawRow.vehicleReg}" not found in fleet` });

                            const cost = parseNumeric(rawRow.cost);
                            if (!cost || cost <= 0) errors.push({ field: 'Cost', msg: 'Cost is missing, zero, or "???"' });

                            const date = parseExcelDate(rawRow.dateUnder);
                            if (!date) errors.push({ field: 'Date Undertaken', msg: 'Date undertaken is missing or invalid' });

                            const task = rawRow.task || 'Other';
                            const allNotes = [rawRow.notes, rawRow.addlNotes].filter(Boolean).join(' · ');

                            const mapped = {
                                _rowNum: idx + 4, _sheetName: 'Maintenance', _rawVehicle: rawRow.vehicleReg,
                                expenseId: uid(), truck: truck?.id || '', date: date || '',
                                cat: 'Maintenance', amount: cost || 0, desc: `${task}${allNotes ? ' — ' + allNotes : ''}`,
                                odom: parseNumeric(rawRow.odomReading) || 0, _maintenanceTask: task,
                                _maintenanceDetails: { task, notes: allNotes, odomReading: parseNumeric(rawRow.odomReading) || 0, cost: cost || 0 },
                                errors, warnings, accepted: errors.length === 0, edited: false,
                            };
                            if (errors.length > 0) session.sheets.maintenance.errors.push(mapped);
                            else session.sheets.maintenance.valid.push(mapped);
                        });
                    }

                    resolve(session);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const commitImport = async (session) => {
        const allTrips = [...session.sheets.trips.valid, ...session.sheets.trips.errors].filter(r => r.accepted);
        const allExpenses = [...session.sheets.expenses.valid, ...session.sheets.expenses.errors].filter(r => r.accepted);
        const allMaint = [...session.sheets.maintenance.valid, ...session.sheets.maintenance.errors].filter(r => r.accepted);

        const newJourneys = [];
        const newFuel = [];
        const sheetExpenseToRecord = (row) => ({
            id: row.expenseId || uid(),
            truck: row.truck || '',
            date: row.date,
            cat: row.cat,
            amount: row.amount,
            desc: row.desc,
            journey: row.journey || '',
            odom: row.odom,
            ...(row._maintenanceTask != null ? { _maintenanceTask: row._maintenanceTask } : {}),
            ...(row._maintenanceDetails ? { _maintenanceDetails: row._maintenanceDetails } : {}),
        });
        const newExpenses = [...allExpenses, ...allMaint].map(sheetExpenseToRecord);

        const settings = readSettings();
        const journeyPrefix = settings.journeyIdPrefix || 'JRN-';

        allTrips.forEach((row, tripIdx) => {
            // Generate uId for journey
            const journeyCount = data.journeys.length + newJourneys.length + 1;
            const uId = journeyPrefix + String(journeyCount).padStart(4, '0');

            newJourneys.push({
                id: row.journeyId,
                uId: uId,
                truck: row.truck,
                date: row.date,
                origin: row.origin,
                dest: row.dest,
                distance: row.distance,
                revenue: row.revenue,
                status: row.status,
                startOdom: row.startOdom,
                endOdom: row.endOdom,
                cargo: '',
                weight: '',
                notes: `Imported from ${session.fileName}`,
            });

            if (row.hasFuel && row.fuelLitres > 0 && row.fuelPrice > 0) {
                newFuel.push({
                    id: uid(), truck: row.truck, date: row.date, litres: row.fuelLitres,
                    pricePerL: row.fuelPrice, station: 'Imported', journey: row.journeyId, odom: row.endOdom || 0,
                });
            }

            if (row.driverMileage > 0) {
                newExpenses.push({
                    id: uid(), truck: row.truck, date: row.date, cat: 'Allowance', amount: row.driverMileage,
                    desc: `Driver mileage allowance — ${row.origin} → ${row.dest}`, journey: row.journeyId, _mileageAllowance: true,
                });
            }
            if (row.turnboy > 0) {
                newExpenses.push({
                    id: uid(), truck: row.truck, date: row.date, cat: 'Allowance', amount: row.turnboy,
                    desc: `Turnboy allowance — ${row.origin} → ${row.dest}`, journey: row.journeyId,
                });
            }
            if (row.roadUsers > 0) {
                newExpenses.push({
                    id: uid(), truck: row.truck, date: row.date, cat: 'Toll', amount: row.roadUsers,
                    desc: `Road users fee — ${row.origin} → ${row.dest}`, journey: row.journeyId,
                });
            }
            if (row.otherExp > 0) {
                newExpenses.push({
                    id: uid(), truck: row.truck, date: row.date, cat: 'Other', amount: row.otherExp,
                    desc: `Other trip expenses — ${row.origin} → ${row.dest}`, journey: row.journeyId,
                });
            }
        });

        setData(d => ({
            ...d,
            journeys: [...d.journeys, ...newJourneys],
            fuel: [...d.fuel, ...newFuel],
            expenses: [...d.expenses, ...newExpenses],
        }));

        setImportSession(s => ({ ...s, committed: true }));

        // Sync to server immediately
        setTimeout(() => syncToServer(), 500);

        // Record history
        if (PAYMENT_API) {
            try {
                const record = {
                    fileName: session.fileName,
                    trips: allTrips.length,
                    expenses: allExpenses.length,
                    maintenance: allMaint.length,
                    totalRows: allTrips.length + allExpenses.length + allMaint.length
                };
                const token = adminAuth.getToken();
                await fetch(`${PAYMENT_API}/api/admin/import-history`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': ADMIN_KEY,
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ record })
                });
                fetchImportHistory();
            } catch (err) {
                console.warn("History recording failed:", err.message);
            }
        }
    };

    // Derived helpers
    const driverName = (id) => (data.drivers || []).find(d => d.id === id)?.name || "—";
    const driverPhone = (id) => (data.drivers || []).find(d => d.id === id)?.phone || '';
    const truckReg = (id) => (data.trucks || []).find(t => t.id === id)?.reg || "—";
    const staffName = (id) => {
        const s = (data.staff || []).find(x => x.id === id) || (data.drivers || []).find(x => x.id === id);
        return s?.name || "—";
    };
    const customerName = (id) => (data.customers || []).find(c => c.id === id)?.name || "—";

    const truckStats = (tid) => {
        const jrns = data.journeys.filter(j => j.truck === tid);
        const rev = jrns.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0);
        const fuelEntries = data.fuel.filter(f => f.truck === tid);
        const fuelCost = fuelEntries.reduce((s, f) => s + f.litres * f.pricePerL, 0);
        const totalLitres = fuelEntries.reduce((s, f) => s + f.litres, 0);
        const totalKm = jrns.filter(j => j.status === "Completed").reduce((s, j) => s + +j.distance, 0);
        const kmPerL = totalLitres > 0 ? totalKm / totalLitres : 0;
        const otherExp = data.expenses.filter(e => e.truck === tid).reduce((s, e) => s + +e.amount, 0);
        const exp = fuelCost + otherExp;
        return { rev, exp, profit: rev - exp, trips: jrns.length, totalKm, totalLitres, fuelCost, kmPerL };
    };

    const maintenanceStatus = useCallback((truck, typeId) => {
        const setting = data.maintenanceSettings.find(s => s.id === typeId);
        if (!setting) return { status: "OK", remaining: 999999 };

        const logs = data.maintenanceLogs.filter(l => l.truck === truck.id && l.type === typeId).sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastLog = logs[0];

        if (setting.unit === "km") {
            const lastOdom = lastLog ? +lastLog.odom : (typeId === "m15" || typeId === "m16" ? +truck.tyreOdom : 0);
            const kmSince = +truck.odom - lastOdom;
            const remaining = +setting.val - kmSince;
            const status = remaining <= 0 ? "Overdue" : remaining <= (+setting.val * 0.15) ? "Due Soon" : "OK";
            return { kmSince, remaining, status, pct: Math.min(100, (kmSince / +setting.val) * 100), unit: "km" };
        } else {
            // Time based
            if (!lastLog) return { status: "OK", remaining: setting.val, unit: setting.unit };
            const lastDate = new Date(lastLog.date);
            const now = new Date();
            const diffMs = now - lastDate;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            let limitDays = 0;
            if (setting.unit === "weeks") limitDays = setting.val * 7;
            else if (setting.unit === "months") limitDays = setting.val * 30.44;
            else if (setting.unit === "years") limitDays = setting.val * 365.25;

            const remaining = limitDays - diffDays;
            const status = remaining <= 0 ? "Overdue" : remaining <= (limitDays * 0.15) ? "Due Soon" : "OK";
            return { daysSince: diffDays, remaining, status, pct: Math.min(100, (diffDays / limitDays) * 100), unit: setting.unit };
        }
    }, [data.maintenanceSettings, data.maintenanceLogs]);

    const logMaintenance = async (truckId, typeId, cost, desc, odom, date) => {
        const log = { id: 'ml' + uid().slice(0, 6), truck: truckId, type: typeId, cost: +cost, desc, odom: +odom, date: date || today() };
        const setting = data.maintenanceSettings.find(s => s.id === typeId);
        const expense = { id: 'e' + uid().slice(0, 6), truck: truckId, cat: "Maintenance", amount: +cost, date: date || today(), desc: `${setting?.name || "Maintenance"}: ${desc}`, journey: "" };

        try {
            // Sync both to backend
            await saveItem("maintenance_logs", log);
            await saveItem("expenses", expense);
            showToast("Maintenance logged and expense added", "success");
        } catch (e) {
            // individual error toasts shown by saveItem
        }
    };

    const tyreStatus = (truck) => maintenanceStatus(truck, "m16"); // Default to tyre replacement setting

    const fillTemplate = useCallback((templateStr, context = {}) => {
        if (!templateStr) return "";
        let result = templateStr;
        const settings = readSettings();
        const co = settings.companyName || "Segecha Group";
        const finalContext = expandMessageTemplateContext({
            company_name: co,
            businessName: co,
            today: today(),
            ...context,
        });

        Object.keys(finalContext).forEach((key) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
            result = result.replace(regex, String(finalContext[key] ?? ""));
        });
        return result;
    }, []);

    return {
        data, setData,
        modal, form, setForm, openModal, closeModal,
        waybillModalJourney, waybillForm, setWaybillForm, openWaybillGenerator, closeWaybillModal,
        filterTruck, setFilterTruck,
        invoicePreview, setInvoicePreview,
        sideOpen, setSideOpen,
        dark, setDark,
        saveItem, delItem, markPayrollPaid, markInvoicePaid, addInvoicePayment, resetData, hardResetSystem,
        updateSettings, resetAccountCredentials, deleteStaffAccount, deleteDriverAccount,
        verifyJourney, fetchPendingVerifications, syncToServer,
        verifySubmission,
        driverName, driverPhone, staffName, truckReg, customerName, truckStats, tyreStatus, maintenanceStatus, logMaintenance,
        toasts, showToast,
        verifyModal, setVerifyModal, pendingVerifications, rejectReason, setRejectReason, rejectedFields, setRejectedFields, verifyLoading, verifyMsg, setVerifyMsg,
        importSession, setImportSession, importHistory, runExcelImport,
        fillTemplate,
        trailerReg: (id) => data.trailers?.find(t => t.id === id)?.reg || id,
        previewMode,
        setPreviewMode,
        clearPreviewMode,

        driverName, driverPhone, staffName, truckReg, customerName, truckStats, tyreStatus, maintenanceStatus, logMaintenance,
        toasts, showToast,
        backups,
        backupsLoading,

        fetchBackups,
        createManualBackup,
        restoreFromBackup,
        downloadBackup,
        uploadBackup,
    };
}
