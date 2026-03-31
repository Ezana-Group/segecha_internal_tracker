// Segecha Frontend Environment Constants
const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;

    // If we have an absolute URL via env, use it
    if (envUrl && envUrl.startsWith('http')) {
        return envUrl.replace(/\/+$/, '');
    }

    // Default to empty string for relative paths (supports Vite proxy in dev & same-origin in prod)
    return '';
};

export const PAYMENT_API = getApiUrl();
export const PORTAL_URL  = import.meta.env.VITE_PAYMENT_URL;
export const DRIVER_PORTAL_URL = import.meta.env.VITE_DRIVER_URL;
export const TRACK_URL   = import.meta.env.VITE_TRACK_URL;
// ADMIN_KEY intentionally removed from the frontend (CRIT-02).
// All admin API calls must use the JWT Bearer token from /api/admin/login.
