import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuth } from '../utils/adminAuth';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export function Login({ showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Login failed');
      
      adminAuth.setSession(data.token, data.user);
      showToast?.('Welcome back, ' + data.user.displayName, 'success');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#0F172A', // Dark background from image 1
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      padding: 20,
      position: 'fixed',
      inset: 0,
      zIndex: 9999
    }}>
      {/* Logo and Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img src="/logo.png" alt="Segecha Group" style={{ height: 160, marginBottom: 0 }} />
      </div>

      <div style={{ 
        width: '100%', 
        maxWidth: 440, 
        padding: '40px', 
        borderRadius: 16,
        background: '#1E293B', // Dark card background from image 1
        border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 32 }}>Sign in to your account</h2>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#F87171', 
            padding: '12px 16px', 
            borderRadius: 8, 
            fontSize: 14, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            marginBottom: 24,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' }}>
              Email Address
            </label>
            <input 
              type="email" 
              placeholder="director@segechagroup.co.ke"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '12px 16px',
                color: '#fff',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>
                Password
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 10,
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              height: 48, 
              background: 'linear-gradient(to right, #F97316, #EF4444)', // Orange/Red gradient from image 1
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 10,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} style={{ margin: '0 auto' }} /> : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
          <p style={{ margin: 0 }}>Forgot your password? Contact your system administrator.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>Segecha Group ERP v3.0 · Nairobi, Kenya</p>
        </div>
      </div>

      <div style={{ marginTop: 40, color: '#475569', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span role="img" aria-label="lock">🔒</span>
        Secure · Internal use only · {new Date().getFullYear()}
      </div>
    </div>
  );
}
