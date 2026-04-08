/**
 * When previewing as driver/staff, the sidebar shows only these destinations.
 * This is an office simulation in the tracker — not the real driver portal (separate URL + login).
 */

import { DRIVER_PORTAL_URL } from "../utils/env.js";
import { readSettings } from "../utils/settingsStore.js";
import { mergeFlatPermissionOverrides, mergeProfilePermissions } from "../utils/profilePermissions.js";

export const PREVIEW_SESSION_KEY = "segecha_preview_mode_v1";

function driverJourneyPreviewPerms(data, driverId) {
    const base = mergeProfilePermissions(readSettings().profilePermissions).driverPreviewJourneys;
    const driver = data?.drivers?.find((d) => d.id === driverId);
    return mergeFlatPermissionOverrides(base, driver?.permissionOverrides?.driverPreviewJourneys);
}

/** @typedef {{ role: 'driver' | 'staff', entityId: string }} PreviewMode */

export function readPreviewFromSession() {
    try {
        const raw = sessionStorage.getItem(PREVIEW_SESSION_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if ((o.role === "driver" || o.role === "staff") && o.entityId && typeof o.entityId === "string") {
            return { role: o.role, entityId: o.entityId };
        }
    } catch {
        /* ignore */
    }
    return null;
}

export function writePreviewToSession(preview) {
    if (!preview) {
        sessionStorage.removeItem(PREVIEW_SESSION_KEY);
        return;
    }
    sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(preview));
}

/**
 * @param {PreviewMode | null} preview
 * @param {{ drivers?: { id: string, permissionOverrides?: Record<string, Record<string, boolean>> }[] }} [data]
 * @returns {{ id: string, path: string, label: string }[]}
 */
export function getPreviewNavItems(preview, data) {
    if (!preview) return [];
    if (preview.role === "driver") {
        const id = preview.entityId;
        const jp = driverJourneyPreviewPerms(data, id);
        const items = [{ id: "driver-overview", path: `/drivers/${id}`, label: "My overview" }];
        if (jp.navMyTrips !== false) {
            items.push({ id: "driver-trips", path: "/journeys", label: "My trips" });
        }
        if (DRIVER_PORTAL_URL) {
            items.push({
                id: "driver-portal-app",
                href: DRIVER_PORTAL_URL,
                external: true,
                label: "Driver app (fuel & trips)",
            });
        }
        return items;
    }
    if (preview.role === "staff") {
        const id = preview.entityId;
        return [{ id: "staff-overview", path: `/staff/${id}`, label: "My profile" }];
    }
    return [];
}

export function isPathAllowedInPreview(preview, pathname, data) {
    if (!preview) return true;
    if (preview.role === "driver") {
        const id = preview.entityId;
        const jp = driverJourneyPreviewPerms(data, id);
        if (pathname === `/drivers/${id}`) return true;
        if (pathname === "/journeys" || pathname.startsWith(`/journeys/`)) {
            return jp.navMyTrips !== false;
        }
        return false;
    }
    if (preview.role === "staff") {
        const id = preview.entityId;
        if (pathname === `/staff/${id}`) return true;
        return false;
    }
    return true;
}

export function defaultPreviewPath(preview) {
    if (!preview) return "/";
    if (preview.role === "driver") return `/drivers/${preview.entityId}`;
    return `/staff/${preview.entityId}`;
}
