import React from "react";
import { Button } from "./Button";
import {
    permissionUiSectionForNamespace,
    mergeFlatPermissionOverrides,
    applyPermissionOverrideDelta,
} from "../utils/profilePermissions.js";
import { PermissionSwitchRow } from "./ProfilePermissionsUi.jsx";

/**
 * Per-entity overrides on top of Settings → Profile permissions (workspace defaults).
 */
export function ProfilePermissionOverridesPanel({ namespace, mergedGlobalFlat, delta, onDeltaChange, disabled, showTopDivider }) {
    const section = permissionUiSectionForNamespace(namespace);
    if (!section) return null;

    const effective = mergeFlatPermissionOverrides(mergedGlobalFlat, delta);
    const deltaKeys = delta && typeof delta === "object" ? Object.keys(delta).length : 0;

    const setKey = (key, value) => {
        onDeltaChange(applyPermissionOverrideDelta(mergedGlobalFlat, delta, key, value));
    };

    return (
        <div
            className={showTopDivider ? "permission-overrides-block permission-overrides-block--divider" : "permission-overrides-block"}
        >
            <div className="permissions-ui-header" style={{ marginBottom: 20 }}>
                <div className="permissions-ui-header__titles">
                    <h2 style={{ fontSize: 18 }}>{section.title}</h2>
                    <p>
                        {section.description} Office defaults come from Settings → Profile permissions. Only toggles you change here override those defaults
                        for this person.
                    </p>
                </div>
            </div>
            {deltaKeys > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onDeltaChange({})}>
                        Clear overrides (use office defaults)
                    </Button>
                </div>
            )}
            {section.groups.map((g) => (
                <section key={g.title} className="permission-category">
                    <div className="permission-category__head">
                        <h3 className="permission-category__title">{g.title}</h3>
                    </div>
                    <div className="permission-category__list">
                        {g.keys.map((row) => (
                            <PermissionSwitchRow
                                key={row.key}
                                rowKey={`${namespace}-${row.key}`}
                                label={row.label}
                                checked={effective[row.key] !== false}
                                disabled={disabled}
                                onChange={(v) => setKey(row.key, v)}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
