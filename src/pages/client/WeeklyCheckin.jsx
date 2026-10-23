// src/pages/client/WeeklyCheckin.jsx
// ──────────────────────────────────────────────────────────────────
// Weekly check-in form:
//   • Effort rating 1-5
//   • Energy rating 1-5
//   • Free-text note
// One submission per week (upsert keyed on client_id + week_start).
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { todayISO, weekStart } from '../../lib/utils';

const EFFORT_LABELS = ['', 'Very easy', 'Easy', 'Moderate', 'Hard', 'Very hard'];
const ENERGY_LABELS = ['', 'Exhausted', 'Low', 'Okay', 'Good', 'Energised'];

export function WeeklyCheckin() {
  const { user } = useAuth();

  const currentWeek = weekStart(todayISO());

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [submitted,  setSubmitted]  = useState(false);
  const [existing,   setExisting]   = useState(null);

  const [effort, setEffort] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [note,   setNote]   = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('checkins')
      .select('*')
      .eq('client_id', user.id)
      .eq('week_start', currentWeek)
      .maybeSingle();

    if (data) {
      setExisting(data);
      setEffort(data.effort || 0);
      setEnergy(data.energy || 0);
      setNote(data.note   || '');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [user.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (effort === 0) { setError('Please rate your effort.'); return; }
    if (energy === 0) { setError('Please rate your energy.'); return; }

    setSaving(true);
    const { error } = await supabase.from('checkins').upsert(
      {
        client_id:  user.id,
        week_start: currentWeek,
        effort,
        energy,
        note:       note.trim() || null,
        reviewed:   false,
      },
      { onConflict: 'client_id,week_start' }
    );

    if (error) setError(error.message);
    else setSubmitted(true);

    setSaving(false);
  }

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <Spinner />
    </div>
  );

  if (submitted) return (
    <div className="page-content">
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <CheckCircle2 size={56} color="var(--color-success)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-brand)' }}>
          Check-in saved!
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Your trainer will review it soon. Keep going! 💪
        </p>
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)' }}>
          Weekly Check-in
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          {existing ? 'Update this week\'s check-in' : 'How did your week go?'}
        </p>
      </div>

      <ErrorMessage message={error} />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* ── Effort rating ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Star size={18} color="var(--color-gold)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Effort this week</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            How hard did you push yourself overall?
          </p>
          <div className="rating-row" style={{ marginBottom: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`rating-btn${effort === n ? ' selected' : ''}`}
                onClick={() => setEffort(n)}
                aria-label={`Effort: ${EFFORT_LABELS[n]}`}
                aria-pressed={effort === n}
                id={`effort-${n}`}
              >
                {n}
              </button>
            ))}
          </div>
          {effort > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-brand)', fontWeight: 600 }}>
              {EFFORT_LABELS[effort]}
            </p>
          )}
        </div>

        {/* ── Energy rating ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Energy levels this week</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            How energised did you feel day-to-day?
          </p>
          <div className="rating-row" style={{ marginBottom: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`rating-btn${energy === n ? ' selected' : ''}`}
                onClick={() => setEnergy(n)}
                aria-label={`Energy: ${ENERGY_LABELS[n]}`}
                aria-pressed={energy === n}
                id={`energy-${n}`}
              >
                {n}
              </button>
            ))}
          </div>
          {energy > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-brand)', fontWeight: 600 }}>
              {ENERGY_LABELS[energy]}
            </p>
          )}
        </div>

        {/* ── Note ── */}
        <div className="form-group">
          <label className="form-label" htmlFor="checkin-note">
            Anything to share? <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span>
          </label>
          <textarea
            id="checkin-note"
            className="form-textarea"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="E.g. struggled with energy mid-week, missed one session…"
          />
        </div>

        <button
          id="checkin-submit"
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={saving}
        >
          {saving ? 'Saving…' : existing ? 'Update check-in' : 'Submit check-in'}
        </button>
      </form>
    </div>
  );
}
