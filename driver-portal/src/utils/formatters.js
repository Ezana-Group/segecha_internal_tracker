export const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
export const today = () => new Date().toISOString().split('T')[0];
