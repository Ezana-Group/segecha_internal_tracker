export const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
export const today = () => new Date().toISOString().split('T')[0];

/**
 * Format a date string (ISO timestamp or YYYY-MM-DD) into a human-readable
 * format like "30 Mar 2026". Returns '—' for empty/invalid values.
 */
export const fmtDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        // Strip time part first so we always get the right local date
        const clean = String(dateStr).split('T')[0];
        const [y, mo, d] = clean.split('-').map(Number);
        if (!y || !mo || !d) return String(dateStr);
        const dt = new Date(y, mo - 1, d);
        return dt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return String(dateStr);
    }
};
