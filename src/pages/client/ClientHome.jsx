// src/pages/client/ClientHome.jsx
// ──────────────────────────────────────────────────────────────────
// Client home screen showing:
//  • Personalised greeting
//  • Today's session summary + checklist progress ring
//  • Current streak badge
//  • Quick weight log shortcut
//  • Latest trainer note
//  • In-app reminder banner if no activity today
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Flame, Scale, MessageSquare, ChevronRight,
  Bell, CheckCircle2, Dumbbell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { calcAdherence, calcStreak, todayISO, fmtDate } from '../../lib/utils';

// In-memory cache for instant zero-delay navigation
let _clientHomeCache = null;

export function invalidateClientHomeCache() {
  _clientHomeCache = null;
}

export function ClientHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!_clientHomeCache);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(_clientHomeCache?.plan || null);
  const [completions, setCompletions] = useState(_clientHomeCache?.completions || []);
  const [todayDone, setTodayDone] = useState(_clientHomeCache?.todayDone || 0);
  const [todayTotal, setTodayTotal] = useState(_clientHomeCache?.todayTotal || 0);
  const [streak, setStreak] = useState(_clientHomeCache?.streak || 0);
  const [latestNote, setLatestNote] = useState(_clientHomeCache?.latestNote || null);

  async function load(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError('');
    const today = todayISO();

    try {
      // 1. Fetch latest approved plan
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

      let calcTotal = 0;
      let calcDone = 0;
      let calcStrk = 0;
      let allCompsList = [];
      let noteItem = null;

      if (planData) {
        const exercises = planData.workouts || [];
        const meals = planData.meals || [];
        calcTotal = exercises.length + meals.length;
        setTodayTotal(calcTotal);

        // Run today's comps, all comps, and trainer notes in PARALLEL!
        const [todayCompsRes, allCompsRes, noteRes] = await Promise.all([
          supabase
            .from('completions')
            .select('*')
            .eq('client_id', user.id)
            .eq('plan_id', planData.id)
            .eq('date', today),
          supabase
            .from('completions')
            .select('date, done')
            .eq('client_id', user.id),
          supabase
            .from('notes')
            .select('*')
            .eq('client_id', user.id)
            .neq('author_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        calcDone = (todayCompsRes.data || []).filter((c) => c.done).length;
        allCompsList = allCompsRes.data || [];
        calcStrk = calcStreak(allCompsList);
        noteItem = noteRes.data || null;

        setTodayDone(calcDone);
        setCompletions(allCompsList);
        setStreak(calcStrk);
        setLatestNote(noteItem);
      } else {
        const { data: noteData } = await supabase
          .from('notes')
          .select('*')
          .eq('client_id', user.id)
          .neq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        noteItem = noteData || null;
        setLatestNote(noteItem);
      }

      _clientHomeCache = {
        plan: planData,
        completions: allCompsList,
        todayDone: calcDone,
        todayTotal: calcTotal,
        streak: calcStrk,
        latestNote: noteItem,
      };
    } catch (err) {
      console.error('Error loading client home:', err);
      setError(err.message || 'Failed to load home');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(Boolean(_clientHomeCache));
  }, [user.id]);

  const progress = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
      hour < 17 ? 'Good afternoon' :
        'Good evening';

  const name = profile?.full_name?.split(' ')[0] || 'there';

  // Circumference for SVG progress ring
  const R = 36;
  const circ = 2 * Math.PI * R;
  const offset = circ - (progress / 100) * circ;

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <Spinner />
    </div>
  );

  return (
    <div className="page-content">
      {/* ── Greeting ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          {greeting},
        </p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-brand)' }}>
          {name} 👋
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          {fmtDate(todayISO())}
        </p>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* ── Reminder banner – if no items done today ── */}
      {plan && todayDone === 0 && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          <Bell size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Don't forget today's plan! Tap <strong>Plan</strong> below to get started.</span>
        </div>
      )}

      {/* ── Today's session card ── */}
      {plan ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <p className="section-heading" style={{ marginBottom: '0.1rem' }}>Today's plan</p>
              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                <CheckCircle2 size={10} /> Approved by trainer
              </span>
            </div>
            {/* SVG progress ring */}
            <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="44" cy="44" r={R} fill="none" stroke="var(--color-border)" strokeWidth="7" />
              <circle
                cx="44" cy="44" r={R}
                fill="none"
                stroke={progress === 100 ? 'var(--color-success)' : 'var(--color-brand)'}
                strokeWidth="7"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text
                x="44" y="44"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ transform: 'rotate(90deg)', transformOrigin: '44px 44px', fontSize: '14px', fontWeight: 700, fill: 'var(--color-brand)' }}
              >
                {progress}%
              </text>
            </svg>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>{todayDone}</strong> of{' '}
            <strong>{todayTotal}</strong> items completed
          </p>

          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: '1rem' }}
            onClick={() => navigate('/client/plan')}
            id="home-view-plan"
          >
            <Dumbbell size={16} /> View today's plan
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center', padding: '2rem' }}>
          <Dumbbell size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 600 }}>No plan yet</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Your trainer will create and approve a plan for you soon.
          </p>
        </div>
      )}

      {/* ── Quick actions row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        {/* Streak */}
        <div className="card card-sm" style={{ background: 'linear-gradient(135deg, var(--color-gold) 0%, #E8B84B 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Flame size={20} color="var(--color-brand-dark)" />
            <span style={{ fontWeight: 700, color: 'var(--color-brand-dark)', fontSize: '1.75rem' }}>
              {streak}
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-brand-dark)', fontWeight: 600 }}>
            day streak 🔥
          </p>
        </div>

        {/* Log weight shortcut */}
        <Link
          to="/client/progress"
          className="card card-sm"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          id="home-log-weight"
        >
          <Scale size={20} color="var(--color-brand)" />
          <div style={{ marginTop: '0.5rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Log weight</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Track progress</p>
          </div>
        </Link>
      </div>

      {/* ── Latest trainer note ── */}
      {latestNote && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <MessageSquare size={16} color="var(--color-gold)" />
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Trainer note</p>
          </div>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{latestNote.body}</p>
          <Link
            to="/client/notes"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              marginTop: '0.75rem', fontSize: '0.85rem',
              color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'none',
            }}
          >
            View all notes <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* ── Weekly check-in reminder ── */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.875rem 1rem',
          background: 'rgba(31,77,58,0.06)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Weekly check-in</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Rate your effort & energy</p>
        </div>
        <Link
          to="/client/checkin"
          className="btn btn-secondary btn-sm"
          id="home-checkin"
        >
          Start <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
