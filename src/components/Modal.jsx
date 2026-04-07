import React, { useEffect } from "react";

/**
 * Drawer — slides in from the right edge instead of a centered dialog.
 * Props:
 *   title       — header title string
 *   subtitle    — optional small subtitle under the title
 *   onSave      — save button handler
 *   closeModal  — close / backdrop click handler
 *   children    — body content
 *   wide        — if true, wider panel (680px vs 540px)
 *   S           — style system object (S.ovl, S.btn)
 *   saveDisabled — disable save button
 *   saveLabel    — save button text (default "Save")
 *   tabs        — optional array [{ id, label }]
 *   activeTab   — active tab id
 *   onTabChange — (id) => void
 *   footer      — optional extra footer content (placed left of actions)
 */
export function Modal({
    title, subtitle, onSave, children, wide, S, closeModal,
    saveDisabled, saveLabel = "Save",
    tabs, activeTab, onTabChange,
    footer,
}) {
    // Lock body scroll while drawer is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handler = (e) => { if (e.key === "Escape") closeModal(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [closeModal]);

    const panelWidth = wide ? "min(700px, 96vw)" : "min(540px, 96vw)";

    return (
        <>
            {/* Dim overlay — clicking closes */}
            <div
                className="drawer-overlay"
                onClick={closeModal}
                aria-hidden="true"
            />

            {/* Sliding panel */}
            <div
                className="drawer-panel"
                style={{ width: panelWidth }}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header */}
                <div className="drawer-header">
                    <div className="drawer-header-left">
                        <h2 className="drawer-title">{title}</h2>
                        {subtitle && <p className="drawer-subtitle">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        className="drawer-close"
                        onClick={closeModal}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Tabs (optional) */}
                {tabs && tabs.length > 0 && (
                    <div className="drawer-tabs" role="tablist">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                className={`drawer-tab${activeTab === tab.id ? " is-active" : ""}`}
                                onClick={() => onTabChange?.(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Scrollable body */}
                <div className="drawer-body">
                    {children}
                </div>

                {/* ── Footer actions */}
                <div className="drawer-footer">
                    {footer && <div className="drawer-footer-extra">{footer}</div>}
                    <div className="drawer-footer-actions">
                        <button
                            type="button"
                            className="drawer-btn-cancel"
                            onClick={closeModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="drawer-btn-save"
                            onClick={onSave}
                            disabled={saveDisabled}
                            style={{ opacity: saveDisabled ? 0.5 : 1 }}
                        >
                            {saveLabel}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
