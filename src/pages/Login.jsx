import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PAYMENT_API } from '../utils/env';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export function Login({ adminAuth, showToast }) {
  const [loginMethod, setLoginMethod] = useState('email'); // email | phone
  const [view, setView] = useState('login'); // login | forgot | reset
  const [resetToken, setResetToken] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (adminAuth.isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Try Admin Login (Postgres)
      const adminResp = await fetch(`${PAYMENT_API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password })
      });
      const adminData = await adminResp.json();
      
      if (adminResp.ok) {
        adminAuth.setSession(adminData.token, adminData.user);
        showToast?.('Welcome back, ' + adminData.user.displayName, 'success');
        navigate('/');
        return;
      }

      // 2. Try Staff Login (JSON)
      const staffResp = await fetch(`${PAYMENT_API}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, method: 'email' })
      });
      const staffData = await staffResp.json();
      
      if (staffResp.ok && staffData.success) {
        if (staffData.requirePasswordChange) {
          setResetToken(staffData.setupToken);
          setView('reset');
          return;
        }
        adminAuth.setSession(staffData.token, { id: staffData.staffId, role: 'staff', displayName: 'Staff User' });
        navigate('/');
        return;
      }
      
      setError(staffData.error || adminData.error || 'Login failed');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const resp = await fetch(`${PAYMENT_API}/api/staff/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await resp.json();
      showToast?.(data.message || 'If that account exists, a link was sent.', 'info');
      setView('login');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      const resp = await fetch(`${PAYMENT_API}/api/staff/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password })
      });
      const data = await resp.json();
      if (data.success) {
        showToast?.('Password set! Logging you in...', 'success');
        adminAuth.setSession(data.token, { id: data.staffId, role: 'staff', displayName: 'Staff User' });
        navigate('/');
      } else setError(data.error);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (view === 'reset') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Set Your Password</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Create a new permanent password for your staff account.</p>
          {error && <div style={errorBoxStyle}>{error}</div>}
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label style={labelStyle}>New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="Min 8 characters" />
            <button type="submit" disabled={loading} style={btnStyle}>{loading ? 'Saving...' : 'Secure Account'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <img src="/logo.png" alt="Segecha Group" style={{ height: 120 }} />
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#0f172a' }}>
          {view === 'forgot' ? 'Reset Password' : 'Sign in to your account'}
        </h2>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <form onSubmit={view === 'forgot' ? handleForgot : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input 
              type="email"
              placeholder="e.g. name@company.com"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {view === 'login' && (
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: 10, background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? <Loader2 className="animate-spin" size={20} style={{ margin: '0 auto' }} /> : (view === 'forgot' ? 'Send Link' : 'Sign In')}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
          {view === 'login' ? (
             <button onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: '#F97316', fontWeight: 600, cursor: 'pointer' }}>Forgot password?</button>
          ) : (
             <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: '#F97316', fontWeight: 600, cursor: 'pointer' }}>← Back to login</button>
          )}
          <p style={{ marginTop: 12, fontSize: 11 }}>Segecha ERP v3.1 · Secure Internal System</p>
        </div>
      </div>
    </div>
  );
}

const containerStyle = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  background: 'radial-gradient(at 0% 0%, rgba(232, 80, 26, 0.05) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(27, 58, 107, 0.05) 0, transparent 50%), #ffffff',
  color: '#0f172a', fontFamily: "'Inter', sans-serif", padding: 20, position: 'fixed', inset: 0, zIndex: 9999
};
const cardStyle = {
  width: '100%', maxWidth: 400, padding: 32, borderRadius: 20, background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(20px)', border: '1px solid rgba(0, 0, 0, 0.05)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.05)',
};
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = {
  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px',
  color: '#0f172a', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s'
};
const btnStyle = {
  width: '100%', height: 48, background: 'linear-gradient(to right, #F97316, #EF4444)', color: '#fff',
  border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8,
  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
};
const errorBoxStyle = {
  background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '12px 16px', borderRadius: 10,
  fontSize: 13, marginBottom: 24, border: '1px solid rgba(239, 68, 68, 0.15)', fontWeight: 500
};
const tabBtnStyle = {
  flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', transition: 'all 0.2s'
};
