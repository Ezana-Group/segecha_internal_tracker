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

const cleanEnv = (val) => (val === "undefined" || !val) ? "" : val;

export const PAYMENT_API = cleanEnv(import.meta.env.VITE_API_URL);
export const ADMIN_KEY = cleanEnv(import.meta.env.VITE_ADMIN_KEY);
export const PORTAL_URL = cleanEnv(import.meta.env.VITE_PAYMENT_URL) || "https://payment.segecha.com";

export const TRACK_URL = cleanEnv(import.meta.env.VITE_TRACK_URL) || "https://track.segecha.com";
export const DRIVER_PORTAL_URL = cleanEnv(import.meta.env.VITE_DRIVER_URL) || "https://driver.segecha.com";

export const TYRE_WARNING_KM = Number(cleanEnv(import.meta.env.VITE_TYRE_WARNING_KM)) || 5000;


