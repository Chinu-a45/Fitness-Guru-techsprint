// src/pages/trainer/PlanBuilder.jsx
// ──────────────────────────────────────────────────────────────────
// Plan builder v2:
//   • No draft mode – every save is the active (approved) plan
//   • All plans for a client shown as "Plan 1 / Plan 2 / …" tabs
//   • Trainer can switch between plans to view or edit
//   • "Add New Plan" creates a fresh slot (copying current or blank/template)
//   • If no changes are made, the same plan applies the next day automatically
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus, Trash2, GripVertical, CheckCircle2,
  Dumbbell, Utensils, Users, LayoutTemplate,
  PenLine, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';

// ── Default plan template ─────────────────────────────────────────
const TEMPLATE = {
  workouts: [
    { name: 'Warm-up walk',         sets: '',  reps: '', duration: '10 min', note: 'Easy pace' },
    { name: 'Bodyweight squats',     sets: '3', reps: '12', duration: '', note: '' },
    { name: 'Push-ups',              sets: '3', reps: '10', duration: '', note: 'Knees allowed' },
    { name: 'Dumbbell rows',         sets: '3', reps: '10', duration: '', note: '' },
    { name: 'Plank',                 sets: '3', reps: '',  duration: '30 sec', note: '' },
    { name: 'Cool-down stretching',  sets: '',  reps: '', duration: '5 min', note: '' },
  ],
  meals: [
    { label: 'Breakfast',    description: 'Oats with banana and milk',               calories: 350 },
    { label: 'Mid-morning',  description: 'Handful of almonds',                      calories: 100 },
    { label: 'Lunch',        description: 'Dal, rice, sabzi and salad',              calories: 550 },
    { label: 'Snack',        description: 'Fruit (apple or guava)',                  calories: 80  },
    { label: 'Dinner',       description: 'Chapati, paneer / chicken curry & salad', calories: 500 },
  ],
  water_target_ml: 2500,
};

function blankExercise() { return { name: '', sets: '', reps: '', duration: '', note: '' }; }
function blankMeal()     { return { label: '', description: '', calories: '' }; }

// ── Plan index tab pill ───────────────────────────────────────────
function PlanTab({ label, active, isCurrent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.4rem 0.9rem',
        borderRadius: '2rem',
        border: `1.5px solid ${active ? 'var(--color-brand)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-brand)' : 'var(--color-surface-2)',
        color: active ? '#000000' : 'var(--color-text)',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {isCurrent && (
        <span style={{
          background: active ? 'rgba(0,0,0,0.2)' : 'rgba(61, 255, 79, 0.15)',
          color: active ? '#000000' : 'var(--color-brand)',
          fontSize: '0.65rem',
          padding: '0.1rem 0.4rem',
          borderRadius: '999px',
          fontWeight: 800,
          letterSpacing: '0.03em',
        }}>
          ACTIVE
        </span>
      )}
    </button>
  );
}

// In-memory cache for instant zero-delay navigation
let _trainerClientsCache = null;
const _clientPlansCache = new Map();

export function invalidatePlanBuilderCache(cid) {
  if (cid) _clientPlansCache.delete(cid);
  else {
    _trainerClientsCache = null;
    _clientPlansCache.clear();
  }
}

export function PlanBuilder() {
  const { clientId }   = useParams();
  const { user }       = useAuth();

  const [loading,      setLoading]      = useState(!_trainerClientsCache);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  const [clients,      setClients]      = useState(_trainerClientsCache || []);
  const [selectedId,   setSelectedId]   = useState(clientId || (_trainerClientsCache?.[0]?.id || ''));
  const [deleting,     setDeleting]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // All plans for selected client, ordered oldest → newest
  const cachedPlans = selectedId ? _clientPlansCache.get(selectedId) : null;
  const [plans,        setPlans]        = useState(cachedPlans || []);
  const [activePlanId, setActivePlanId] = useState(null);
  const [viewingIdx,   setViewingIdx]   = useState(null);

  // Editor state
  const [workouts,     setWorkouts]     = useState([]);
  const [meals,        setMeals]        = useState([]);
  const [water,        setWater]        = useState(2500);
  const [isNewPlan,    setIsNewPlan]    = useState(false);

  // ── Load trainer clients ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      if (!_trainerClientsCache) setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('trainer_id', user.id)
        .eq('role', 'client')
        .order('full_name');
      const list = data || [];
      _trainerClientsCache = list;
      setClients(list);
      setLoading(false);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    }
    init();
  }, [user.id]);

  // ── Load all plans for selected client ─────────────────────────
  const applyPlansList = useCallback((list, keepIdx) => {
    setPlans(list);
    if (list.length > 0) {
      const activePlan = [...list].sort((a, b) =>
        new Date(b.approved_at || 0) - new Date(a.approved_at || 0)
      )[0];
      const activeIdx = list.findIndex((p) => p.id === activePlan.id);
      setActivePlanId(activePlan.id);

      if (keepIdx !== undefined && keepIdx !== null && list[keepIdx]) {
        const p = list[keepIdx];
        setViewingIdx(keepIdx);
        setWorkouts(p.workouts || []);
        setMeals(p.meals || []);
        setWater(p.water_target_ml || 2500);
      } else {
        setViewingIdx(activeIdx);
        setWorkouts(activePlan.workouts || []);
        setMeals(activePlan.meals || []);
        setWater(activePlan.water_target_ml || 2500);
      }
      setIsNewPlan(false);
    } else {
      setActivePlanId(null);
      setViewingIdx(null);
      setWorkouts([]);
      setMeals([]);
      setIsNewPlan(false);
    }
  }, []);

  const loadPlans = useCallback(async (cid, keepIdx) => {
    if (!cid) {
      applyPlansList([], null);
      return;
    }

    // If cached, apply immediately!
    const cached = _clientPlansCache.get(cid);
    if (cached) {
      applyPlansList(cached, keepIdx);
    }

    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('client_id', cid)
      .order('created_at', { ascending: true });

    const list = data || [];
    _clientPlansCache.set(cid, list);
    applyPlansList(list, keepIdx);
  }, [applyPlansList]);

  useEffect(() => {
    loadPlans(selectedId);
  }, [selectedId, loadPlans]);

  // ── When user switches tabs ─────────────────────────────────────
  function selectTab(idx) {
    setViewingIdx(idx);
    setIsNewPlan(false);
    setError('');
    setSuccess('');
    const p = plans[idx];
    setWorkouts(p.workouts || []);
    setMeals(p.meals || []);
    setWater(p.water_target_ml || 2500);
  }

  // ── Start "Add new plan" ─────────────────────────────────────────
  function startNewPlan(fromTemplate = false) {
    setIsNewPlan(true);
    setViewingIdx(null);
    setError('');
    setSuccess('');
    if (fromTemplate) {
      setWorkouts(TEMPLATE.workouts.map((w) => ({ ...w })));
      setMeals(TEMPLATE.meals.map((m) => ({ ...m })));
      setWater(TEMPLATE.water_target_ml);
    } else {
      setWorkouts([]);
      setMeals([]);
      setWater(2500);
    }
  }

  // ── Load template into current editor ───────────────────────────
  function loadTemplate() {
    setWorkouts(TEMPLATE.workouts.map((w) => ({ ...w })));
    setMeals(TEMPLATE.meals.map((m) => ({ ...m })));
    setWater(TEMPLATE.water_target_ml);
    setSuccess('Template loaded – customise as needed.');
  }

  // ── Exercise helpers ────────────────────────────────────────────
  function addExercise()           { setWorkouts((p) => [...p, blankExercise()]); }
  function removeExercise(i)       { setWorkouts((p) => p.filter((_, idx) => idx !== i)); }
  function updateExercise(i, k, v) { setWorkouts((p) => p.map((ex, idx) => idx === i ? { ...ex, [k]: v } : ex)); }
  function moveExercise(i, dir)    {
    setWorkouts((p) => {
      const a = [...p], j = i + dir;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  }

  // ── Meal helpers ────────────────────────────────────────────────
  function addMeal()           { setMeals((p) => [...p, blankMeal()]); }
  function removeMeal(i)       { setMeals((p) => p.filter((_, idx) => idx !== i)); }
  function updateMeal(i, k, v) { setMeals((p) => p.map((m, idx) => idx === i ? { ...m, [k]: v } : m)); }
  function moveMeal(i, dir)    {
    setMeals((p) => {
      const a = [...p], j = i + dir;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  }

  // ── Helper: insert/update with water, fall back without if column missing ──
  async function dbInsert(payload) {
    let res = await supabase.from('plans').insert({ ...payload, water_target_ml: parseInt(water, 10) || 2500 });
    if (res.error?.message?.includes('water_target_ml')) {
      res = await supabase.from('plans').insert(payload);
    }
    return res.error;
  }
  async function dbUpdate(id, fields) {
    const waterNum = parseInt(water, 10) || 2500;
    let res = await supabase.from('plans').update({ ...fields, water_target_ml: waterNum }).eq('id', id);
    if (res.error?.message?.includes('water_target_ml')) {
      res = await supabase.from('plans').update(fields).eq('id', id);
    }
    return res.error;
  }

  // ── Save plan ───────────────────────────────────────────────────
  async function savePlan() {
    if (!selectedId) { setError('Please select a client.'); return; }
    if (workouts.length === 0 && meals.length === 0) {
      setError('Add at least one exercise or meal before saving.');
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);

    const now = new Date().toISOString();
    let dbErr;

    if (isNewPlan) {
      dbErr = await dbInsert({
        client_id:  selectedId,
        trainer_id: user.id,
        version:    plans.length + 1,
        status:     'approved',
        workouts,
        meals,
        approved_at: now,
      });
    } else if (viewingIdx !== null && plans[viewingIdx]) {
      dbErr = await dbUpdate(plans[viewingIdx].id, {
        workouts,
        meals,
        status:      'approved',
        approved_at: now,
      });
    } else {
      dbErr = await dbInsert({
        client_id:  selectedId,
        trainer_id: user.id,
        version:    1,
        status:     'approved',
        workouts,
        meals,
        approved_at: now,
      });
    }

    if (dbErr) {
      setError(dbErr.message);
    } else {
      setSuccess('✅ Plan saved and is now active for this client!');
      // keepIdx: for update keep the same tab open; for new plan focus the new last tab
      const keepIdx = isNewPlan ? null : viewingIdx;
      await loadPlans(selectedId, keepIdx);
    }

    setSaving(false);
  }

  // ── Delete plan ─────────────────────────────────────────────────
  async function deleteCurrentPlan() {
    if (viewingIdx === null || !plans[viewingIdx]) return;
    const targetPlan = plans[viewingIdx];
    const planNumber = viewingIdx + 1;

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      // 1. Delete associated completions for this plan in case cascade is restricted
      await supabase
        .from('completions')
        .delete()
        .eq('plan_id', targetPlan.id);
    } catch (_) {}

    // 2. Delete plan with .select() to verify rows were actually removed by PostgreSQL RLS
    const { data: deletedRows, error: delErr } = await supabase
      .from('plans')
      .delete()
      .eq('id', targetPlan.id)
      .select();

    if (delErr) {
      console.error('Delete plan error:', delErr);
      setError('Failed to delete plan: ' + delErr.message);
      setDeleting(false);
      setShowDeleteModal(false);
      return;
    }

    // If Supabase returned 0 rows, PostgreSQL Row Level Security silently blocked the DELETE
    if (!deletedRows || deletedRows.length === 0) {
      console.warn('0 rows deleted from plans table. RLS policy is missing in Supabase.');
      setError(
        'Supabase Row Level Security blocked deleting this plan. Run this SQL in Supabase SQL Editor:\nCREATE POLICY "Trainers can delete their own plans" ON public.plans FOR DELETE USING (trainer_id = auth.uid() OR public.is_trainer_of(client_id));'
      );
      setDeleting(false);
      setShowDeleteModal(false);
      return;
    }

    setShowDeleteModal(false);
    setDeleting(false);
    setSuccess(`✅ Plan ${planNumber} has been deleted.`);

    // After deletion, pick the next best index to view (e.g. index - 1 or 0)
    const remainingCount = plans.length - 1;
    const nextIdx = remainingCount > 0 ? Math.min(viewingIdx, remainingCount - 1) : null;
    await loadPlans(selectedId, nextIdx);
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <Spinner />
    </div>
  );

  const isEditingExisting = !isNewPlan && viewingIdx !== null;
  const viewingPlan       = isEditingExisting ? plans[viewingIdx] : null;
  const isActivePlan      = viewingPlan?.id === activePlanId;

  return (
    <div>
      {/* ── Page header ── */}
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-brand)', marginBottom: '0.25rem' }}>
        Plan Builder
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Create and manage workout &amp; meal plans for your clients
      </p>

      <ErrorMessage message={error} />
      {error && error.includes('CREATE POLICY') && (
        <div style={{
          background: 'rgba(255, 176, 32, 0.08)',
          border: '1.5px solid rgba(255, 176, 32, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
            Run this in Supabase Dashboard → SQL Editor to enable deleting plans:
          </p>
          <pre style={{
            background: '#1F2937',
            color: '#F9FAFB',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            overflowX: 'auto',
            marginBottom: '0.75rem',
            whiteSpace: 'pre-wrap',
          }}>
{`CREATE POLICY "Trainers can delete their own plans"
  ON public.plans FOR DELETE
  USING (trainer_id = auth.uid() OR public.is_trainer_of(client_id));

CREATE POLICY "Trainers can delete completions for their clients"
  ON public.completions FOR DELETE
  USING (public.is_trainer_of(client_id));`}
          </pre>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              navigator.clipboard.writeText(`CREATE POLICY "Trainers can delete their own plans"\n  ON public.plans FOR DELETE\n  USING (trainer_id = auth.uid() OR public.is_trainer_of(client_id));\n\nCREATE POLICY "Trainers can delete completions for their clients"\n  ON public.completions FOR DELETE\n  USING (public.is_trainer_of(client_id));`);
              alert('Copied SQL to clipboard! Now paste and run it in Supabase SQL Editor.');
            }}
          >
            📋 Copy SQL to Clipboard
          </button>
        </div>
      )}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── Client selector ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Users size={18} color="var(--color-brand)" />
          <h2 style={{ fontWeight: 700 }}>Select client</h2>
        </div>

        {clients.length === 0 ? (
          <EmptyState icon={Users} title="No clients yet" message="Share your invite code to add clients." />
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {clients.map((c) => {
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedId(c.id); setError(''); setSuccess(''); }}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: isSelected ? 'var(--color-brand)' : 'var(--color-surface-2)',
                    color: isSelected ? '#000000' : 'var(--color-text)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? '0 2px 10px rgba(61, 255, 79, 0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-surface-2)';
                    }
                  }}
                >
                  {c.full_name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Plan tabs + editor ── */}
      {selectedId && (
        <>
          {/* ── Plan tabs ── */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontWeight: 700, marginBottom: '0.1rem' }}>Plans</h2>
                {plans.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    No plans yet. Create one below.
                  </p>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    {plans.length} plan{plans.length > 1 ? 's' : ''} · the <strong>ACTIVE</strong> plan is shown to the client every day until changed.
                  </p>
                )}
              </div>

              {/* Add new plan button */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => startNewPlan(true)}
                  id="plan-new-from-template"
                >
                  <LayoutTemplate size={14} /> New from template
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => startNewPlan(false)}
                  id="plan-new-blank"
                >
                  <PenLine size={14} /> New blank plan
                </button>
              </div>
            </div>

            {/* Tab row */}
            {(plans.length > 0 || isNewPlan) && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {plans.map((p, idx) => (
                  <PlanTab
                    key={p.id}
                    label={`Plan ${idx + 1}`}
                    active={!isNewPlan && viewingIdx === idx}
                    isCurrent={p.id === activePlanId}
                    onClick={() => selectTab(idx)}
                  />
                ))}
                {isNewPlan && (
                  <PlanTab
                    label={`Plan ${plans.length + 1} (new)`}
                    active={true}
                    isCurrent={false}
                    onClick={() => {}}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Editor: only show when a plan is selected or being created ── */}
          {(isEditingExisting || isNewPlan || plans.length === 0) && (
            <>
              {/* Current plan info banner */}
              {isEditingExisting && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isActivePlan
                    ? 'rgba(61, 255, 79, 0.08)'
                    : 'var(--color-surface-2)',
                  border: `1px solid ${isActivePlan ? 'rgba(61, 255, 79, 0.25)' : 'var(--color-border)'}`,
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                }}>
                  {isActivePlan ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1, minWidth: '200px' }}>
                      <CheckCircle2 size={18} color="var(--color-brand)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-brand)', lineHeight: 1.3 }}>
                          This is the current active plan for this client.
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                          Applies every day until you change it or create a new plan.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1, minWidth: '200px' }}>
                      <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
                          Viewing <strong style={{ color: '#fff' }}>Plan {viewingIdx + 1}</strong> — not the active plan. Save changes to make it active.
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: '#ff6b6b',
                      border: '1px solid rgba(255, 77, 77, 0.3)',
                      background: 'rgba(255, 77, 77, 0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => setShowDeleteModal(true)}
                    id="plan-delete-banner-btn"
                    title={`Delete Plan ${viewingIdx + 1}`}
                  >
                    <Trash2 size={14} /> Delete Plan {viewingIdx + 1}
                  </button>
                </div>
              )}

              {isNewPlan && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                }}>
                  <Plus size={18} color="#60A5FA" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, color: '#60A5FA' }}>
                    Creating Plan {plans.length + 1}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    — Saving will make this the new active plan.
                  </span>
                </div>
              )}

              {plans.length === 0 && !isNewPlan && (
                /* No plans yet – show a start prompt */
                <div style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                }}>
                  <Dumbbell size={36} style={{ opacity: 0.25, margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 600, marginBottom: '1rem' }}>No plan created yet</p>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => startNewPlan(true)} id="plan-start-template">
                      <LayoutTemplate size={16} /> Start from template
                    </button>
                    <button className="btn btn-secondary" onClick={() => startNewPlan(false)} id="plan-start-blank">
                      <PenLine size={16} /> Start from scratch
                    </button>
                  </div>
                </div>
              )}

              {/* Show editor only if a plan is active or being created */}
              {(isEditingExisting || isNewPlan) && (
                <>


                  {/* ── Workouts ── */}
                  <div className="card" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Dumbbell size={18} color="var(--color-brand)" />
                        <h2 style={{ fontWeight: 700 }}>Workouts</h2>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={addExercise} id="plan-add-exercise">
                        <Plus size={14} /> Add exercise
                      </button>
                    </div>

                    {workouts.length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                        No exercises yet. Add one or load a template.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {workouts.map((ex, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', paddingTop: '0.5rem' }}>
                              <button type="button" onClick={() => moveExercise(i, -1)} style={iconBtnStyle} disabled={i === 0} aria-label="Move up">▲</button>
                              <GripVertical size={14} color="var(--color-text-muted)" />
                              <button type="button" onClick={() => moveExercise(i, 1)} style={iconBtnStyle} disabled={i === workouts.length - 1} aria-label="Move down">▼</button>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <input className="form-input" placeholder="Exercise name *" value={ex.name}
                                onChange={(e) => updateExercise(i, 'name', e.target.value)} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                <input className="form-input" placeholder="Sets" value={ex.sets}
                                  onChange={(e) => updateExercise(i, 'sets', e.target.value)} />
                                <input className="form-input" placeholder="Reps" value={ex.reps}
                                  onChange={(e) => updateExercise(i, 'reps', e.target.value)} />
                                <input className="form-input" placeholder="Duration" value={ex.duration}
                                  onChange={(e) => updateExercise(i, 'duration', e.target.value)} />
                              </div>
                              <input className="form-input" placeholder="Trainer note (optional)" value={ex.note}
                                onChange={(e) => updateExercise(i, 'note', e.target.value)} />
                            </div>
                            <button type="button" onClick={() => removeExercise(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '0.25rem' }}
                              aria-label="Remove exercise">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Meals ── */}
                  <div className="card" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Utensils size={18} color="var(--color-brand)" />
                        <h2 style={{ fontWeight: 700 }}>Meals</h2>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={addMeal} id="plan-add-meal">
                        <Plus size={14} /> Add meal
                      </button>
                    </div>

                    {meals.length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                        No meals yet.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {meals.map((meal, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.875rem', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', paddingTop: '0.5rem' }}>
                              <button type="button" onClick={() => moveMeal(i, -1)} style={iconBtnStyle} disabled={i === 0}>▲</button>
                              <GripVertical size={14} color="var(--color-text-muted)" />
                              <button type="button" onClick={() => moveMeal(i, 1)} style={iconBtnStyle} disabled={i === meals.length - 1}>▼</button>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <input className="form-input" placeholder="Label (e.g. Breakfast)" value={meal.label}
                                  onChange={(e) => updateMeal(i, 'label', e.target.value)} />
                                <input className="form-input" placeholder="Calories (optional)" type="number" value={meal.calories}
                                  onChange={(e) => updateMeal(i, 'calories', e.target.value)} />
                              </div>
                              <input className="form-input" placeholder="Meal description *" value={meal.description}
                                onChange={(e) => updateMeal(i, 'description', e.target.value)} />
                            </div>
                            <button type="button" onClick={() => removeMeal(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '0.25rem' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Water target ── */}
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label" htmlFor="plan-water">Daily water target (ml)</label>
                    <input id="plan-water" type="number" className="form-input" style={{ maxWidth: '200px' }}
                      value={water} onChange={(e) => setWater(e.target.value)} min={500} max={6000} step={250} />
                  </div>

                  {/* ── Save & Actions ── */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '1.25rem' }}>
                    <button
                      id="plan-save"
                      className="btn btn-primary"
                      onClick={savePlan}
                      disabled={saving || deleting}
                      style={{ minWidth: '170px' }}
                    >
                      <CheckCircle2 size={16} />
                      {saving ? 'Saving…' : isNewPlan ? `Save as Plan ${plans.length + 1}` : 'Save & Set Active'}
                    </button>

                    {isEditingExisting && (
                      <button
                        type="button"
                        id="plan-delete-bottom-btn"
                        className="btn btn-ghost"
                        style={{
                          color: 'var(--color-error)',
                          border: '1.5px solid #FCA5A5',
                          background: '#FFF1F2',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          cursor: 'pointer',
                        }}
                        onClick={() => setShowDeleteModal(true)}
                        disabled={saving || deleting}
                      >
                        <Trash2 size={16} />
                        Delete Plan {viewingIdx + 1}
                      </button>
                    )}

                    {isNewPlan && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setIsNewPlan(false);
                          if (plans.length > 0) {
                            const activeIdx = plans.findIndex((p) => p.id === activePlanId);
                            selectTab(activeIdx >= 0 ? activeIdx : 0);
                          }
                        }}
                        disabled={saving}
                      >
                        Discard new plan
                      </button>
                    )}

                    {(isNewPlan || (!isActivePlan && isEditingExisting)) && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Saving will make this plan the active one shown to the client.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Prompt to select a tab if none is active ── */}
          {!isEditingExisting && !isNewPlan && plans.length > 0 && (
            <div className="empty-state" style={{ marginTop: '1rem' }}>
              <Dumbbell style={{ width: '2.5rem', height: '2.5rem', opacity: 0.25 }} />
              <p style={{ fontWeight: 600 }}>Select a plan tab above to view or edit it</p>
            </div>
          )}
        </>
      )}

      {/* ── Prompt when no client selected ── */}
      {!selectedId && clients.length > 0 && (
        <div className="empty-state" style={{ marginTop: '2rem' }}>
          <Dumbbell style={{ width: '3rem', height: '3rem', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>Select a client above to build their plan</p>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '440px',
              width: '100%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(255, 77, 77, 0.15)',
                  border: '1px solid rgba(255, 77, 77, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} color="var(--color-error)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                  Delete Plan {viewingIdx !== null ? viewingIdx + 1 : ''}?
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Client: {clients.find((c) => c.id === selectedId)?.full_name || 'Selected Client'}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Are you sure you want to delete this plan? If this plan is currently active, the most recently saved remaining plan will automatically become active. This cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'var(--color-error)',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                }}
                onClick={deleteCurrentPlan}
                disabled={deleting}
                id="confirm-delete-plan-btn"
              >
                <Trash2 size={15} />
                {deleting ? 'Deleting…' : `Yes, Delete Plan ${viewingIdx !== null ? viewingIdx + 1 : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-muted)', fontSize: '0.7rem', padding: '0.1rem',
};
