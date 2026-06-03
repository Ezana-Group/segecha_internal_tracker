// Segecha Frontend Environment Constants
const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;

    // If we have an absolute URL via env, use it
    if (envUrl && envUrl.startsWith('http')) {
        return envUrl.replace(/\/+$/, '');
    }

    // Fall back to the current origin so PAYMENT_API is always truthy.
    // This ensures same-origin API calls work in the Electron desktop app and
    // any deployment where VITE_API_URL is not explicitly set at build time.
    // (window.location.origin is safe here — this file is browser-only)
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin;
    }

    return '';
};

export const PAYMENT_API = getApiUrl();
export const PORTAL_URL  = import.meta.env.VITE_PAYMENT_URL;
export const DRIVER_PORTAL_URL = import.meta.env.VITE_DRIVER_URL;
export const TRACK_URL   = import.meta.env.VITE_TRACK_URL;
// ADMIN_KEY intentionally removed from the frontend (CRIT-02).
// All admin API calls must use the JWT Bearer token from /api/admin/login.
