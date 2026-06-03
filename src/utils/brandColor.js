/**
 * Brand colour helpers — keeps ALL derived CSS tokens in sync when the
 * accent colour changes (e.g. from the Settings → Brand & Email panel).
 *
 * Usage:
 *   import { applyBrandColor } from '../utils/brandColor';
 *   applyBrandColor('#10b981');   // updates every --brand-* token
 */

/** Lighten a hex colour by a fixed RGB amount (0–255). */
function lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Darken a hex colour by a fixed RGB amount (0–255). */
function darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Apply a brand accent colour to the document root, updating every
 * derived CSS custom property so the entire UI reflects the new colour.
 *
 * @param {string} hex  — e.g. '#10b981'
 */
export function applyBrandColor(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const lighter = lighten(hex, 20);
    const hover   = darken(hex, 18);

    const root = document.documentElement.style;
    root.setProperty('--brand-primary',       hex);
    root.setProperty('--brand-primary-hover', hover);
    root.setProperty('--brand-muted',         `rgba(${r},${g},${b},0.10)`);
    root.setProperty('--brand-border',        `rgba(${r},${g},${b},0.28)`);
    root.setProperty('--brand-gradient',      `linear-gradient(135deg, ${hex} 0%, ${lighter} 100%)`);
    root.setProperty('--brand-focus-ring',    `rgba(${r},${g},${b},0.22)`);
    root.setProperty('--brand-soft-strong',   `rgba(${r},${g},${b},0.35)`);
    root.setProperty('--permission-accent',        hex);
    root.setProperty('--permission-accent-hover',  hover);
}
