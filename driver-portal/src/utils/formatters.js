export const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
export const today = () => new Date().toISOString().split('T')[0];
export const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${date.getFullYear()}`;
    } catch (e) { return String(d); }
};
