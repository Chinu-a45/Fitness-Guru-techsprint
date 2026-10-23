// src/pages/trainer/ClientDetail.jsx
// ──────────────────────────────────────────────────────────────────
// Trainer view of a single client:
//   • Profile + limitations note (trainer-only)
//   • Current plan info with approve button
//   • Adherence + weight chart
//   • Check-in history
//   • Note box (trainer can send a note)
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, ClipboardList, AlertTriangle,
  Scale, CheckCircle2, Layers, MessageSquare,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { FLAG_CONFIG, FLAG_REASONS } from '../../lib/flagConfig';
import { calcAdherence, todayISO, addDays, weekStart, fmtDate, fmtDateTime } from '../../lib/utils';

function shortDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// In-memory cache for instant zero-delay client detail navigation
const _clientDetailCache = new Map();

export function invalidateClientDetailCache(id) {
  if (id) _clientDetailCache.delete(id);
  else _clientDetailCache.clear();
}

export function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const cached = _clientDetailCache.get(id);

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const [client, setClient] = useState(cached?.client || null);
  const [plan, setPlan] = useState(cached?.plan || null);
  const [flags, setFlags] = useState(cached?.flags || []);
  const [weightData, setWeightData] = useState(cached?.weightData || []);
  const [checkins, setCheckins] = useState(cached?.checkins || []);
  const [notes, setNotes] = useState(cached?.notes || []);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [planCount, setPlanCount] = useState(cached?.planCount || 0);
  const [adherence, setAdherence] = useState(cached?.adherence || 0);
  const notesEndRef = useRef(null);

  async function load(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError('');

    try {
      // 1. Client profile
      const { data: clientData, error: cErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('trainer_id', user.id)
        .maybeSingle();

      if (cErr || !clientData) {
        setError('Client not found or not assigned to you.');
        setLoading(false);
        return;
      }

      setClient(clientData);

      const thisWeek = weekStart(todayISO());
      const today = todayISO();

      // 2–7: Run remaining sub-queries in PARALLEL!
      const [plansRes, compsRes, logsRes, ciRes, notesRes, lastActRes, recentLogRes] = await Promise.all([
        supabase
          .from('plans')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('completions')
          .select('done')
          .eq('client_id', id)
          .gte('date', thisWeek),
        supabase
          .from('logs')
          .select('date, weight_kg')
          .eq('client_id', id)
          .order('date', { ascending: true })
          .limit(20),
        supabase
          .from('checkins')
          .select('*')
          .eq('client_id', id)
          .order('week_start', { ascending: false })
          .limit(8),
        supabase
          .from('notes')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('completions')
          .select('date')
          .eq('client_id', id)
          .eq('done', true)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('logs')
          .select('date')
          .eq('client_id', id)
          .gte('date', addDays(today, -FLAG_CONFIG.weightNotLoggedWeeks * 7))
          .limit(1)
          .maybeSingle(),
      ]);

      const planList = plansRes.data || [];
      const activePlan = planList[0] || null;
      const comps = compsRes.data || [];
      const calculatedAdh = calcAdherence(comps);
      const formattedWeights = (logsRes.data || []).map((l) => ({
        date: shortDate(l.date),
        weight: l.weight_kg,
      }));
      const ciData = ciRes.data || [];
      const notesData = notesRes.data || [];
      const lastActComp = lastActRes.data;
      const recentLog = recentLogRes.data;

      // Flags
      const reasons = [];
      if (!lastActComp) {
        reasons.push(FLAG_REASONS.inactive);
      } else {
        const days = Math.floor((new Date(today) - new Date(lastActComp.date)) / 86400000);
        if (days >= FLAG_CONFIG.inactiveDays) reasons.push(FLAG_REASONS.inactive);
      }
      if (comps && calculatedAdh < FLAG_CONFIG.lowAdherencePct && comps.length > 0) {
        reasons.push(FLAG_REASONS.lowAdherence);
      }
      if (!recentLog) {
        reasons.push(FLAG_REASONS.noWeight);
      }
      if (
        ciData.length >= FLAG_CONFIG.highEffortConsecutive &&
        ciData.slice(0, FLAG_CONFIG.highEffortConsecutive).every((c) => c.effort >= FLAG_CONFIG.highEffortThreshold)
      ) {
        reasons.push(FLAG_REASONS.highEffort);
      }

      const clientDetailObj = {
        client: clientData,
        plan: activePlan,
        planCount: planList.length,
        adherence: calculatedAdh,
        weightData: formattedWeights,
        checkins: ciData,
        notes: notesData,
        flags: reasons,
      };

      _clientDetailCache.set(id, clientDetailObj);

      setPlanCount(planList.length);
      setPlan(activePlan);
      setAdherence(calculatedAdh);
      setWeightData(formattedWeights);
      setCheckins(ciData);
      setNotes(notesData);
      setFlags(reasons);
    } catch (err) {
      console.error('Error loading client detail:', err);
      setError(err.message || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(Boolean(_clientDetailCache.get(id)));

    // Supabase Realtime subscription for incoming notes from this client
    const channel = supabase
      .channel(`notes-trainer-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `client_id=eq.${id}`,
        },
        (payload) => {
          setNotes((prev) => {
            if (prev.some((n) => n.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user.id]);

  // Auto-scroll chat to bottom when notes update
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  async function sendNote() {
    if (!note.trim() || sending) return;
    const noteText = note.trim();
    setSending(true);
    setNote('');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        client_id: id,
        author_id: user.id,
        body: noteText,
      })
      .select()
      .single();

    if (error) {
      alert('Error sending note: ' + error.message);
      setNote(noteText); // restore note on failure
    } else if (data) {
      setNotes((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev;
        return [...prev, data];
      });
    }
    setSending(false);
  }

  // No inline approval needed – all plans are saved as approved via PlanBuilder

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><Spinner /></div>;
  if (!client) return <ErrorMessage message="Client not found." />;

  const GOAL_MAP = { fat_loss: 'Fat Loss', strength: 'Strength', general: 'General Fitness' };
  const DIET_MAP = { veg: 'Vegetarian', non_veg: 'Non-Veg', eggetarian: 'Eggetarian' };

  return (
    <div>
      {/* Back link */}
      <Link to="/trainer/clients" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> All clients
      </Link>

      <ErrorMessage message={error} />

      {/* ── Client header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '4rem', height: '4rem', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '1.4rem', flexShrink: 0,
        }}>
          {client.full_name?.[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)' }}>{client.full_name}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {GOAL_MAP[client.goal] || '—'} · {DIET_MAP[client.diet_pref] || '—'} ·{' '}
            {client.height_cm && `${client.height_cm} cm`}
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-brand)' }}>{adherence}%</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>adherence</span>
          </div>
          <Link
            to={`/trainer/chat?client=${id}`}
            className="btn btn-sm"
            style={{
              background: '#DCF8C6',
              color: '#075E54',
              border: '1px solid #BBF7D0',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '999px',
              textDecoration: 'none',
              fontSize: '0.75rem',
            }}
          >
            <MessageSquare size={13} /> Chat with {client.full_name?.split(' ')[0]}
          </Link>
        </div>
      </div>

      {/* ── Flags ── */}
      {flags.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            borderLeft: '4px solid var(--color-warning)',
            background: 'rgba(255, 176, 32, 0.08)',
            borderColor: 'rgba(255, 176, 32, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={16} color="var(--color-warning)" />
            <p style={{ fontWeight: 700, color: 'var(--color-warning)' }}>Follow-up flags</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {flags.map((r) => <span key={r} className="badge badge-gold">{r}</span>)}
          </div>
        </div>
      )}

      {/* ── Limitations note ── */}
      {client.limitations_note && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            borderLeft: '4px solid var(--color-error)',
            background: 'rgba(255, 77, 77, 0.08)',
            borderColor: 'rgba(255, 77, 77, 0.25)',
          }}
        >
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-error)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Limitations / Injuries (trainer-only)
          </p>
          <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>{client.limitations_note}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {/* ── Current plan ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ClipboardList size={18} color="var(--color-brand)" />
            <h2 style={{ fontWeight: 700 }}>Current plan</h2>
          </div>

          {!plan ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>No plan created yet.</div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              {/* Active badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge badge-green">
                  <CheckCircle2 size={11} /> Active
                </span>
                {planCount > 1 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <Layers size={12} /> Plan {planCount} of {planCount}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {(plan.workouts || []).length} exercises · {(plan.meals || []).length} meals
              </p>
              {plan.approved_at && (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Active since: {fmtDate(plan.approved_at.slice(0, 10))}
                </p>
              )}
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                This plan repeats daily until a new one is saved.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link
              to={`/trainer/plans/${id}`}
              className="btn btn-secondary btn-sm"
              id="client-detail-edit-plan"
            >
              <ClipboardList size={14} /> {plan ? `Manage plans (${planCount})` : 'Create plan'}
            </Link>
          </div>
        </div>

        {/* ── Weight chart ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Scale size={18} color="var(--color-brand)" />
            <h2 style={{ fontWeight: 700 }}>Weight trend</h2>
          </div>
          {weightData.length < 2 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Not enough data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} contentStyle={{ fontSize: '0.8rem' }} />
                <Line type="monotone" dataKey="weight" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Check-ins ── */}
        <div className="card">
          <h2 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Recent check-ins</h2>
          {checkins.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No check-ins yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {checkins.map((ci) => (
                <div key={ci.id} style={{ padding: '0.625rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Week of {fmtDate(ci.week_start)}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      Effort {ci.effort}/5 · Energy {ci.energy}/5
                    </span>
                  </div>
                  {ci.note && <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{ci.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ fontWeight: 700, margin: 0 }}>Notes / Messages</h2>
            <Link
              to={`/trainer/chat?client=${id}`}
              style={{
                color: 'var(--color-brand)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <MessageSquare size={14} /> Open in WhatsApp Chat →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem', maxHeight: '260px', overflowY: 'auto' }}>
            {notes.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No notes yet.</p>
            ) : notes.map((n) => {
              const isTrainer = n.author_id !== id;
              return (
                <div key={n.id} style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  background: isTrainer ? 'rgba(31,77,58,0.06)' : 'var(--color-bg)',
                  borderLeft: isTrainer ? '3px solid var(--color-brand)' : '3px solid var(--color-gold)',
                  fontSize: '0.875rem',
                }}>
                  <p style={{ fontWeight: 700, fontSize: '0.75rem', color: isTrainer ? 'var(--color-brand)' : 'var(--color-gold)', marginBottom: '0.2rem' }}>
                    {isTrainer ? 'You (trainer)' : client.full_name}
                  </p>
                  <p>{n.body}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{fmtDateTime(n.created_at)}</p>
                </div>
              );
            })}
            <div ref={notesEndRef} />
          </div>

          {/* Send note */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="trainer-note-input"
              type="text"
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a note to the client…"
              onKeyDown={(e) => e.key === 'Enter' && sendNote()}
            />
            <button
              className="btn btn-primary"
              onClick={sendNote}
              disabled={sending || !note.trim()}
              id="trainer-note-send"
              style={{ flexShrink: 0, padding: '0.75rem 1rem' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
