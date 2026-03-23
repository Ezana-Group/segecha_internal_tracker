import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuth } from '../utils/adminAuth';
import { Button } from '../components/Button';
import { Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export function Login({ showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      
      if (!resp.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
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
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: 20,
      position: 'fixed',
      inset: 0,
      zIndex: 9999
    }}>
      <div className="glass-premium" style={{ 
        width: '100%', 
        maxWidth: 420, 
        padding: '48px 40px', 
        borderRadius: 28,
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.8)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            width: 64, 
            height: 64, 
            borderRadius: 20, 
            background: 'var(--brand-primary)', 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px',
            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Admin Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            Sign in to manage Segecha Internal Tracker
          </p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#ef4444', 
            padding: '12px 16px', 
            borderRadius: 12, 
            fontSize: 13, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            marginBottom: 24,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-dim)' }} />
              <input 
                type="email" 
                className="input-premium"
                style={{ width: '100%', paddingLeft: 42 }}
                placeholder="admin@segecha.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-dim)' }} />
              <input 
                type="password" 
                className="input-premium"
                style={{ width: '100%', paddingLeft: 42 }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            style={{ width: '100%', height: 48, marginTop: 10, fontSize: 15, fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </Button>
        </form>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
          &copy; {new Date().getFullYear()} Segecha Group Ltd. All rights reserved.
        </div>
      </div>
    </div>
  );
}
