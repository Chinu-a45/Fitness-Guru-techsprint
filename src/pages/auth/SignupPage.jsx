// src/pages/auth/SignupPage.jsx
// ──────────────────────────────────────────────────────────────────
// Creates a new Supabase Auth user. The trainer must assign a role
// via the invite-code flow; new sign-ups default to 'client'.
// After signup, user is redirected to onboarding.
// ──────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SignupPage() {
  const navigate = useNavigate();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSignup(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Supabase fires onAuthStateChange → AuthContext loads
      // profile (which won't exist yet), so we redirect to onboarding
      navigate('/onboarding', { replace: true });
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.logoCircle}>
          <Dumbbell size={32} color="var(--color-gold)" />
        </div>
        <h1 style={styles.gymName}>Fitness Guru Gym</h1>
        <p style={styles.tagline}>Be Healthy</p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.heading}>Create account</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Join your trainer on BodyBuddy
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Full name */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={iconStyle} />
              <input
                id="signup-name"
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Arjun Mehta"
                autoComplete="name"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={iconStyle} />
              <input
                id="signup-email"
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
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input
                id="signup-password"
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={eyeStyle}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">Confirm password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input
                id="signup-confirm"
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button
            id="signup-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>

      <p style={styles.disclaimer}>
        This app does not give medical advice. Plans are approved by your trainer.
      </p>
    </div>
  );
}

const iconStyle = {
  position: 'absolute', left: '0.875rem', top: '50%',
  transform: 'translateY(-50%)', color: 'var(--color-text-muted)',
};

const eyeStyle = {
  position: 'absolute', right: '0.875rem', top: '50%',
  transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-muted)',
};

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#0A0A0A',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    gap: '1.5rem',
  },
  hero: { textAlign: 'center', color: '#F0F0F0' },
  logoCircle: {
    width: '4.5rem', height: '4.5rem', borderRadius: '50%',
    background: 'rgba(61, 255, 79, 0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 0.75rem',
    border: '2px solid rgba(61, 255, 79, 0.35)',
    boxShadow: '0 0 24px rgba(61, 255, 79, 0.18)',
  },
  gymName: { fontSize: '1.4rem', fontWeight: 800, color: '#F0F0F0' },
  tagline: { color: 'var(--color-brand)', fontWeight: 600, fontSize: '0.9rem' },
  card: {
    background: '#161616',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 12px 48px rgba(0,0,0,0.75)',
    border: '1px solid #2A2A2A',
  },
  heading: { fontSize: '1.5rem', fontWeight: 700, color: '#F0F0F0' },
  disclaimer: {
    fontSize: '0.72rem',
    color: 'rgba(240,240,240,0.3)',
    textAlign: 'center',
    maxWidth: '320px',
  },
};
