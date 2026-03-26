// Segecha Frontend Environment Constants
const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    // If we have a specific non-localhost URL, use it
    if (envUrl && !envUrl.includes('localhost:3001')) return envUrl;
    // In production, default to current origin for same-domain API calls
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        return window.location.origin;
    }
    // Local development fallback
    return envUrl || 'http://localhost:3001';
};

export const PAYMENT_API = getApiUrl();
export const PORTAL_URL  = import.meta.env.VITE_PAYMENT_URL || 'https://payment.segecha.com';
export const DRIVER_PORTAL_URL = import.meta.env.VITE_DRIVER_URL || 'https://driver.segecha.com';
export const TRACK_URL   = import.meta.env.VITE_TRACK_URL || 'https://track.segecha.com';
export const ADMIN_KEY   = import.meta.env.VITE_ADMIN_KEY || 'segecha-admin-key-change-this';
