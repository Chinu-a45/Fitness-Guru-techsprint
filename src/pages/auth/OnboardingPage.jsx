// src/pages/auth/OnboardingPage.jsx
// ──────────────────────────────────────────────────────────────────
// Multi-step onboarding form for new clients. Collects:
//   Step 1: Goal, height, weight, food preference
//   Step 2: Preferred session days, limitations note
//   Step 3: Invite code (links to trainer), consent checkbox
// Creates the 'profiles' row in Supabase after submission.
// ──────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Dumbbell, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { todayISO } from '../../lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const GOALS = [
  { value: 'fat_loss', label: '🔥 Fat Loss' },
  { value: 'strength', label: '💪 Strength' },
  { value: 'general', label: '🌿 General Fitness' },
];

const DIET_PREFS = [
  { value: 'veg', label: '🥦 Vegetarian' },
  { value: 'non_veg', label: '🍗 Non-Veg' },
  { value: 'eggetarian', label: '🥚 Eggetarian' },
];

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state (Client)
  const [goal, setGoal] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [dietPref, setDietPref] = useState('');
  const [days, setDays] = useState([]);
  const [limNote, setLimNote] = useState('');
  const [invite, setInvite] = useState('GURU-INDORE');
  const [consent, setConsent] = useState(false);

  function toggleDay(d) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function validateStep1() {
    if (!goal) return 'Please select a goal.';
    if (!height || isNaN(height) || height < 100 || height > 250)
      return 'Enter a valid height (100–250 cm).';
    if (!weight || isNaN(weight) || weight < 30 || weight > 250)
      return 'Enter a valid weight (30–250 kg).';
    if (!dietPref) return 'Please select a food preference.';
    return '';
  }

  function validateStep2() {
    if (days.length === 0) return 'Select at least one preferred session day.';
    return '';
  }

  async function validateStep3() {
    if (!invite.trim()) return 'Please enter the invite code your trainer gave you.';
    if (!consent) return 'Please tick the consent checkbox to continue.';
    return '';
  }

  function next() {
    setError('');
    let err = '';
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
  }

  async function submit() {
    setError('');
    const err = await validateStep3();
    if (err) { setError(err); return; }

    setLoading(true);

    // Look up the trainer by invite code
    const { data: trainerRows, error: trainerErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('invite_code', invite.trim().toUpperCase())
      .eq('role', 'trainer')
      .limit(1);

    if (trainerErr || !trainerRows?.length) {
      setError('Invite code not found. Ask your trainer for the correct code.');
      setLoading(false);
      return;
    }

    const trainerId = trainerRows[0].id;

    // Save session_days to user_metadata so it is always preserved
    try {
      await supabase.auth.updateUser({
        data: { session_days: days },
      });
    } catch (metaErr) {
      console.warn('Could not save session_days to user_metadata:', metaErr);
    }

    // 1. Core profile data matching guaranteed columns
    const baseProfileData = {
      id: user.id,
      full_name: user.user_metadata?.full_name || 'Client Member',
      role: 'client',
      trainer_id: trainerId,
      goal,
      height_cm: parseFloat(height) || null,
      diet_pref: dietPref,
      limitations_note: limNote.trim() || null,
      consent_at: new Date().toISOString(),
    };

    // Try full insert with session_days and weight_kg
    let { error: insertErr } = await supabase.from('profiles').insert({
      ...baseProfileData,
      weight_kg: parseFloat(weight) || null,
      session_days: days,
    });

    // If session_days or weight_kg is missing in Supabase schema cache, retry with base columns
    if (insertErr && (insertErr.message?.includes('session_days') || insertErr.message?.includes('weight_kg'))) {
      console.warn('Retrying profile insert without optional schema columns:', insertErr.message);
      const retryResult = await supabase.from('profiles').insert(baseProfileData);
      insertErr = retryResult.error;
    }

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    // 2. Insert initial baseline weight into logs table
    if (weight && !isNaN(weight)) {
      try {
        await supabase.from('logs').insert({
          client_id: user.id,
          date: todayISO(),
          weight_kg: parseFloat(weight),
        });
      } catch (logErr) {
        console.warn('Initial weight log skipped:', logErr);
      }
    }

    await refreshProfile();
    navigate('/client/home', { replace: true });
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <Dumbbell size={24} color="var(--color-gold)" />
        <div>
          <p style={{ color: '#fff', fontWeight: 700 }}>BodyBuddy</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
            Step {step} of 3
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div style={styles.stepRow}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div
              style={{
                width: '2rem', height: '2rem', borderRadius: '50%',
                background: s <= step ? 'var(--color-gold)' : 'rgba(255,255,255,0.2)',
                color: s <= step ? 'var(--color-brand-dark)' : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.85rem',
                transition: 'all 0.3s',
              }}
            >
              {s < step ? <Check size={14} /> : s}
            </div>
            {s < 3 && (
              <div style={{
                width: '2rem', height: '2px',
                background: s < step ? 'var(--color-gold)' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div style={styles.card}>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }} role="alert">
            {error}
          </div>
        )}

        {/* ── Client Mode (Step 1) ── */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <h2 style={styles.heading}>Your fitness profile</h2>

            <div className="form-group">
              <label className="form-label">Your goal</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {GOALS.map(({ value, label }) => {
                  const isSelected = goal === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGoal(value)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-brand-dim)' : 'var(--color-surface-2)',
                        color: isSelected ? 'var(--color-brand)' : 'var(--color-text)',
                        fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="ob-height">Height (cm)</label>
                <input
                  id="ob-height"
                  type="number"
                  className="form-input"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                  min={100} max={250}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ob-weight">Weight (kg)</label>
                <input
                  id="ob-weight"
                  type="number"
                  className="form-input"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  min={30} max={250}
                />
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
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-brand)' : 'var(--color-surface-2)',
                        color: isSelected ? '#000' : 'var(--color-text)',
                        fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s', fontSize: '0.9rem',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Schedule & notes ── */}
        {step === 2 && (
          <div style={styles.stepContent}>
            <h2 style={styles.heading}>Your schedule</h2>

            <div className="form-group">
              <label className="form-label">Preferred training days</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DAYS.map((d) => {
                  const isSelected = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      style={{
                        width: '3rem', height: '3rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-brand)' : 'var(--color-surface-2)',
                        color: isSelected ? '#000' : 'var(--color-text)',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                        transition: 'all 0.15s',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ob-limits">
                Limitations / injuries{' '}
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span>
              </label>
              <textarea
                id="ob-limits"
                className="form-textarea"
                rows={3}
                value={limNote}
                onChange={(e) => setLimNote(e.target.value)}
                placeholder="E.g. right knee pain, lower back issue…"
              />
              <p className="form-hint">Visible to your trainer only. Not shared with anyone else.</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Invite code + consent ── */}
        {step === 3 && (
          <div style={styles.stepContent}>
            <h2 style={styles.heading}>Connect to your trainer</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="ob-invite">Trainer invite code</label>
              <input
                id="ob-invite"
                type="text"
                className="form-input"
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                placeholder="e.g. GURU-INDORE or GURU-RAHUL-4821"
                maxLength={25}
                style={{ letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}
              />
              <p className="form-hint">Your trainer will give you this code.</p>
            </div>

            {/* Consent */}
            <div
              style={{
                padding: '1rem',
                background: 'rgba(61, 255, 79, 0.06)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid rgba(61, 255, 79, 0.25)',
              }}
            >
              <p style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '0.75rem', lineHeight: 1.6 }}>
                <strong>Consent & disclaimer:</strong><br />
                Plans are created or approved by your trainer. This app does not give medical advice,
                make diagnoses, or promise results. Your data is used only by you and your assigned trainer.
              </p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  id="ob-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: 'var(--color-brand)', width: '1.1rem', height: '1.1rem' }}
                  required
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--color-brand)', fontWeight: 600 }}>
                  I understand and consent to the above.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          {step > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setError(''); setStep((s) => s - 1); }}
              disabled={loading}
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <button
            id="onboarding-next"
            type="button"
            className="btn btn-primary btn-full"
            onClick={step < 3 ? next : submit}
            disabled={loading}
          >
            {loading ? 'Saving…' : step < 3 ? (
              <> Next <ChevronRight size={18} /> </>
            ) : (
              <> Get started <Check size={18} /> </>
            )}
          </button>
        </div>
      </div>
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
    padding: '2rem 1rem',
    gap: '1.25rem',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '420px',
  },
  stepRow: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
  },
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: 'var(--shadow-modal)',
    border: '1px solid var(--color-border)',
  },
  stepContent: {
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  heading: {
    fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text)',
  },
};
