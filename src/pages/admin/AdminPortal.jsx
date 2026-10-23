// src/pages/admin/AdminPortal.jsx
// ──────────────────────────────────────────────────────────────────
// Protected Admin Portal for Fitness Guru Gym Management.
// Credentials: ID = guru143, Password = Guru@225
// Allows administrators to:
//   • Create new trainer accounts with auto-generated trainer invite codes
//   • View and manage all gym trainers and their client counts
//   • Copy trainer credentials to share with trainers
// ──────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Lock, User, Mail, KeyRound, Copy,
  Check, RefreshCw, Dumbbell, Users, LogOut, ArrowRight,
  Eye, EyeOff, AlertCircle, Sparkles
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { Spinner } from '../../components/ui/Spinner';

const ADMIN_ID = 'guru143';
const ADMIN_PWD = 'Guru@225';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Auto-generates a clean, unique trainer invite code (e.g. GURU-RAHUL-7821)
function generateTrainerCode(name = '') {
  const cleanName = (name || 'TR')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `GURU-${cleanName || 'TR'}-${randomNum}`;
}

// Generates a random secure temporary password
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let pwd = 'Guru@';
  for (let i = 0; i < 4; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd + '!';
}

export function AdminPortal() {
  // ── Authentication Gate State ───────────────────────────────────
  const [isAdminAuth, setIsAdminAuth] = useState(() => {
    return sessionStorage.getItem('guru_admin_authenticated') === 'true';
  });
  const [loginId, setLoginId] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [authError, setAuthError] = useState('');

  // ── Admin Dashboard State ───────────────────────────────────────
  const [trainers, setTrainers] = useState([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [clientsCount, setClientsCount] = useState(0);

  // New Trainer Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('GuruTrainer@123');
  const [showTrainerPwd, setShowTrainerPwd] = useState(false);
  const [inviteCode, setInviteCode] = useState(generateTrainerCode(''));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdTrainer, setCreatedTrainer] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);

  // ── Handle Admin Login ──────────────────────────────────────────
  function handleAdminLogin(e) {
    e.preventDefault();
    setAuthError('');

    if (loginId.trim() === ADMIN_ID && loginPwd === ADMIN_PWD) {
      sessionStorage.setItem('guru_admin_authenticated', 'true');
      setIsAdminAuth(true);
      setLoginId('');
      setLoginPwd('');
    } else {
      setAuthError('Invalid Admin ID or Password. Access denied.');
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem('guru_admin_authenticated');
    setIsAdminAuth(false);
    setCreatedTrainer(null);
  }

  // ── Load Trainers & Clients ─────────────────────────────────────
  async function loadData() {
    setLoadingTrainers(true);

    // 1. Fetch all trainers
    const { data: trainerList } = await supabase
      .from('profiles')
      .select('id, full_name, invite_code, created_at')
      .eq('role', 'trainer')
      .order('created_at', { ascending: false });

    // 2. Fetch all clients to map counts
    const { data: clientList } = await supabase
      .from('profiles')
      .select('id, trainer_id')
      .eq('role', 'client');

    const counts = {};
    (clientList || []).forEach((c) => {
      if (c.trainer_id) {
        counts[c.trainer_id] = (counts[c.trainer_id] || 0) + 1;
      }
    });

    const enriched = (trainerList || []).map((t) => ({
      ...t,
      clientCount: counts[t.id] || 0,
    }));

    setTrainers(enriched);
    setClientsCount((clientList || []).length);
    setLoadingTrainers(false);
  }

  useEffect(() => {
    if (isAdminAuth) {
      loadData();
    }
  }, [isAdminAuth]);

  // When trainer name changes, update auto-generated invite code if not manually customized
  function handleNameChange(val) {
    setFullName(val);
    setInviteCode(generateTrainerCode(val));
  }

  // ── Create New Trainer Profile ──────────────────────────────────
  async function handleCreateTrainer(e) {
    e.preventDefault();
    setFormError('');
    setCreatedTrainer(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPwd = password.trim();
    const cleanCode = inviteCode.trim().toUpperCase();

    if (!cleanName) { setFormError('Please enter trainer full name.'); return; }
    if (!cleanEmail) { setFormError('Please enter trainer email.'); return; }
    if (cleanPwd.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    if (!cleanCode) { setFormError('Please provide a trainer invite code.'); return; }

    setSubmitting(true);

    try {
      // Create a temporary client that does NOT persist session or log out the admin
      const tempClient = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // 1. Sign up the user in Supabase Auth
      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email: cleanEmail,
        password: cleanPwd,
        options: {
          data: {
            full_name: cleanName,
            role: 'trainer',
          },
        },
      });

      if (signUpErr) {
        throw new Error(signUpErr.message);
      }

      const newUserId = signUpData?.user?.id;
      if (!newUserId) {
        throw new Error('User creation failed in Supabase Auth.');
      }

      // 2. Insert the profile row as role='trainer' with auto-generated invite_code
      // Use tempClient (authenticated as new user) or fallback to main supabase client
      const profilePayload = {
        id: newUserId,
        full_name: cleanName,
        role: 'trainer',
        invite_code: cleanCode,
        consent_at: new Date().toISOString(),
      };

      let insertErr = null;
      const resTemp = await tempClient.from('profiles').insert(profilePayload);
      if (resTemp.error) {
        // Fallback to main client if tempClient session was delayed
        const resMain = await supabase.from('profiles').insert(profilePayload);
        if (resMain.error) {
          insertErr = resMain.error;
        }
      }

      if (insertErr) {
        throw new Error('Trainer auth created, but profile creation failed: ' + insertErr.message);
      }

      // Record success
      setCreatedTrainer({
        name: cleanName,
        email: cleanEmail,
        password: cleanPwd,
        inviteCode: cleanCode,
      });

      // Reset form
      setFullName('');
      setEmail('');
      setPassword('GuruTrainer@123');
      setInviteCode(generateTrainerCode(''));

      // Reload list
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create trainer profile.');
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(''), 2000);
    });
  }

  function copyAllCredentials() {
    if (!createdTrainer) return;
    const msg = `🏋️ Welcome to Fitness Guru Gym!\n\nHere are your Trainer Portal credentials:\n• Name: ${createdTrainer.name}\n• Email: ${createdTrainer.email}\n• Password: ${createdTrainer.password}\n• Your Client Invite Code: ${createdTrainer.inviteCode}\n\nLogin here: ${window.location.origin}/login\nShare your Invite Code with clients so they link to you automatically!`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 1. ADMIN LOGIN GATE (If not authenticated)
  // ════════════════════════════════════════════════════════════════
  if (!isAdminAuth) {
    return (
      <div style={styles.gatePage}>
        <div style={styles.gateCard}>
          <div style={styles.gateHeader}>
            <div style={styles.shieldIconWrapper}>
              <ShieldCheck size={36} color="var(--color-gold)" />
            </div>
            <h1 style={styles.gateTitle}>Guru Gym Admin Portal</h1>
            <p style={styles.gateSubtitle}>
              Restricted management area · Authorized personnel only
            </p>
          </div>

          {authError && (
            <div
              className="alert alert-error"
              style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              role="alert"
            >
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-id">
                Admin ID
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={styles.fieldIcon} />
                <input
                  id="admin-id"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter admin ID"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-pwd">
                Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={styles.fieldIcon} />
                <input
                  id="admin-pwd"
                  type={showLoginPwd ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  value={loginPwd}
                  onChange={(e) => setLoginPwd(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPwd(!showLoginPwd)}
                  style={styles.eyeBtn}
                  aria-label={showLoginPwd ? 'Hide password' : 'Show password'}
                >
                  {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="admin-login-btn"
              className="btn btn-primary btn-full"
              style={{ marginTop: '0.5rem', padding: '0.85rem', fontSize: '0.95rem' }}
            >
              <ShieldCheck size={18} /> Authenticate as Admin
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <Link
              to="/login"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              ← Back to Gym Member Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 2. ADMIN DASHBOARD (When authenticated)
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={styles.dashboardContainer}>
      {/* Top Admin Bar */}
      <header style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={styles.logoBadge}>
            <Dumbbell size={20} color="var(--color-gold)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fff', lineHeight: 1.2 }}>
              Fitness Guru Gym
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                Admin Portal (guru143)
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/"
            className="btn btn-ghost btn-sm"
            style={{ color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Gym App <ArrowRight size={14} />
          </Link>
          <button
            onClick={handleAdminLogout}
            className="btn btn-sm"
            style={{
              background: 'rgba(239,68,68,0.2)',
              color: '#FCA5A5',
              border: '1px solid rgba(239,68,68,0.4)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {/* Quick Stats Cards */}
        <div style={styles.statsRow}>
          <div className="card" style={styles.statCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ ...styles.statIconBox, background: 'rgba(31,77,58,0.1)', color: 'var(--color-brand)' }}>
                <Dumbbell size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Trainers</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)', lineHeight: 1.2 }}>
                  {trainers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="card" style={styles.statCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ ...styles.statIconBox, background: 'rgba(201,169,97,0.15)', color: 'var(--color-gold)' }}>
                <Users size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Active Clients</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)', lineHeight: 1.2 }}>
                  {clientsCount}
                </p>
              </div>
            </div>
          </div>

          <div className="card" style={styles.statCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ ...styles.statIconBox, background: '#EFF6FF', color: '#2563EB' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Portal Security</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#16A34A', lineHeight: 1.4 }}>
                  Protected by ID/PW
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── SUCCESS BANNER AFTER CREATING TRAINER ── */}
        {createdTrainer && (
          <div
            style={{
              background: '#F0FDF4',
              border: '2px solid #86EFAC',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 14px rgba(22,163,74,0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} color="#16A34A" />
                <h3 style={{ margin: 0, fontWeight: 800, color: '#166534', fontSize: '1.1rem' }}>
                  Trainer Profile Created Successfully!
                </h3>
              </div>
              <button
                onClick={copyAllCredentials}
                className="btn btn-sm"
                style={{
                  background: copiedAll ? '#16A34A' : '#DCFCE7',
                  color: copiedAll ? '#fff' : '#166534',
                  border: '1px solid #86EFAC',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {copiedAll ? <Check size={14} /> : <Copy size={14} />}
                {copiedAll ? 'Credentials Copied!' : 'Copy Credentials for Trainer'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', background: '#fff', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #BBF7D0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Trainer Name</span>
                <p style={{ fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{createdTrainer.name}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Login Email</span>
                <p style={{ fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>{createdTrainer.email}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Temporary Password</span>
                <p style={{ fontWeight: 700, margin: 0, color: 'var(--color-brand)' }}>{createdTrainer.password}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Auto-Generated Invite Code</span>
                <p style={{ fontWeight: 800, margin: 0, color: 'var(--color-gold)', letterSpacing: '0.05em' }}>
                  {createdTrainer.inviteCode}
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={styles.gridColumns}>
          {/* ── CREATE TRAINER FORM ── */}
          <section className="card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <Dumbbell size={20} color="var(--color-brand)" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                Create Trainer Profile
              </h2>
            </div>

            {formError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTrainer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="new-trainer-name">
                  Trainer Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={styles.fieldIcon} />
                  <input
                    id="new-trainer-name"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={fullName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Coach Vikram Rathore"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="new-trainer-email">
                  Trainer Email (for login)
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={styles.fieldIcon} />
                  <input
                    id="new-trainer-email"
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vikram@fitnessguru.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" htmlFor="new-trainer-pwd" style={{ margin: 0 }}>
                    Initial Login Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setPassword(generateTempPassword())}
                    style={{ background: 'none', border: 'none', color: 'var(--color-brand)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <RefreshCw size={11} /> Generate Random
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} style={styles.fieldIcon} />
                  <input
                    id="new-trainer-pwd"
                    type={showTrainerPwd ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowTrainerPwd(!showTrainerPwd)}
                    style={styles.eyeBtn}
                    aria-label={showTrainerPwd ? 'Hide password' : 'Show password'}
                  >
                    {showTrainerPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Auto-Generated Trainer Code */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" htmlFor="new-trainer-code" style={{ margin: 0 }}>
                    Auto-Generated Invite Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setInviteCode(generateTrainerCode(fullName))}
                    style={{ background: 'none', border: 'none', color: 'var(--color-gold)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <RefreshCw size={11} /> Regenerate Code
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-trainer-code"
                    type="text"
                    className="form-input"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    style={{
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: 'var(--color-brand)',
                      background: '#F9FAFB',
                    }}
                    required
                  />
                </div>
                <span className="form-hint" style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
                  Clients will enter this code on signup to be automatically linked to this trainer.
                </span>
              </div>

              <button
                type="submit"
                id="create-trainer-btn"
                className="btn btn-primary btn-full"
                disabled={submitting}
                style={{ padding: '0.85rem', marginTop: '0.5rem', fontWeight: 700 }}
              >
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Spinner size={16} /> Creating Trainer Profile…
                  </span>
                ) : (
                  'Create Trainer Profile'
                )}
              </button>
            </form>
          </section>

          {/* ── REGISTERED TRAINERS LIST ── */}
          <section className="card" style={{ flex: 1.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="var(--color-brand)" />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Active Gym Trainers ({trainers.length})
                </h2>
              </div>
              <button
                onClick={loadData}
                className="btn btn-ghost btn-sm"
                title="Refresh list"
                style={{ padding: '0.3rem 0.5rem' }}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {loadingTrainers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Spinner />
              </div>
            ) : trainers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-muted)' }}>
                <Dumbbell size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 600 }}>No trainers created yet</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Use the form on the left to create your first trainer profile.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
                {trainers.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1rem',
                      background: '#F9FAFB',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--color-border)',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Avatar & Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '180px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {t.full_name?.[0] || 'T'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: 'var(--color-text)' }}>
                          {t.full_name}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          {t.clientCount} {t.clientCount === 1 ? 'client' : 'clients'} assigned
                        </p>
                      </div>
                    </div>

                    {/* Invite Code Badge with 1-click Copy */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid var(--color-border)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.825rem',
                          fontWeight: 800,
                          letterSpacing: '0.05em',
                          color: 'var(--color-brand)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span>{t.invite_code || 'NO-CODE'}</span>
                        <button
                          onClick={() => copyToClipboard(t.invite_code, t.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedCode === t.id ? '#16A34A' : 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px',
                          }}
                          title="Copy invite code"
                        >
                          {copiedCode === t.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = {
  gatePage: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--color-brand-dark) 0%, #0F291E 100%)',
    padding: '1.5rem',
  },
  gateCard: {
    width: '100%',
    maxWidth: '420px',
    background: '#FFFFFF',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    padding: '2.5rem 2rem',
  },
  gateHeader: {
    textAlign: 'center',
    marginBottom: '1.75rem',
  },
  shieldIconWrapper: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(31,77,58,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
    border: '2px solid rgba(201,169,97,0.3)',
  },
  gateTitle: {
    fontSize: '1.35rem',
    fontWeight: 800,
    color: 'var(--color-brand-dark)',
    marginBottom: '0.25rem',
  },
  gateSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--color-text-muted)',
  },
  fieldIcon: {
    position: 'absolute',
    left: '0.875rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--color-text-muted)',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.875rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    display: 'flex',
    alignItems: 'center',
  },
  dashboardContainer: {
    minHeight: '100dvh',
    background: 'var(--color-bg)',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    background: 'var(--color-brand-dark)',
    padding: '0.875rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '1.5rem 1rem 3rem',
    flex: 1,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statCard: {
    padding: '1.25rem',
    background: '#fff',
    borderRadius: 'var(--radius-lg)',
  },
  statIconBox: {
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridColumns: {
    display: 'flex',
    flexDirection: 'row',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
};
