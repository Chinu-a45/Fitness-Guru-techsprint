// src/pages/client/TodayPlan.jsx
// ──────────────────────────────────────────────────────────────────
// Displays the client's latest approved plan:
//   • Workout list (exercise, sets, reps, trainer note) – tick-able
//   • Meal list (breakfast, lunch, snack, dinner, water) – tick-able
// All ticks are persisted to the 'completions' table.
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  Dumbbell, Utensils, CheckCircle2, Droplets, Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { todayISO } from '../../lib/utils';

// In-memory cache for instant zero-delay navigation
let _todayPlanCache = null;

export function invalidateTodayPlanCache() {
  _todayPlanCache = null;
}

export function TodayPlan() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(!_todayPlanCache);
  const [saving, setSaving] = useState('');   // key of item being saved
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(_todayPlanCache?.plan || null);
  const [completions, setCompletions] = useState(_todayPlanCache?.completions || {});   // {item_key: bool}

  async function load(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError('');
    const today = todayISO();

    try {
      // Latest approved plan
      const { data: planData, error: planErr } = await supabase
        .from('plans')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planErr) { setError(planErr.message); setLoading(false); return; }
      setPlan(planData);

      const map = {};
      if (planData) {
        // Load today's completions
        const { data: comps } = await supabase
          .from('completions')
          .select('item_key, done')
          .eq('client_id', user.id)
          .eq('plan_id', planData.id)
          .eq('date', today);

        (comps || []).forEach((c) => { map[c.item_key] = c.done; });
        setCompletions(map);
      }

      _todayPlanCache = { plan: planData, completions: map };
    } catch (err) {
      console.error('Error loading today plan:', err);
      setError(err.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(Boolean(_todayPlanCache));
  }, [user.id]);

  async function toggleItem(itemType, itemKey) {
    if (saving) return;
    const today = todayISO();
    const current = completions[itemKey] ?? false;
    const next = !current;

    setSaving(itemKey);
    // Optimistic update
    setCompletions((prev) => ({ ...prev, [itemKey]: next }));

    const { error } = await supabase
      .from('completions')
      .upsert(
        {
          client_id: user.id,
          plan_id: plan.id,
          date: today,
          item_type: itemType,
          item_key: itemKey,
          done: next,
        },
        { onConflict: 'client_id,date,item_type,item_key' }
      );

    if (error) {
      // Revert on failure
      setCompletions((prev) => ({ ...prev, [itemKey]: current }));
      setError(error.message);
    }
    setSaving('');
  }

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <Spinner />
    </div>
  );

  if (!plan) return (
    <div className="page-content">
      <EmptyState
        icon={Dumbbell}
        title="No approved plan yet"
        message="Your trainer will create and approve a plan for you soon. Check back shortly!"
      />
    </div>
  );

  const exercises = plan.workouts || [];
  const meals = plan.meals || [];
  const water = plan.water_target_ml || 2000;

  const totalItems = exercises.length + meals.length;
  const doneItems = Object.values(completions).filter(Boolean).length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="page-content">
      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)' }}>
          Today's Plan
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <span className="badge badge-green">
            <CheckCircle2 size={11} /> Approved by trainer
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {doneItems}/{totalItems} done
          </span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{
          height: '8px', borderRadius: '999px',
          background: 'var(--color-border)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: pct === 100
              ? 'var(--color-success)'
              : 'linear-gradient(90deg, var(--color-brand) 0%, var(--color-brand-light) 100%)',
            borderRadius: '999px',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          {pct}% of today's plan completed
        </p>
      </div>

      <ErrorMessage message={error} />

      {/* ── Disclaimer ── */}
      <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.8rem' }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        Plans are created or approved by your trainer. This app does not give medical advice.
      </div>

      {/* ── Workouts ── */}
      {exercises.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Dumbbell size={18} color="var(--color-brand)" />
            <h2 className="section-heading" style={{ margin: 0 }}>Workouts</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {exercises.map((ex, i) => {
              const key = `workout_${i}`;
              const done = completions[key] ?? false;
              return (
                <button
                  key={key}
                  onClick={() => toggleItem('workout', key)}
                  className={`plan-item ${done ? 'done' : ''}`}
                  disabled={saving === key}
                  aria-pressed={done}
                  aria-label={`Mark ${ex.name} as ${done ? 'incomplete' : 'complete'}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer' }}
                >
                  <div className="plan-item-check">
                    {done && <CheckCircle2 size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontWeight: 700,
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'var(--color-text-muted)' : 'var(--color-text)',
                    }}>
                      {ex.name}
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                      {[ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} reps`, ex.duration].filter(Boolean).join(' · ')}
                    </p>
                    {ex.note && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-brand)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                        💬 {ex.note}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Meals ── */}
      {meals.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Utensils size={18} color="var(--color-brand)" />
            <h2 className="section-heading" style={{ margin: 0 }}>Meals</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {meals.map((meal, i) => {
              const key = `meal_${i}`;
              const done = completions[key] ?? false;
              return (
                <button
                  key={key}
                  onClick={() => toggleItem('meal', key)}
                  className={`plan-item ${done ? 'done' : ''}`}
                  disabled={saving === key}
                  aria-pressed={done}
                  aria-label={`Mark ${meal.label} as ${done ? 'incomplete' : 'complete'}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', cursor: 'pointer' }}
                >
                  <div className="plan-item-check">
                    {done && <CheckCircle2 size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase',
                      color: 'var(--color-text-muted)', letterSpacing: '0.06em',
                    }}>
                      {meal.label}
                    </p>
                    <p style={{
                      fontWeight: 700,
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'var(--color-text-muted)' : 'var(--color-text)',
                    }}>
                      {meal.description}
                    </p>
                    {meal.calories && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                        ~{meal.calories} kcal
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Water target ── */}
      <div
        className="card card-sm"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: '#EFF6FF', borderColor: '#BFDBFE',
        }}
      >
        <Droplets size={24} color="#2563EB" />
        <div>
          <p style={{ fontWeight: 700 }}>Water target</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Drink {(water / 1000).toFixed(1)} litres today
          </p>
        </div>
      </div>

      {/* Celebration */}
      {pct === 100 && (
        <div
          className="card"
          style={{
            marginTop: '1rem', textAlign: 'center',
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '1.5px solid #BBF7D0',
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>🎉</div>
          <p style={{ fontWeight: 700, color: '#15803D', fontSize: '1.1rem' }}>
            Amazing! You completed today's plan!
          </p>
        </div>
      )}
    </div>
  );
}
