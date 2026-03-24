/**
 * Profile visibility for (1) staff/driver preview in the tracker, (2) driver “My trips” preview,
 * (3) the driver mobile portal. Stored under `segecha_settings.profilePermissions` and synced to
 * `tracker-data.json` via Push snapshot for the portal.
 */
import { useEffect, useMemo, useState } from "react";
import { readSettings, subscribeSettings } from "./settingsStore.js";

function deepMergeBools(defaults, stored) {
    if (!stored || typeof stored !== "object") return { ...defaults };
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) {
        if (typeof defaults[k] === "boolean") {
            if (typeof stored[k] === "boolean") out[k] = stored[k];
        } else if (defaults[k] && typeof defaults[k] === "object" && !Array.isArray(defaults[k])) {
            out[k] = deepMergeBools(defaults[k], stored[k]);
        }
    }
    return out;
}

function buildDefaultsFromUi(sections) {
    const root = {};
    for (const sec of sections) {
        root[sec.namespace] = {};
        for (const g of sec.groups) {
            for (const row of g.keys) {
                root[sec.namespace][row.key] = row.default !== false;
            }
        }
    }
    return root;
}

/** Declarative list for defaults + Settings UI. */
export const PERMISSION_UI_SECTIONS = [
    {
        namespace: "staffTracker",
        title: "Staff · tracker preview (“My profile”)",
        description:
            "When someone uses Preview as staff in the user menu, these controls apply to their profile page only. Full admin view is unchanged.",
        groups: [
            {
                title: "Profile tabs",
                keys: [
                    { key: "tabOverview", label: "Profile Overview tab" },
                    { key: "tabAccessSettings", label: "Access & Settings tab" },
                    { key: "tabDocuments", label: "Documents tab" },
                    { key: "tabPayHistory", label: "Pay History tab" },
                ],
            },
            {
                title: "Header & actions",
                keys: [
                    { key: "headerSendMessage", label: "Send message (SMS / email / WhatsApp)" },
                    { key: "headerTemplates", label: "Message templates button" },
                    { key: "headerEditProfile", label: "Edit profile button" },
                ],
            },
            {
                title: "Overview · personnel block",
                keys: [
                    { key: "overviewSectionPersonnel", label: "Personnel details section" },
                    { key: "overviewFieldName", label: "Show full legal name" },
                    { key: "overviewFieldRole", label: "Show role & department" },
                    { key: "overviewFieldPhone", label: "Show phone" },
                    { key: "overviewFieldEmail", label: "Show email" },
                    { key: "overviewFieldStatus", label: "Show personnel status" },
                    { key: "overviewFieldSalary", label: "Show base monthly salary" },
                ],
            },
            {
                title: "Overview · quick actions",
                keys: [
                    { key: "overviewSectionQuickActions", label: "Quick actions column" },
                    { key: "overviewQuickCall", label: "Call employee tile" },
                    { key: "overviewQuickMessage", label: "Send message tile" },
                    { key: "overviewQuickDocuments", label: "View personnel files tile" },
                    { key: "overviewQuickPay", label: "View pay history tile" },
                ],
            },
            {
                title: "Access & settings tab",
                keys: [
                    { key: "accessPasswordReset", label: "Force password reset" },
                    { key: "accessShowPendingOtp", label: "Show pending OTP / first-login notice" },
                    { key: "accessRoleBlurb", label: "Role & permissions explanation" },
                    { key: "accessEditCoreProfile", label: "Edit core profile button" },
                ],
            },
            {
                title: "Documents tab",
                keys: [
                    { key: "documentsUpload", label: "Upload new documents" },
                    { key: "documentsViewList", label: "See document list" },
                    { key: "documentsOpen", label: "Open / view files" },
                    { key: "documentsDelete", label: "Delete documents" },
                ],
            },
            {
                title: "Pay history tab",
                keys: [
                    { key: "payBaseCompensationCard", label: "Base compensation summary card" },
                    { key: "payPayrollTable", label: "Payroll allocations table" },
                    { key: "payDownloadPayslips", label: "Download payslips row (button)" },
                ],
            },
        ],
    },
    {
        namespace: "driverTracker",
        title: "Driver · tracker preview (office simulates driver)",
        description: "Applies when Preview as driver is on and the driver opens their profile in the main tracker.",
        groups: [
            {
                title: "Profile tabs",
                keys: [
                    { key: "tabOverview", label: "Overview tab" },
                    { key: "tabJourneys", label: "Journeys tab" },
                    { key: "tabPerformance", label: "Performance tab" },
                    { key: "tabDocuments", label: "Documents tab" },
                    { key: "tabFinancials", label: "Financials tab" },
                ],
            },
            {
                title: "Header",
                keys: [
                    { key: "headerSendMessage", label: "Send message menu" },
                    { key: "headerEditProfile", label: "Edit profile button" },
                    { key: "headerDriverPortalBanner", label: "“Open driver app” notice" },
                ],
            },
            {
                title: "Overview · KPI strip",
                keys: [
                    { key: "kpiRevenue", label: "Total revenue tile" },
                    { key: "kpiDistance", label: "Total distance tile" },
                    { key: "kpiEfficiency", label: "Efficiency (km/L) tile" },
                    { key: "kpiSafety", label: "Safety score tile" },
                ],
            },
            {
                title: "Overview · personnel",
                keys: [
                    { key: "overviewSectionPersonnel", label: "Personnel details section" },
                    { key: "overviewFieldName", label: "Full legal name" },
                    { key: "overviewFieldPhone", label: "Phone" },
                    { key: "overviewFieldMpesa", label: "M-Pesa registry" },
                    { key: "overviewFieldEmail", label: "Email" },
                    { key: "overviewFieldLicense", label: "Licence number" },
                    { key: "overviewFieldLicenceClasses", label: "Licence classes" },
                    { key: "overviewFieldStatus", label: "Personnel status" },
                    { key: "overviewFieldVehicle", label: "Current vehicle" },
                    { key: "overviewFieldTrailer", label: "Assigned trailer" },
                    { key: "overviewFieldVehicleLock", label: "Vehicle assignment locked" },
                    { key: "overviewFieldTurnboy", label: "Turnboy (active trips)" },
                ],
            },
            {
                title: "Overview · communication tiles",
                keys: [
                    { key: "commSection", label: "Communication section" },
                    { key: "commCall", label: "Call operator" },
                    { key: "commEmail", label: "Send dispatch email" },
                    { key: "commPayroll", label: "Payroll & compensation shortcut" },
                    { key: "commDocuments", label: "Personnel files shortcut" },
                ],
            },
            {
                title: "Journeys tab",
                keys: [
                    { key: "journeysHeader", label: "Mission history header & description" },
                    { key: "journeysLogNewMission", label: "Log new mission button" },
                    { key: "journeysTable", label: "Journey table" },
                    { key: "journeysOpenVehicle", label: "Click vehicle reg → fleet profile" },
                    { key: "journeysOpenJourney", label: "Row actions → view mission" },
                ],
            },
            {
                title: "Performance tab",
                keys: [{ key: "performanceFuelTable", label: "Fuel / efficiency table" }],
            },
            {
                title: "Documents tab",
                keys: [
                    { key: "documentsUpload", label: "Upload documents" },
                    { key: "documentsViewList", label: "Document list" },
                    { key: "documentsOpen", label: "Open files" },
                    { key: "documentsDelete", label: "Delete documents" },
                ],
            },
            {
                title: "Financials tab",
                keys: [
                    { key: "finGrossRevenueCard", label: "Gross value generated card" },
                    { key: "finBaseSalaryCard", label: "Base compensation card" },
                    { key: "finMissionLedger", label: "Mission performance ledger table" },
                ],
            },
        ],
    },
    {
        namespace: "driverPreviewJourneys",
        title: "Driver · “My trips” in tracker preview",
        description: "The journey list when previewing as a driver (sidebar → My trips).",
        groups: [
            {
                title: "Navigation & page",
                keys: [
                    { key: "navMyTrips", label: "Show “My trips” in preview sidebar" },
                    { key: "pageDescription", label: "Subtitle under page title" },
                    { key: "statsRow", label: "Stats cards (missions, ongoing, completed, km)" },
                ],
            },
            {
                title: "Table columns",
                keys: [
                    { key: "colMissionId", label: "Mission ID" },
                    { key: "colDate", label: "Departure date" },
                    { key: "colRoute", label: "Route (origin → dest)" },
                    { key: "colClient", label: "Client (billing)" },
                    { key: "colVehicle", label: "Vehicle" },
                    { key: "colCrew", label: "Crew (driver column)" },
                    { key: "colCargo", label: "Cargo" },
                    { key: "colDistance", label: "Distance" },
                    { key: "colNotes", label: "Notes" },
                    { key: "colRevenue", label: "Revenue" },
                    { key: "colAllowanceSubline", label: "Mileage allowance subline under revenue" },
                    { key: "colStatus", label: "Status" },
                ],
            },
            {
                title: "Row actions",
                keys: [
                    { key: "actionWaybill", label: "Waybill action" },
                    { key: "actionViewJourney", label: "View journey" },
                ],
            },
        ],
    },
    {
        namespace: "driverPortal",
        title: "Driver portal (mobile app)",
        description:
            "Live app at the driver URL. After changing toggles, use Settings → Data → Push snapshot to API so drivers receive updates.",
        groups: [
            {
                title: "Bottom navigation",
                keys: [
                    { key: "navTrips", label: "My Trips tab" },
                    { key: "navFuel", label: "Fuel Log tab" },
                    { key: "navCosts", label: "Expenses tab" },
                    { key: "navProfile", label: "Profile tab" },
                ],
            },
            {
                title: "Profile screen",
                keys: [
                    { key: "profileIdentityCard", label: "Identity card (name, phone, licence, class, truck, status)" },
                    { key: "profileFieldName", label: "Show name" },
                    { key: "profileFieldPhone", label: "Show phone" },
                    { key: "profileFieldLicense", label: "Show licence number" },
                    { key: "profileFieldLicenceClass", label: "Show licence class" },
                    { key: "profileFieldTruck", label: "Show assigned truck" },
                    { key: "profileFieldStatus", label: "Show status badge" },
                    { key: "profileEditPhone", label: "Edit phone field" },
                    { key: "profileEditLicense", label: "Edit licence number field" },
                    { key: "profileSaveButton", label: "Save profile changes" },
                    { key: "profileOfficeNote", label: "Office note under editor" },
                    { key: "profileLinkDocs", label: "Link to Documents" },
                    { key: "profileLinkMaintenance", label: "Link to Maintenance log" },
                    { key: "profileLinkPayslips", label: "Link to Payment status" },
                    { key: "profilePasswordReset", label: "Reset password" },
                    { key: "profileSignOut", label: "Sign out" },
                ],
            },
            {
                title: "My Trips tab",
                keys: [
                    { key: "tripsGreeting", label: "Greeting header" },
                    { key: "tripsKpiRow", label: "KPI row (total trips, month allowance, pending)" },
                    { key: "tripsMonthExplainer", label: "Month allowance explainer text" },
                    { key: "tripsOpenTripBanner", label: "Open trip warning banner" },
                    { key: "tripsStartNewTrip", label: "Start new trip (WhatsApp) button" },
                    { key: "tripsTruckTyreStrip", label: "Truck & tyre status strip" },
                    { key: "tripsSectionActive", label: "Active journeys section" },
                    { key: "tripsSectionCompleted", label: "Completed journeys section" },
                    { key: "tripsEmptyState", label: "No trips empty state" },
                    { key: "tripCardSummary", label: "Trip card summary (route, status, date, cargo)" },
                    { key: "tripCardMileageLine", label: "Mileage allowance on card" },
                    { key: "tripCardTruckReg", label: "Truck reg on card" },
                    { key: "tripExpandDetails", label: "Expand trip for details & actions" },
                    { key: "tripDetailAllowanceNote", label: "Expanded: allowance disclaimer" },
                    { key: "tripDetailDistance", label: "Expanded: distance row" },
                    { key: "tripDetailNotes", label: "Expanded: notes row" },
                    { key: "tripDetailTrailer", label: "Expanded: trailer row" },
                    { key: "tripDetailTurnboy", label: "Expanded: crew / turnboy row" },
                    { key: "tripDetailCustomers", label: "Expanded: billing / delivery customer rows" },
                    { key: "tripDetailOdomRecorded", label: "Expanded: recorded start/end odometer" },
                    { key: "tripWaybillButton", label: "View / print waybill" },
                    { key: "tripWhatsappCrew", label: "Request crew assist (WhatsApp)" },
                    { key: "tripCustomersBeforeDepart", label: "Customer capture before In Transit" },
                    { key: "tripStartOdomPhotos", label: "Start odometer + photo workflow" },
                    { key: "tripMarkInTransit", label: "Mark In Transit" },
                    { key: "tripRejectionNotice", label: "Rejected verification notice" },
                    { key: "tripEndOdomAndProof", label: "End odometer, photos, delivery proof" },
                    { key: "tripSubmitVerification", label: "Submit for office verification" },
                    { key: "tripAwaitingBanner", label: "Awaiting verification banner" },
                ],
            },
            {
                title: "Fuel Log tab",
                keys: [
                    { key: "fuelIntro", label: "Intro text" },
                    { key: "fuelForm", label: "Whole fuel form" },
                    { key: "fuelPhotos", label: "Required photo uploads" },
                    { key: "fuelJourneyLink", label: "Link trip dropdown" },
                    { key: "fuelVerification", label: "Office verification required", default: true },
                    { key: "fuelSubmit", label: "Submit fuel claim" },
                ],
            },
            {
                title: "Expenses tab",
                keys: [
                    { key: "costsIntro", label: "Intro text" },
                    { key: "costsToggle", label: "Expense vs incident switcher" },
                    { key: "costsExpenseForm", label: "Expense fields & receipt photo" },
                    { key: "costsMaintenanceSubCategory", label: "Maintenance sub-category selection", default: true },
                    { key: "costsIncidentForm", label: "Incident report form" },
                    { key: "costsJourneyLink", label: "Link to current trip (expense)" },
                    { key: "expenseVerification", label: "Office verification required", default: true },
                    { key: "costsSubmit", label: "Submit button" },
                ],
            },
            {
                title: "Documents tab",
                keys: [
                    { key: "docsUploadSection", label: "Upload new document" },
                    { key: "docsList", label: "Uploaded files list" },
                    { key: "docsViewFile", label: "View file button" },
                ],
            },
            {
                title: "Maintenance tab",
                keys: [
                    { key: "maintLogForm", label: "Log new maintenance form" },
                    { key: "maintHistory", label: "Maintenance history list" },
                    { key: "maintJourneyLink", label: "Optional journey link on form" },
                ],
            },
            {
                title: "Payments tab",
                keys: [
                    { key: "payslipsIntro", label: "Intro text" },
                    { key: "payslipsList", label: "Monthly status cards" },
                    { key: "payslipsPaidDate", label: "Paid date line" },
                    { key: "payslipsMpesaRef", label: "M-Pesa reference line" },
                ],
            },
        ],
    },
];

export const DEFAULT_PROFILE_PERMISSIONS = buildDefaultsFromUi(PERMISSION_UI_SECTIONS);

export function mergeNamespace(namespace, storedRoot) {
    const defaults = DEFAULT_PROFILE_PERMISSIONS[namespace] || {};
    const stored = storedRoot?.[namespace];
    return deepMergeBools(defaults, stored);
}

/** Full merged permission object (all namespaces). */
export function mergeProfilePermissions(storedRoot) {
    return {
        staffTracker: mergeNamespace("staffTracker", storedRoot),
        driverTracker: mergeNamespace("driverTracker", storedRoot),
        driverPreviewJourneys: mergeNamespace("driverPreviewJourneys", storedRoot),
        driverPortal: mergeNamespace("driverPortal", storedRoot),
    };
}

export function useMergedProfilePermissions() {
    const [rev, setRev] = useState(0);
    useEffect(() => subscribeSettings(() => setRev((r) => r + 1)), []);
    return useMemo(() => mergeProfilePermissions(readSettings().profilePermissions), [rev]);
}

/**
 * Merge workspace-wide permissions with per-staff / per-driver delta overrides.
 * `delta` only stores keys that differ from global; omitted keys inherit `globalFlat`.
 */
export function mergeFlatPermissionOverrides(globalFlat, delta) {
    if (!globalFlat || typeof globalFlat !== "object") return {};
    const out = { ...globalFlat };
    if (!delta || typeof delta !== "object") return out;
    for (const k of Object.keys(out)) {
        if (typeof delta[k] === "boolean") out[k] = delta[k];
    }
    return out;
}

/** Toggle one key: remove from delta when it matches global (inherit office default). */
export function applyPermissionOverrideDelta(globalFlat, currentDelta, key, value) {
    const g = globalFlat[key];
    const next = { ...(currentDelta || {}) };
    if (typeof value !== "boolean") return next;
    if (value === g) delete next[key];
    else next[key] = value;
    return next;
}

export function permissionUiSectionForNamespace(namespace) {
    return PERMISSION_UI_SECTIONS.find((s) => s.namespace === namespace) || null;
}

/** Immutable update: set/clear `entity.permissionOverrides[namespaceKey]` from checkbox deltas. */
export function patchPermissionOverridesOnEntity(entity, namespaceKey, newDelta) {
    const po = { ...(entity.permissionOverrides || {}) };
    if (!newDelta || Object.keys(newDelta).length === 0) {
        delete po[namespaceKey];
    } else {
        po[namespaceKey] = newDelta;
    }
    if (Object.keys(po).length === 0) {
        const { permissionOverrides: _, ...rest } = entity;
        return rest;
    }
    return { ...entity, permissionOverrides: po };
}
