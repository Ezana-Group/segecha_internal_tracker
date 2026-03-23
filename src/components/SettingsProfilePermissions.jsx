import React, { useMemo, useState } from "react";
import { Info, Pencil } from "lucide-react";
import { PERMISSION_UI_SECTIONS, mergeProfilePermissions } from "../utils/profilePermissions.js";
import { PermissionSwitchRow } from "./ProfilePermissionsUi.jsx";

const NAMESPACE_TAB_LABEL = {
    staffTracker: "Staff",
    driverTracker: "Driver",
    driverPreviewJourneys: "My trips",
    driverPortal: "Driver app",
};

export function SettingsProfilePermissions({ localProfilePermissions, disabled, onCommit, locked, onRequestUnlock }) {
    const [activeNs, setActiveNs] = useState(PERMISSION_UI_SECTIONS[0]?.namespace || "staffTracker");
    const merged = useMemo(() => mergeProfilePermissions(localProfilePermissions), [localProfilePermissions]);

    const sec = PERMISSION_UI_SECTIONS.find((s) => s.namespace === activeNs) || PERMISSION_UI_SECTIONS[0];

    const setKey = (namespace, key, value) => {
        const nextRoot = mergeProfilePermissions(localProfilePermissions);
        nextRoot[namespace] = { ...nextRoot[namespace], [key]: value };
        onCommit(nextRoot);
    };

    const setAllInGroup = (namespace, keys, value) => {
        const nextRoot = mergeProfilePermissions(localProfilePermissions);
        const patch = { ...nextRoot[namespace] };
        for (const k of keys) patch[k] = value;
        nextRoot[namespace] = patch;
        onCommit(nextRoot);
    };

    const isLocked = locked === true;

    return (
        <div className={`permissions-ui-surface${disabled ? " permissions-ui-surface--locked" : ""}`}>
            <div className="permissions-ui-tabs" role="tablist" aria-label="Permission scope">
                {PERMISSION_UI_SECTIONS.map((s) => (
                    <button
                        key={s.namespace}
                        type="button"
                        role="tab"
                        aria-selected={activeNs === s.namespace}
                        className={activeNs === s.namespace ? "is-active" : ""}
                        onClick={() => setActiveNs(s.namespace)}
                    >
                        {NAMESPACE_TAB_LABEL[s.namespace] || s.title}
                    </button>
                ))}
            </div>

            <div className="permissions-ui-header">
                <div className="permissions-ui-header__titles">
                    <h2>Permissions</h2>
                    <p>Granular access control for each profile surface.</p>
                </div>
                {isLocked && onRequestUnlock && (
                    <button type="button" className="permissions-ui-edit-btn" onClick={onRequestUnlock}>
                        <Pencil size={16} strokeWidth={2.2} aria-hidden />
                        Edit
                    </button>
                )}
            </div>

            <div className="permissions-ui-hint">
                <Info size={18} color="var(--permission-accent)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <p>
                    <strong>Office vs portal.</strong> These limits apply to staff and driver self-views and the driver app. Administrators still see full
                    profiles in the tracker. After changes, use <strong>Push snapshot to API</strong> (Backup &amp; import) so the driver portal picks up
                    updates.
                </p>
            </div>

            {sec && (
                <div key={sec.namespace}>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px", lineHeight: 1.55, maxWidth: 720 }}>{sec.description}</p>

                    {sec.groups.map((g, gi) => {
                        const keys = g.keys.map((r) => r.key);
                        const allOn = keys.every((k) => merged[sec.namespace][k]);
                        const allOff = keys.every((k) => !merged[sec.namespace][k]);
                        const catId = `perm-cat-${sec.namespace}-${gi}`;
                        return (
                            <section key={g.title} className="permission-category" aria-labelledby={catId}>
                                <div className="permission-category__head">
                                    <h3 className="permission-category__title" id={catId}>
                                        {g.title}
                                    </h3>
                                    <div className="permission-category__bulk">
                                        <button type="button" disabled={disabled || allOn} onClick={() => setAllInGroup(sec.namespace, keys, true)}>
                                            All on
                                        </button>
                                        <button type="button" disabled={disabled || allOff} onClick={() => setAllInGroup(sec.namespace, keys, false)}>
                                            All off
                                        </button>
                                    </div>
                                </div>
                                <div className="permission-category__list">
                                    {g.keys.map((row) => (
                                        <PermissionSwitchRow
                                            key={row.key}
                                            rowKey={`${sec.namespace}-${row.key}`}
                                            label={row.label}
                                            checked={!!merged[sec.namespace][row.key]}
                                            disabled={disabled}
                                            onChange={(v) => setKey(sec.namespace, row.key, v)}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
