import React, { useState } from 'react';
import { COLORS, S } from '../constants/theme';
import { API_URL as API } from '../utils/api';

export const SetPasswordPage = ({ resetToken, setToken, setView }) => {
    const [pw, setPw] = useState('');
    const [confirm, setConfirm] = useState('');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);

    const strength = pw.length === 0 ? 0 : pw.length < 8 ? 1 : pw.length < 12 ? 2 : 3;
    const sColor = ['#e2e8f0', '#ef4444', '#f59e0b', '#10b981'][strength];
    const sLabel = ['', 'Weak', 'Good', 'Strong'][strength];

    const save = async () => {
        if (pw.length < 8) { setStatus('❌ Password must be at least 8 characters'); return; }
        if (pw !== confirm) { setStatus('❌ Passwords do not match'); return; }
        setBusy(true); setStatus('');
        try {
            const res = await fetch(`${API}/api/driver/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: resetToken, password: pw }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus('✅ Password set successfully! Logging you in…');
                setTimeout(() => {
                    localStorage.setItem('driver_token', data.token);
                    setToken(data.token);
                    setView('login');
                }, 1500);
            } else setStatus('❌ ' + data.error);
        } catch { setStatus('❌ Server error'); }
        setBusy(false);
    };

    return (
        <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 20px 50px rgba(0,0,0,.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary, letterSpacing: '-0.02em' }}>Set Your Password</div>
                    <p style={{ fontSize: 13, color: COLORS.textFaint, marginTop: 6, lineHeight: 1.5 }}>Choose a strong password to secure your driver portal access.</p>
                </div>
                
                {status && (
                    <div style={{ 
                        ...status.startsWith('✅') ? S.success() : S.errBox(),
                        marginBottom: 20,
                    }}>
                        {status}
                    </div>
                )}

                <div style={{ marginBottom: 20 }}>
                    <label style={{ ...S.lbl, marginBottom: 8, display: 'block' }}>New Password</label>
                    <input 
                        style={{ ...S.inp, marginBottom: 10 }} 
                        type="password" 
                        placeholder="Min 8 characters" 
                        value={pw} 
                        onChange={e => setPw(e.target.value)} 
                    />
                    {pw && (
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: (strength / 3) * 100 + '%', background: sColor, transition: 'all .4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                            </div>
                            <div style={{ fontSize: 11, color: sColor, fontWeight: 700, marginTop: 6, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {sLabel}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ ...S.lbl, marginBottom: 8, display: 'block' }}>Confirm Password</label>
                    <input 
                        style={S.inp} 
                        type="password" 
                        placeholder="Repeat password" 
                        value={confirm} 
                        onChange={e => setConfirm(e.target.value)} 
                    />
                </div>

                <button 
                    style={{ ...S.btn(), width: '100%', padding: '14px', fontSize: 15, borderRadius: 14 }} 
                    onClick={save} 
                    disabled={busy || strength < 2}
                >
                    {busy ? '⏳ Saving…' : 'Secure Account'}
                </button>
            </div>
        </div>
    );
};
