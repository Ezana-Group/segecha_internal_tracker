// Segecha Frontend Environment Constants
const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;

    // If the value is missing or the literal string "undefined" (common build artifact error)
    if (!envUrl || envUrl === "undefined") {
        return '';
    }
    
    // If we have an absolute URL via env, use it
    if (envUrl.startsWith('http')) {
        return envUrl.replace(/\/+$/, '');
    }

    // Default to empty string for relative paths
    return '';
};

export const PAYMENT_API = getApiUrl();
export const PORTAL_URL  = import.meta.env.VITE_PAYMENT_URL;
export const DRIVER_PORTAL_URL = import.meta.env.VITE_DRIVER_URL;
export const TRACK_URL   = import.meta.env.VITE_TRACK_URL;
export const ADMIN_KEY   = import.meta.env.VITE_ADMIN_KEY;
