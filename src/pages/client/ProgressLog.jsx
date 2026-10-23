// src/pages/client/ProgressLog.jsx
// ──────────────────────────────────────────────────────────────────
// Allows the client to log weight (required), waist (optional),
// and sleep hours (optional).
// Validates ranges: weight 30-250 kg, waist 50-200 cm, sleep 0-24 h.
// Shows history of last 20 logs with date stamps.
// Unit sanity checks: warns if weight looks like lbs or jumps
// abruptly, and if waist looks like inches instead of cm.
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { Scale, Ruler, Plus, ChevronRight, AlertTriangle, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import { todayISO, fmtDate } from '../../lib/utils';

// ── Sleep quality badge helper ─────────────────────────────────────
function sleepQuality(h) {
  if (h === '' || h === null || h === undefined) return null;
  const n = parseFloat(h);
  if (isNaN(n)) return null;
  if (n < 5)  return { label: 'Poor',  color: 'var(--color-error,  #FF4D4D)', emoji: '😞' };
  if (n < 7)  return { label: 'Fair',  color: 'var(--color-warning, #FFB020)', emoji: '😐' };
  if (n <= 9) return { label: 'Great', color: 'var(--color-success, #22C55E)', emoji: '😴' };
  return          { label: 'Long',  color: '#93C5FD', emoji: '🛌' };
}

// Weight: warn if abrupt jump > 5 kg from last log
const WEIGHT_JUMP_THRESHOLD_KG = 5;
// Weight: values that look like lbs (very common lbs weights tend to
// be >100 while most kg users in a gym context are 40–120 kg)
const WEIGHT_LBS_SUSPICION_MIN = 100; // if entered value > this AND last log was < this → likely lbs
// Waist: typical adult waist in *inches* is 25–50 in. In cm that's
// 64–127 cm.  If someone types 28–55 with no prior cm log > 60, flag it.
const WAIST_INCHES_MAX = 60;  // values ≤ this are suspicious (too small for cm)
const WAIST_JUMP_THRESHOLD_CM = 10; // warn on jumps > 10 cm

// ── Inline confirmation modal ───────────────────────────────────
function SanityModal({ warnings, onConfirm, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sanity-modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 1rem)',
          padding: '1.75rem 1.5rem',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <AlertTriangle size={22} color="var(--color-warning, #FFB020)" />
          <h2
            id="sanity-modal-title"
            style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}
          >
            Double-check your values
          </h2>
        </div>

        {/* Warning list */}
        <ul style={{ margin: '0 0 1.25rem 0', padding: '0 0 0 0.25rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {warnings.map((w, i) => (
            <li
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                fontSize: '0.88rem', lineHeight: 1.5,
                color: 'var(--color-text-muted)',
              }}
            >
              <span style={{ color: 'var(--color-warning, #FFB020)', marginTop: '0.1rem', flexShrink: 0 }}>⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>

        <p style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
          Are you sure you are logging in the correct units?
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="sanity-fix-btn"
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={onCancel}
            autoFocus
          >
            Let me fix it
          </button>
          <button
            id="sanity-confirm-btn"
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            Yes, save anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProgressLog() {
  const { user } = useAuth();

  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [weight, setWeight] = useState('');
  const [waist,  setWaist]  = useState('');
  const [sleep,  setSleep]  = useState('');
  const [date,   setDate]   = useState(todayISO());
  const [formErr, setFormErr] = useState({});

  // Sanity-check modal state
  const [sanityWarnings, setSanityWarnings] = useState([]);
  const [showSanity,     setShowSanity]     = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('client_id', user.id)
      .order('date', { ascending: false })
      .limit(20);
    if (error) setError(error.message);
    else setLogs(data || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  function validate() {
    const errs = {};

    // Range checks (only if a value was entered)
    if (weight !== '') {
      const w = parseFloat(weight);
      if (isNaN(w) || w < 30 || w > 250)
        errs.weight = 'Enter a weight between 30 and 250 kg.';
    }
    if (waist !== '') {
      const wc = parseFloat(waist);
      if (isNaN(wc) || wc < 50 || wc > 200)
        errs.waist = 'Enter a waist measurement between 50 and 200 cm.';
    }
    if (sleep !== '') {
      const s = parseFloat(sleep);
      if (isNaN(s) || s < 0 || s > 24)
        errs.sleep = 'Enter sleep hours between 0 and 24.';
    }
    if (!date) errs.date = 'Date is required.';

    // At least one metric must be filled
    if (weight === '' && waist === '' && sleep === '')
      errs._atLeastOne = 'Please fill in at least one of: weight, waist, or sleep hours.';

    return errs;
  }

  /**
   * Runs sanity checks against the last known log.
   * Returns an array of warning strings (empty = all good).
   */
  function buildSanityWarnings() {
    const warnings = [];
    const w = parseFloat(weight);
    const wc = waist !== '' ? parseFloat(waist) : null;

    // Find the most recent log that is NOT the same date (so we compare against history)
    const lastLog = logs.find(l => l.date !== date);

    // ── Weight checks ───────────────────────────────────────────
    if (!isNaN(w)) {
      // 1. Looks like lbs: entered value is > WEIGHT_LBS_SUSPICION_MIN
      //    AND (no prior log OR prior log was well below this value)
      const lastWeight = lastLog?.weight_kg;
      const looksLikeLbs =
        w > WEIGHT_LBS_SUSPICION_MIN &&
        (lastWeight == null || lastWeight < WEIGHT_LBS_SUSPICION_MIN);

      if (looksLikeLbs) {
        const kgEquiv = (w * 0.453592).toFixed(1);
        warnings.push(
          `Your weight (${w} kg) seems unusually high. Did you mean ${kgEquiv} kg ` +
          `(i.e. ${w} lbs)? Please confirm you are logging in kilograms.`
        );
      } else if (lastWeight != null) {
        // 2. Abrupt jump: more than WEIGHT_JUMP_THRESHOLD_KG from last entry
        const diff = Math.abs(w - lastWeight);
        if (diff > WEIGHT_JUMP_THRESHOLD_KG && !looksLikeLbs) {
          warnings.push(
            `Your weight changed by ${diff.toFixed(1)} kg since your last log ` +
            `(${lastWeight} kg → ${w} kg). That's a big jump — are you logging in kg?`
          );
        }
      }
    }

    // ── Waist checks ────────────────────────────────────────────
    if (wc !== null && !isNaN(wc)) {
      const lastWaist = lastLog?.waist_cm;

      // 1. Looks like inches: value ≤ WAIST_INCHES_MAX (e.g. 32, 34)
      const looksLikeInches =
        wc <= WAIST_INCHES_MAX &&
        (lastWaist == null || lastWaist <= WAIST_INCHES_MAX);

      if (looksLikeInches) {
        const cmEquiv = (wc * 2.54).toFixed(1);
        warnings.push(
          `Your waist measurement (${wc} cm) looks like it could be in inches. ` +
          `${wc} inches ≈ ${cmEquiv} cm. Please confirm you are logging in centimetres.`
        );
      } else if (lastWaist != null) {
        // 2. Large jump in waist
        const diff = Math.abs(wc - lastWaist);
        if (diff > WAIST_JUMP_THRESHOLD_CM) {
          warnings.push(
            `Your waist changed by ${diff.toFixed(1)} cm since your last log ` +
            `(${lastWaist} cm → ${wc} cm). Are you sure you are logging in centimetres?`
          );
        }
      }
    }

    return warnings;
  }

  async function persistLog() {
    setSaving(true);
    const { error } = await supabase.from('logs').upsert(
      {
        client_id:   user.id,
        date,
        weight_kg:   parseFloat(weight),
        waist_cm:    waist !== '' ? parseFloat(waist) : null,
        sleep_hours: sleep !== '' ? parseFloat(sleep) : null,
      },
      { onConflict: 'client_id,date' }
    );

    if (error) {
      setError(error.message);
    } else {
      setSuccess('✅ Log saved!');
      setWeight('');
      setWaist('');
      setSleep('');
      setDate(todayISO());
      loadLogs();
    }
    setSaving(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errs = validate();
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;

    // Run sanity checks — show modal if any warnings
    const warnings = buildSanityWarnings();
    if (warnings.length > 0) {
      setSanityWarnings(warnings);
      setShowSanity(true);
      return; // wait for user to confirm or cancel
    }

    await persistLog();
  }

  function handleSanityConfirm() {
    setShowSanity(false);
    setSanityWarnings([]);
    persistLog();
  }

  function handleSanityCancel() {
    setShowSanity(false);
    setSanityWarnings([]);
  }

  return (
    <div className="page-content">
      {/* ── Sanity check confirmation modal ── */}
      {showSanity && (
        <SanityModal
          warnings={sanityWarnings}
          onConfirm={handleSanityConfirm}
          onCancel={handleSanityCancel}
        />
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)' }}>
          Progress Log
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Log your weight, waist &amp; sleep
        </p>
      </div>

      {/* ── Log form card ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          <Plus size={18} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Add entry
        </h2>

        <ErrorMessage message={error} />

        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }} role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="log-date">Date</label>
            <input
              id="log-date"
              type="date"
              className={`form-input${formErr.date ? ' error' : ''}`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayISO()}
            />
            {formErr.date && <p className="form-error">{formErr.date}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Weight */}
            <div className="form-group">
              <label className="form-label" htmlFor="log-weight">
                <Scale size={14} style={{ verticalAlign: 'middle' }} /> Weight (kg)
              </label>
              <input
                id="log-weight"
                type="number"
                className={`form-input${formErr.weight ? ' error' : ''}`}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 72.5 (optional)"
                step="0.1"
                min={30}
                max={250}
              />
              {formErr.weight && <p className="form-error">{formErr.weight}</p>}
            </div>

            {/* Waist (optional) */}
            <div className="form-group">
              <label className="form-label" htmlFor="log-waist">
                <Ruler size={14} style={{ verticalAlign: 'middle' }} /> Waist (cm)
              </label>
              <input
                id="log-waist"
                type="number"
                className={`form-input${formErr.waist ? ' error' : ''}`}
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                placeholder="Optional"
                step="0.5"
                min={50}
                max={200}
              />
              {formErr.waist && <p className="form-error">{formErr.waist}</p>}
            </div>
          </div>

          {/* Sleep hours (optional) */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <label className="form-label" htmlFor="log-sleep" style={{ margin: 0 }}>
                <Moon size={14} style={{ verticalAlign: 'middle' }} /> Sleep last night (hours)
              </label>
              {sleepQuality(sleep) && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: sleepQuality(sleep).color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'color 0.2s',
                  }}
                >
                  {sleepQuality(sleep).emoji} {sleepQuality(sleep).label}
                </span>
              )}
            </div>
            <input
              id="log-sleep"
              type="number"
              className={`form-input${formErr.sleep ? ' error' : ''}`}
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              placeholder="e.g. 7.5 (optional)"
              step="0.5"
              min={0}
              max={24}
            />
            {formErr.sleep && <p className="form-error">{formErr.sleep}</p>}
          </div>

          {formErr._atLeastOne && (
            <p className="form-error" style={{ textAlign: 'center', fontSize: '0.88rem' }}>
              {formErr._atLeastOne}
            </p>
          )}
          <p className="form-hint">Log any combination — all fields are optional, but fill at least one.</p>

          <button
            id="log-submit"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      </div>

      {/* ── View charts link ── */}
      <Link
        to="/client/charts"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          background: 'rgba(31,77,58,0.06)',
          borderRadius: 'var(--radius-md)',
          textDecoration: 'none',
          marginBottom: '1.5rem',
        }}
        id="log-view-charts"
      >
        <p style={{ fontWeight: 600, color: 'var(--color-brand)' }}>View progress charts</p>
        <ChevronRight size={18} color="var(--color-brand)" />
      </Link>

      {/* ── Recent logs list ── */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Recent entries</h2>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No entries yet"
          message="Log your first weight entry above to start tracking progress."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {logs.map((log) => {
            const sq = log.sleep_hours != null ? sleepQuality(log.sleep_hours) : null;
            return (
              <div
                key={log.id}
                className="card card-sm"
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ fontWeight: 600 }}>{fmtDate(log.date)}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                    {log.waist_cm ? `Waist: ${log.waist_cm} cm` : 'No waist'}
                    {log.sleep_hours != null && (
                      <span style={{ marginLeft: '0.5rem', color: sq?.color }}>
                        · {sq?.emoji} {log.sleep_hours}h sleep
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-brand)' }}>
                    {log.weight_kg} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>kg</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
