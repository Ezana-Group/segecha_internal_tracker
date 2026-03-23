import React, { useId } from "react";

/** Warm accent for permission toggles & tabs (matches reference UI). */
export const PERM_UI_ACCENT = "var(--permission-accent, #ea580c)";

/**
 * Accessible pill switch: label on the left, toggle on the right.
 */
export function PermissionSwitchRow({ label, checked, disabled, onChange, rowKey }) {
    const reactId = useId();
    const switchId = rowKey ? `perm-row-${rowKey}` : reactId;
    return (
        <div className="permission-switch-row">
            <label htmlFor={switchId} className="permission-switch-row__label">
                {label}
            </label>
            <PermissionPillSwitch id={switchId} checked={checked} disabled={disabled} onChange={onChange} />
        </div>
    );
}

/**
 * Standalone pill toggle (iOS-style).
 */
export function PermissionPillSwitch({ id, checked, disabled, onChange, ariaLabel }) {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            className={`permission-pill-switch${checked ? " is-on" : ""}`}
            onClick={() => !disabled && onChange(!checked)}
        >
            <span className="permission-pill-switch__track" aria-hidden>
                <span className="permission-pill-switch__thumb" />
            </span>
        </button>
    );
}
