import React, { useState, useEffect } from 'react';
import { COLORS, S } from '../../constants/theme';
import { API_URL as API } from '../../utils/api';

export const ProfileTab = ({ driver, truck, portalPerm, token, fetchDriverData, apiPost, setTab }) => {
    const [phone, setPhone] = useState(driver.phone || '');
    const [license, setLicense] = useState(driver.license || '');
    const [msg, setMsg] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetBusy, setResetBusy] = useState(false);
    const licClass = Array.isArray(driver.class) && driver.class.length ? driver.class.join(', ') : driver.class || '—';

    useEffect(() => {
        setPhone(driver.phone || '');
        setLicense(driver.license || '');
    }, [driver.phone, driver.license]);

    const save = async () => {
        setSaving(true);
        setMsg('');
        const r = await apiPost('/api/driver/profile', { phone: phone.trim(), license: license.trim() });
        if (r.success) {
            setMsg('✅ Saved');
            await fetchDriverData(token);
        } else {
            setMsg('❌ ' + (r.error || 'Could not save'));
        }
        setSaving(false);
    };

    const requestPasswordReset = async () => {
        const accountId = driver.email || driver.phone;
        if (!accountId) {
            window.alert('No phone/email on file. Contact the office to reset your password.');
            return;
        }
        setResetBusy(true);
        try {
            const res = await fetch(`${API}/api/driver/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: accountId }),
            });
            const data = await res.json();
            window.alert(data.message || (res.ok ? 'Check your email for a reset link.' : 'Could not send reset email.'));
        } catch {
            window.alert('Could not connect. Try again later.');
        }
        setResetBusy(false);
    };

    const profileRow = (label, value, bold) => (
        <div style={{ ...S.infoRow, borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 12, color: COLORS.textFaint, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: bold ? 800 : 600, color: COLORS.text, textAlign: 'right', maxWidth: '62%' }}>{value}</span>
        </div>
    );

    return (
        <div style={S.content}>
            {portalPerm.profileIdentityCard !== false && (
                <div style={{ ...S.card(), padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${COLORS.border}` }}>
                        <div style={{ fontWeight: 800, fontSize: 17, color: COLORS.text }}>My Profile</div>
                    </div>
                    <div style={{ padding: '4px 16px 16px' }}>
                        {portalPerm.profileFieldName !== false && profileRow('Name', driver.name, true)}
                        {portalPerm.profileFieldPhone !== false && profileRow('Phone', phone || '—')}
                        {portalPerm.profileFieldLicense !== false && profileRow('Licence number', license || '—')}
                        {portalPerm.profileFieldLicenceClass !== false && profileRow('Licence class', licClass)}
                        {portalPerm.profileFieldTruck !== false && profileRow('Assigned truck', truck?.reg || '—', true)}
                        {portalPerm.profileFieldStatus !== false && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                                <span style={{ fontSize: 12, color: COLORS.textFaint, fontWeight: 600 }}>Status</span>
                                <span
                                    style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: (driver.status === 'Active' ? '#10b981' : COLORS.textFaint) + '22',
                                        color: driver.status === 'Active' ? '#059669' : COLORS.textDim,
                                        border: `1px solid ${driver.status === 'Active' ? '#10b981' : COLORS.textFaint}44`,
                                    }}
                                >
                                    {driver.status || '—'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(portalPerm.profileEditPhone !== false || portalPerm.profileEditLicense !== false || portalPerm.profileSaveButton !== false || portalPerm.profileOfficeNote !== false) && (
                <div style={{ ...S.card() }}>
                    {portalPerm.profileOfficeNote !== false && <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12, lineHeight: 1.45 }}>Update your phone and licence number. Name, email, truck, and pay are set by the office.</div>}
                    {portalPerm.profileEditPhone !== false && (
                        <>
                            <label style={S.lbl}>Phone</label>
                            <input style={S.inp} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </>
                    )}
                    {portalPerm.profileEditLicense !== false && (
                        <>
                            <label style={S.lbl}>Licence number</label>
                            <input style={S.inp} value={license} onChange={(e) => setLicense(e.target.value)} />
                        </>
                    )}
                    {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}
                    {portalPerm.profileSaveButton !== false && (
                        <button type="button" style={{ ...S.btn(), width: '100%', borderRadius: 12, minHeight: 48 }} onClick={save} disabled={saving}>
                            {saving ? '⏳ Saving…' : 'Save changes'}
                        </button>
                    )}
                </div>
            )}

            <div style={{ ...S.sectionTitle, marginTop: 8 }}>More</div>
            {portalPerm.profileLinkDocs !== false && (
                <button type="button" style={{ ...S.btn('ghost'), width: '100%', marginBottom: 10, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setTab('docs')}>
                    📁 Documents
                </button>
            )}
            {portalPerm.profileLinkMaintenance !== false && (
                <button type="button" style={{ ...S.btn('ghost'), width: '100%', marginBottom: 10, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setTab('maintenance')}>
                    🔧 Maintenance log
                </button>
            )}
            {portalPerm.profileLinkPayslips !== false && (
                <button type="button" style={{ ...S.btn('ghost'), width: '100%', marginBottom: 10, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setTab('payslips')}>
                    💳 Payment status
                </button>
            )}

            {portalPerm.profilePasswordReset !== false && (
                <button
                    type="button"
                    disabled={resetBusy}
                    style={{
                        width: '100%',
                        minHeight: 48,
                        marginTop: 8,
                        borderRadius: 12,
                        border: `2px solid ${COLORS.accent}`,
                        background: '#fff',
                        color: COLORS.accent,
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: resetBusy ? 'wait' : 'pointer',
                    }}
                    onClick={requestPasswordReset}
                >
                    {resetBusy ? '⏳ Sending…' : 'Reset password'}
                </button>
            )}
            {portalPerm.profileSignOut !== false && (
                <button
                    type="button"
                    style={{
                        width: '100%',
                        minHeight: 48,
                        marginTop: 10,
                        borderRadius: 12,
                        border: `2px solid ${COLORS.red}`,
                        background: '#fff',
                        color: COLORS.red,
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        if (window.confirm('Are you sure you want to log out?')) {
                            localStorage.removeItem('portalToken');
                            window.location.reload();
                        }
                    }}
                >
                    Log out
                </button>
            )}
        </div>
    );
};
