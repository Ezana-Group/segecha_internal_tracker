import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuth } from '../utils/adminAuth';
import { PAYMENT_API } from '../utils/env';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, Truck } from 'lucide-react';

export function Login({ showToast }) {
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
      <div style={rootStyle}>
        <div id="login-hero" style={heroPanelStyle}>
          <HeroContent />
        </div>
        <div id="login-form-panel" style={formPanelStyle}>
          <div style={formInnerStyle}>
            <div style={formLogoRowStyle}>
              <div style={brandMarkStyle}><Truck size={20} color="#fff" strokeWidth={2.5} /></div>
              <span style={brandNameStyle}>Segecha Fleet</span>
            </div>
            <h2 style={headingStyle}>Set Your Password</h2>
            <p style={subheadStyle}>Create a new permanent password for your account.</p>

            {error && (
              <div style={errorBoxStyle}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={fieldWrapStyle}>
                <label style={labelStyle}>New Password</label>
                <div style={inputWrapStyle}>
                  <Lock size={16} style={inputIconStyle} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Min 8 characters"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtnStyle} tabIndex={-1}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={submitBtnStyle}>
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Secure Account'}
              </button>
            </form>
          </div>
        </div>
        <style>{keyframes}</style>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      {/* Left hero panel */}
      <div id="login-hero" style={heroPanelStyle}>
        <HeroContent />
      </div>

      {/* Right form panel */}
      <div id="login-form-panel" style={formPanelStyle}>
        <div style={formInnerStyle}>
          {/* Brand mark */}
          <div style={formLogoRowStyle}>
            <div style={brandMarkStyle}><Truck size={20} color="#fff" strokeWidth={2.5} /></div>
            <span style={brandNameStyle}>Segecha Fleet</span>
          </div>

          <h2 style={headingStyle}>
            {view === 'forgot' ? 'Reset Password' : 'Welcome back'}
          </h2>
          <p style={subheadStyle}>
            {view === 'forgot'
              ? 'Enter your email and we will send a reset link.'
              : 'Sign in to Fleet Operations Command.'}
          </p>

          {error && (
            <div style={errorBoxStyle}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={view === 'forgot' ? handleForgot : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email field */}
            <div style={fieldWrapStyle}>
              <label style={labelStyle}>Email Address</label>
              <div style={inputWrapStyle}>
                <Mail size={16} style={inputIconStyle} />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password field — login only */}
            {view === 'login' && (
              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Password</label>
                <div style={inputWrapStyle}>
                  <Lock size={16} style={inputIconStyle} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtnStyle} tabIndex={-1}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} style={submitBtnStyle}>
              {loading
                ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                : view === 'forgot' ? 'Send Reset Link' : 'Sign In'}
            </button>
          </form>

          {/* Footer links */}
          <div style={formFooterStyle}>
            {view === 'login' ? (
              <button onClick={() => setView('forgot')} style={linkBtnStyle}>
                Forgot password?
              </button>
            ) : (
              <button onClick={() => setView('login')} style={linkBtnStyle}>
                ← Back to login
              </button>
            )}
            <p style={{ marginTop: 20, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
              Segecha ERP v3.1 · Secure Internal System
            </p>
          </div>
        </div>
      </div>

      <style>{keyframes}</style>
    </div>
  );
}

/* ── Hero content (left panel interior) ─────────────────────────── */
function HeroContent() {
  return (
    <div style={heroInnerStyle}>
      {/* Abstract truck graphic via CSS shapes */}
      <div style={truckArtStyle}>
        {/* Cab */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 140, height: 90,
          background: 'rgba(249,115,22,0.18)',
          border: '1.5px solid rgba(249,115,22,0.35)',
          borderRadius: '10px 10px 4px 4px',
        }} />
        {/* Windshield */}
        <div style={{
          position: 'absolute', bottom: 60, right: 20,
          width: 90, height: 45,
          background: 'rgba(249,115,22,0.10)',
          border: '1.5px solid rgba(249,115,22,0.25)',
          borderRadius: '6px 6px 0 0',
        }} />
        {/* Trailer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: 220, height: 80,
          background: 'rgba(255,255,255,0.04)',
          border: '1.5px solid rgba(255,255,255,0.10)',
          borderRadius: '4px',
        }} />
        {/* Wheels */}
        {[30, 90, 155, 215].map((x, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: -14, left: x,
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '2px solid rgba(249,115,22,0.4)',
          }} />
        ))}
        {/* Road line */}
        <div style={{
          position: 'absolute', bottom: -20, left: -60, right: -60,
          height: 2,
          background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.3), transparent)',
        }} />
      </div>

      {/* Brand text */}
      <div style={heroTextWrapStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={heroBrandMarkStyle}><Truck size={28} color="#F97316" strokeWidth={2} /></div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F97316', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Segecha Group
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Fleet Operations
            </div>
          </div>
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 3.5vw, 44px)',
          fontWeight: 800,
          color: '#FAFAFA',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: 16,
        }}>
          Command Your<br />
          <span style={{ color: '#F97316' }}>Fleet</span> — In One Place
        </h1>

        <p style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.7,
          maxWidth: 340,
        }}>
          Real-time visibility across trucks, journeys, drivers, fuel, and finances. Built for operators who move fast.
        </p>

        {/* Feature chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 32 }}>
          {['Live Tracking', 'Fuel Analytics', 'P&L Reports', 'Tyre Health'].map(chip => (
            <span key={chip} style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              letterSpacing: '0.02em',
            }}>{chip}</span>
          ))}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(to top, #09090B, transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const rootStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  fontFamily: "'Inter', system-ui, sans-serif",
};

const heroPanelStyle = {
  flex: '0 0 60%',
  width: '60%',
  background: '#09090B',
  position: 'relative',
  overflow: 'hidden',
  // Hide on mobile via media query handled in CSS below
  display: 'flex',
  flexDirection: 'column',
};

// We handle mobile hiding via a wrapping class in the keyframes <style> block
const heroInnerStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '60px 56px',
  position: 'relative',
};

const heroBrandMarkStyle = {
  width: 52,
  height: 52,
  borderRadius: 14,
  border: '1px solid rgba(249,115,22,0.3)',
  background: 'rgba(249,115,22,0.10)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const heroTextWrapStyle = {
  position: 'relative',
  zIndex: 2,
};

const truckArtStyle = {
  position: 'absolute',
  right: 40,
  bottom: 140,
  width: 360,
  height: 120,
  opacity: 0.7,
};

// Decorative background dots
const formPanelStyle = {
  flex: '0 0 40%',
  width: '40%',
  background: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 24px',
  overflowY: 'auto',
};

const formInnerStyle = {
  width: '100%',
  maxWidth: 380,
};

const formLogoRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 32,
};

const brandMarkStyle = {
  width: 38,
  height: 38,
  borderRadius: 10,
  background: 'linear-gradient(135deg, #F97316, #EA580C)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
};

const brandNameStyle = {
  fontSize: 16,
  fontWeight: 800,
  color: '#09090B',
  letterSpacing: '-0.02em',
};

const headingStyle = {
  fontSize: 24,
  fontWeight: 800,
  color: '#09090B',
  letterSpacing: '-0.03em',
  marginBottom: 6,
};

const subheadStyle = {
  fontSize: 13,
  color: '#71717A',
  marginBottom: 28,
  lineHeight: 1.6,
};

const fieldWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: '#3F3F46',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const inputWrapStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const inputIconStyle = {
  position: 'absolute',
  left: 13,
  color: '#A1A1AA',
  pointerEvents: 'none',
  flexShrink: 0,
};

const inputStyle = {
  width: '100%',
  height: 46,
  padding: '0 44px 0 42px',
  border: '1.5px solid #E4E4E7',
  borderRadius: 10,
  fontSize: 14,
  color: '#09090B',
  background: '#FAFAFA',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box',
};

const eyeBtnStyle = {
  position: 'absolute',
  right: 12,
  background: 'none',
  border: 'none',
  color: '#A1A1AA',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
};

const submitBtnStyle = {
  width: '100%',
  height: 48,
  marginTop: 8,
  background: 'linear-gradient(135deg, #F97316, #EA580C)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  boxShadow: '0 4px 16px rgba(249,115,22,0.30)',
  letterSpacing: '-0.01em',
  transition: 'opacity 0.15s',
};

const errorBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(239,68,68,0.07)',
  color: '#DC2626',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 20,
};

const formFooterStyle = {
  marginTop: 24,
  textAlign: 'center',
};

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#F97316',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};

const keyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @media (max-width: 640px) {
    /* Hide hero panel, give full width to form */
    #login-hero { display: none !important; }
    #login-form-panel {
      flex: 1 1 100% !important;
      width: 100% !important;
    }
  }
`;
