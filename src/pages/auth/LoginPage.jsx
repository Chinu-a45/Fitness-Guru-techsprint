// src/pages/auth/LoginPage.jsx
// ──────────────────────────────────────────────────────────────────
// Email + password login screen. Shows error state on failure,
// links to sign-up page.
// ──────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // AuthContext listener picks up the session; router redirects
      navigate('/', { replace: true });
    }
  }

  return (
    <div style={styles.page}>
      {/* Hero section */}
      <div style={styles.hero}>
        <div style={styles.logoCircle}>
          <Dumbbell size={32} color="var(--color-gold)" />
        </div>
        <h1 style={styles.gymName}>Fitness Guru Gym</h1>
        <p style={styles.tagline}>Be Healthy</p>
        <p style={styles.appName}>BodyBuddy</p>
      </div>

      {/* Login card */}
      <div style={styles.card}>
        <h2 style={styles.heading}>Welcome back</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Sign in to your account
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
              />
              <input
                id="login-email"
                type="email"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
              />
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '0.875rem', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>

      <p style={styles.disclaimer}>
        This app does not give medical advice. Plans are approved by your trainer.
      </p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: 'var(--color-bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    gap: '1.5rem',
  },
  hero: {
    textAlign: 'center',
    color: 'var(--color-text)',
  },
  logoCircle: {
    width: '5rem',
    height: '5rem',
    borderRadius: '50%',
    background: 'var(--color-brand-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
    border: '2px solid rgba(22, 163, 74, 0.3)',
    boxShadow: '0 4px 16px rgba(22, 163, 74, 0.15)',
  },
  gymName: {
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: 'var(--color-text)',
  },
  tagline: {
    color: 'var(--color-brand)',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  appName: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.25rem',
  },
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow-modal)',
    border: '1px solid var(--color-border)',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  disclaimer: {
    fontSize: '0.72rem',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    maxWidth: '320px',
  },
};
