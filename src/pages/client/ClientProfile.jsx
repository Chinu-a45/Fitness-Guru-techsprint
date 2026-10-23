// src/pages/client/ClientProfile.jsx
// ──────────────────────────────────────────────────────────────────
// Client profile page:
//   • View and edit name, goal, height, weight, food preference, days
//   • View consent date
//   • "Delete my data" button (anonymises personal data)
//   • Sign out
// ──────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Trash2, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { fmtDate, todayISO } from '../../lib/utils';

const GOALS = [
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'strength', label: 'Strength' },
  { value: 'general', label: 'General Fitness' },
];

const DIET_PREFS = [
  { value: 'veg', label: 'Vegetarian' },
  { value: 'non_veg', label: 'Non-Veg' },
  { value: 'eggetarian', label: 'Eggetarian' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function normalizeDiet(d) {
  if (!d) return '';
  if (d === 'non-veg') return 'non_veg';
  return d;
}

let _clientProfileWeightCache = null;

export function ClientProfile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  // Edit form mirrors profile (with user_metadata fallback)
  const initialDays = (Array.isArray(profile?.session_days) && profile.session_days.length > 0)
    ? profile.session_days
    : (user?.user_metadata?.session_days || []);

  const [name, setName] = useState(profile?.full_name || '');
  const [goal, setGoal] = useState(profile?.goal || '');
  const [height, setHeight] = useState(profile?.height_cm ?? '');
  const [dietPref, setDietPref] = useState(normalizeDiet(profile?.diet_pref));
  const [days, setDays] = useState(initialDays);

  // In-memory cache for instant display
  // Latest weight from logs table (read-only in profile)
  const [latestWeight, setLatestWeight] = useState(_clientProfileWeightCache?.weight ?? null);
  const [latestWeightDate, setLatestWeightDate] = useState(_clientProfileWeightCache?.date ?? null);

  async function fetchLatestWeight() {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('weight_kg, date')
        .eq('client_id', user.id)
        .not('weight_kg', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        _clientProfileWeightCache = { weight: data.weight_kg, date: data.date };
        setLatestWeight(data.weight_kg);
        setLatestWeightDate(data.date);
      }
    } catch (err) {
      console.warn('Could not fetch latest weight log:', err);
    }
  }

  useEffect(() => {
    fetchLatestWeight();
  }, [user?.id]);

  function syncFromProfile(p) {
    if (!p) return;
    setName(p.full_name || '');
    setGoal(p.goal || '');
    setHeight(p.height_cm ?? '');
    setDietPref(normalizeDiet(p.diet_pref));
    const loadedDays = (Array.isArray(p.session_days) && p.session_days.length > 0)
      ? p.session_days
      : (user?.user_metadata?.session_days || []);
    setDays(loadedDays);
  }

  // Keep form in sync when profile finishes loading or updates
  useEffect(() => {
    syncFromProfile(profile);
  }, [profile]);

  function toggleEditing() {
    if (!editing) {
      syncFromProfile(profile);
      fetchLatestWeight();
    }
    setEditing((prev) => !prev);
    setError('');
    setSuccess('');
  }

  function toggleDay(d) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');

    // Always persist session_days to user_metadata so it is never lost even if the DB column is missing
    try {
      await supabase.auth.updateUser({
        data: { session_days: days },
      });
    } catch (metaErr) {
      console.warn('Could not save session_days to user_metadata:', metaErr);
    }

    const baseUpdate = {
      full_name: name.trim(),
      goal,
      height_cm: parseFloat(height) || null,
      diet_pref: dietPref || null,
    };

    // First attempt full update with session_days
    let { error: profErr } = await supabase
      .from('profiles')
      .update({
        ...baseUpdate,
        session_days: days,
      })
      .eq('id', user.id);

    // If session_days does not exist in Supabase schema cache, retry without it
    if (profErr && profErr.message?.includes('session_days')) {
      console.warn('Retrying profile update without optional session_days:', profErr.message);
      const retry = await supabase
        .from('profiles')
        .update(baseUpdate)
        .eq('id', user.id);
      profErr = retry.error;
    }

    if (profErr) {
      setError(profErr.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    await fetchLatestWeight();
    setSuccess('Profile updated!');
    setEditing(false);
    setSaving(false);
  }

  async function handleDeleteData() {
    const confirmed = window.confirm(
      'This will delete all your personal data (logs, completions, check-ins, notes). ' +
      'Your account email will remain but the profile will be removed. ' +
      'This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setSaving(true);
    // Delete all client data tables
    await supabase.from('completions').delete().eq('client_id', user.id);
    await supabase.from('logs').delete().eq('client_id', user.id);
    await supabase.from('checkins').delete().eq('client_id', user.id);
    await supabase.from('notes').delete().eq('client_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);

    await signOut();
    navigate('/signup');
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const consentDate = profile?.consent_at ? fmtDate(profile.consent_at.slice(0, 10)) : '—';

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            width: '4rem', height: '4rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <User size={28} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-brand)' }}>
            {profile?.full_name || 'My Profile'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {user?.email}
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── Profile card ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 700 }}>Details</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleEditing}
            id="profile-edit-toggle"
          >
            {editing ? <><ChevronUp size={14} /> Cancel</> : <><ChevronDown size={14} /> Edit</>}
          </button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="prof-name">Full name</label>
              <input id="prof-name" type="text" className="form-input" value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Goal</label>
              <select className="form-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                <option value="">Select…</option>
                {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-height">Height (cm)</label>
                <input id="prof-height" type="number" className="form-input" value={height}
                  onChange={(e) => setHeight(e.target.value)} min={100} max={250} />
              </div>
              <div className="form-group">
                <label className="form-label">Weight</label>
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--color-surface-2)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: '47px',
                }}>
                  <span style={{ fontWeight: 700 }}>
                    {(latestWeight ?? profile?.weight_kg) ? `${latestWeight ?? profile.weight_kg} kg` : '—'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {latestWeightDate ? `Logged ${fmtDate(latestWeightDate)}` : 'Log in Progress'}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Food preference</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DIET_PREFS.map(({ value, label }) => {
                  const isSelected = dietPref === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDietPref(value)}
                      style={{
                        padding: '0.45rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-brand)' : 'var(--color-surface-2)',
                        color: isSelected ? '#000' : 'var(--color-text)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred training days</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {DAYS.map((d) => {
                  const isSelected = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      style={{
                        width: '2.75rem',
                        height: '2.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-brand)' : 'var(--color-surface-2)',
                        color: isSelected ? '#000' : 'var(--color-text)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              id="profile-save"
              className="btn btn-primary btn-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[
              ['Goal', GOALS.find((g) => g.value === profile?.goal)?.label || '—'],
              ['Height', profile?.height_cm ? `${profile.height_cm} cm` : '—'],
              [
                'Weight',
                (latestWeight ?? profile?.weight_kg)
                  ? `${latestWeight ?? profile.weight_kg} kg${latestWeightDate ? ` (${fmtDate(latestWeightDate)})` : ''}`
                  : '—',
              ],
              ['Food pref', DIET_PREFS.find((d) => d.value === normalizeDiet(profile?.diet_pref))?.label || '—'],
              ['Session days', (profile?.session_days || []).join(', ') || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Consent ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
          <Shield size={16} color="var(--color-success)" />
          <h2 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Consent</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
          You consented on <strong>{consentDate}</strong>.<br />
          Plans are created or approved by your trainer. This app does not give medical advice.
        </p>
      </div>

      {/* ── Account actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          id="profile-signout"
          className="btn btn-secondary btn-full"
          onClick={handleSignOut}
        >
          <LogOut size={16} /> Sign out
        </button>

        <button
          id="profile-delete-toggle"
          className="btn btn-ghost btn-full"
          style={{ color: 'var(--color-error)' }}
          onClick={() => setShowDelete(!showDelete)}
        >
          <Trash2 size={16} /> Delete my data
        </button>

        {showDelete && (
          <div className="alert alert-error">
            <div>
              <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ This action cannot be undone.</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                All your logs, completions, check-ins, and notes will be permanently deleted.
              </p>
              <button
                id="profile-delete-confirm"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteData}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
