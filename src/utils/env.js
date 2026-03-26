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
export const PORTAL_URL  = import.meta.env.VITE_PAYMENT_URL || 'https://payment.segecha.com';
export const DRIVER_PORTAL_URL = import.meta.env.VITE_DRIVER_URL || 'https://driver.segecha.com';
export const TRACK_URL   = import.meta.env.VITE_TRACK_URL || 'https://track.segecha.com';
export const ADMIN_KEY   = import.meta.env.VITE_ADMIN_KEY || 'segecha-admin-key-change-this';
