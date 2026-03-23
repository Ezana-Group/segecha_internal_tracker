import { Eye, X } from "lucide-react";

/**
 * Shown below the topbar when previewing as driver/staff (office UI simulation — not the real driver/staff login app).
 */
export function PreviewModeBanner({ previewMode, label, onExit, driverPortalUrl, className = "" }) {
    if (!previewMode || !label) return null;
    const roleLabel = previewMode.role === "driver" ? "Driver preview (office)" : "Staff preview";
    const driverHint =
        previewMode.role === "driver"
            ? " This screen mirrors a driver profile for staff only. Fuel logs, expenses, photos, and waybill live in the separate Driver app — not here."
            : " Limited navigation; local data is unchanged.";
    return (
        <div className={`preview-mode-banner${className ? ` ${className}` : ""}`} role="status">
            <Eye size={16} strokeWidth={2} aria-hidden />
            <span className="preview-mode-banner__text">
                <strong>{roleLabel}</strong>
                <span className="preview-mode-banner__sep">·</span>
                {label}
                <span className="preview-mode-banner__hint">{driverHint}</span>
            </span>
            {previewMode.role === "driver" && driverPortalUrl ? (
                <a
                    className="preview-mode-banner__portal"
                    href={driverPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Open driver app
                </a>
            ) : null}
            <button type="button" className="preview-mode-banner__exit" onClick={onExit}>
                <X size={16} strokeWidth={2} aria-hidden />
                Exit preview
            </button>
        </div>
    );
}
