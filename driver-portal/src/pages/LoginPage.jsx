import React from 'react';
import { COLORS, S } from '../constants/theme';

export const LoginPage = ({
    view,
    setView,
    loginError,
    setLoginError,
    loginMethod,
    setLoginMethod,
    identifier,
    setIdentifier,
    password,
    setPassword,
    loginLoading,
    login,
    forgotPassword
}) => {
    const authInp = { ...S.inp, background: '#ffffff', color: '#0f172a' };

    return (
        <div style={{ minHeight: '100vh', background: 'radial-gradient(at 0% 0%, rgba(232, 80, 26, 0.1) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(27, 58, 107, 0.1) 0, transparent 50%), #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 36, width: '100%', maxWidth: 380, boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <img src="/logo.png" alt="Logo" style={{ height: 100, marginBottom: 16, objectFit: 'contain' }} />
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary, marginBottom: 4 }}>{view === 'forgot' ? 'Reset Password' : 'Segecha Group Ltd'}</div>
                    <div style={{ fontSize: 13, color: COLORS.textFaint }}>Driver Portal · driver.example.com</div>
                </div>
                
                {loginError && <div style={S.errBox()}>{loginError}</div>}
                
                {view === 'login' && (
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 }}>
                        <button
                            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: loginMethod === 'email' ? '#fff' : 'transparent', color: loginMethod === 'email' ? COLORS.primary : COLORS.textFaint, boxShadow: loginMethod === 'email' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
                            onClick={() => { setLoginMethod('email'); setLoginError(''); }}
                        >
                            📧 Email Login
                        </button>
                        <button
                            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: loginMethod === 'phone' ? '#fff' : 'transparent', color: loginMethod === 'phone' ? COLORS.primary : COLORS.textFaint, boxShadow: loginMethod === 'phone' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
                            onClick={() => { setLoginMethod('phone'); setLoginError(''); }}
                        >
                            📱 Phone Login
                        </button>
                    </div>
                )}
                
                <label style={S.lbl}>{loginMethod === 'email' ? 'Email Address' : 'Phone Number'}</label>
                <input
                    style={authInp}
                    type={loginMethod === 'email' ? 'email' : 'tel'}
                    placeholder={loginMethod === 'email' ? 'e.g. name@company.com' : 'e.g. 07XXXXXXXX'}
                    value={identifier}
                    onChange={e => {
                        const val = e.target.value;
                        if (loginMethod === 'phone' && !/^\d*$/.test(val)) return;
                        setIdentifier(val);
                    }}
                    autoComplete={loginMethod === 'email' ? 'email' : 'tel'}
                />
                
                {view === 'login' && (
                    <>
                        <label style={S.lbl}>{loginMethod === 'email' ? 'Password' : '6-Digit PIN'}</label>
                        <input style={authInp} type="password" placeholder={loginMethod === 'email' ? 'Enter password' : '••••••'} value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && login()} />
                        
                        <button style={{ ...S.btn(), width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}
                            onClick={login} disabled={loginLoading}>
                            {loginLoading ? '⏳ Logging in…' : 'Log In'}
                        </button>
                        
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <button style={{ background: 'none', border: 'none', color: COLORS.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                onClick={() => setView('forgot')}>Forgot your password?</button>
                        </div>
                    </>
                )}

                {view === 'forgot' && (
                    <>
                        <button style={{ ...S.btn(), width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}
                            onClick={forgotPassword} disabled={loginLoading}>
                            {loginLoading ? '⏳ Sending…' : 'Send Reset Link'}
                        </button>
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <button style={{ background: 'none', border: 'none', color: COLORS.textFaint, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                onClick={() => setView('login')}>← Back to Login</button>
                        </div>
                    </>
                )}

                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: COLORS.textFaint, lineHeight: 1.5 }}>
                    Segecha Internal Tracker<br />v3.0.1
                </div>
            </div>
        </div>
    );
};
