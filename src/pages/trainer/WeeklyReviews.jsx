// src/pages/trainer/WeeklyReviews.jsx
// ──────────────────────────────────────────────────────────────────
// Trainer page for reviewing all client weekly check-ins:
//   • Fully optimized for mobile screens (touch targets, 2x2 stat grid,
//     horizontal swipeable filter pills, thumb-friendly action bar)
//   • Filter by pending review, high strain, reviewed, or all
//   • Search by client name or note content
//   • Summary stats for pending reviews, effort, and recovery
//   • Visual effort & recovery energy indicators with strain alerts
//   • One-click "Mark Reviewed" action with optimistic updates
//   • Direct shortcuts to chat with client & view client detail
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck, CheckCircle2, Clock, AlertTriangle,
  Search, ArrowRight, Check, RefreshCw,
  Flame, BatteryCharging, MessageSquare, RotateCcw,
  Sparkles, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtDate } from '../../lib/utils';

const EFFORT_META = {
  1: { label: 'Very Easy', color: 'var(--color-brand)' },
  2: { label: 'Easy', color: 'var(--color-brand)' },
  3: { label: 'Moderate', color: 'var(--color-brand)' },
  4: { label: 'Hard', color: '#FFB020' },
  5: { label: 'Very Hard', color: '#FF4D4D' },
};

const ENERGY_META = {
  1: { label: 'Exhausted', color: '#FF4D4D' },
  2: { label: 'Low', color: '#FFB020' },
  3: { label: 'Moderate', color: 'var(--color-text-muted)' },
  4: { label: 'Good', color: 'var(--color-brand)' },
  5: { label: 'Energised', color: 'var(--color-brand-light)' },
};

const GOAL_LABELS = {
  fat_loss: '🔥 Fat Loss',
  strength: '💪 Strength',
  general: '🌿 Fitness',
  general_fitness: '🌿 Fitness',
};

const DIET_LABELS = {
  veg: '🥦 Veg',
  non_veg: '🍗 Non-Veg',
  'non-veg': '🍗 Non-Veg',
  eggetarian: '🥚 Eggetarian',
};

// In-memory cache for instant zero-delay navigation
let _reviewsCache = null;

export function invalidateReviewsCache() {
  _reviewsCache = null;
}

export function WeeklyReviews() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(!_reviewsCache);
  const [error, setError] = useState('');
  const [checkins, setCheckins] = useState(_reviewsCache?.checkins || []);
  const [clientMap, setClientMap] = useState(_reviewsCache?.clientMap || {});
  const [filter, setFilter] = useState('pending'); // 'pending' | 'high_effort' | 'reviewed' | 'all'
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  async function load(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError('');

    try {
      // 1. Fetch assigned clients
      const { data: clients, error: cErr } = await supabase
        .from('profiles')
        .select('id, full_name, goal, diet_pref')
        .eq('trainer_id', user.id);

      if (cErr) throw cErr;

      const map = {};
      (clients || []).forEach((c) => {
        map[c.id] = c;
      });
      setClientMap(map);

      const clientIds = Object.keys(map);
      if (clientIds.length === 0) {
        _reviewsCache = { checkins: [], clientMap: {} };
        setCheckins([]);
        setLoading(false);
        return;
      }

      // 2. Fetch all check-ins for assigned clients
      const { data: ciData, error: ciErr } = await supabase
        .from('checkins')
        .select('*')
        .in('client_id', clientIds)
        .order('week_start', { ascending: false });

      if (ciErr) throw ciErr;
      const list = ciData || [];
      _reviewsCache = { checkins: list, clientMap: map };
      setCheckins(list);
    } catch (err) {
      console.error(err);
      setError('Failed to load weekly check-ins. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.id) load(Boolean(_reviewsCache));
  }, [user?.id]);

  async function toggleReviewed(checkin) {
    const newStatus = !checkin.reviewed;
    setUpdatingId(checkin.id);

    try {
      const { error: updErr } = await supabase
        .from('checkins')
        .update({ reviewed: newStatus })
        .eq('id', checkin.id);

      if (updErr) throw updErr;

      setCheckins((prev) =>
        prev.map((c) => (c.id === checkin.id ? { ...c, reviewed: newStatus } : c))
      );
    } catch (err) {
      console.error(err);
      alert('Could not update status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // Summary statistics
  const stats = useMemo(() => {
    const total = checkins.length;
    const pending = checkins.filter((c) => !c.reviewed).length;
    const reviewed = checkins.filter((c) => !!c.reviewed).length;
    const highEffort = checkins.filter((c) => c.effort >= 4).length;

    const totalEffort = checkins.reduce((acc, c) => acc + (c.effort || 0), 0);
    const totalEnergy = checkins.reduce((acc, c) => acc + (c.energy || 0), 0);

    const avgEffort = total > 0 ? (totalEffort / total).toFixed(1) : '—';
    const avgEnergy = total > 0 ? (totalEnergy / total).toFixed(1) : '—';

    return { total, pending, reviewed, highEffort, avgEffort, avgEnergy };
  }, [checkins]);

  // Filter and search check-ins
  const filtered = useMemo(() => {
    return checkins.filter((c) => {
      const client = clientMap[c.client_id];
      const name = client?.full_name?.toLowerCase() || '';
      const note = c.note?.toLowerCase() || '';
      const q = search.trim().toLowerCase();

      const matchesSearch = !q || name.includes(q) || note.includes(q);
      if (!matchesSearch) return false;

      if (filter === 'pending') return !c.reviewed;
      if (filter === 'high_effort') return c.effort >= 4;
      if (filter === 'reviewed') return !!c.reviewed;
      return true; // 'all'
    });
  }, [checkins, clientMap, filter, search]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-brand)', lineHeight: 1.2 }}>
              Weekly Reviews
            </h1>
            {stats.pending > 0 && (
              <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                {stats.pending}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            Client exertion & recovery reflections
          </p>
        </div>

        <button
          onClick={load}
          className="btn btn-secondary btn-sm"
          disabled={loading}
          style={{ flexShrink: 0, padding: '0.45rem 0.75rem', height: '36px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          title="Refresh check-ins"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span style={{ fontSize: '0.8rem' }}>Refresh</span>
        </button>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* ── Compact 2x2 on Mobile, 4-col on Desktop Stat Cards ── */}
      <div className="reviews-stats-grid">
        {/* Pending Card */}
        <div
          className="stat-card"
          style={{
            padding: '0.85rem',
            borderColor: stats.pending > 0 ? 'rgba(255, 176, 32, 0.4)' : 'var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending
            </span>
            <Clock size={15} color={stats.pending > 0 ? 'var(--color-warning)' : 'var(--color-brand)'} />
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: stats.pending > 0 ? 'var(--color-warning)' : 'var(--color-brand)', lineHeight: 1.15, margin: '0.2rem 0' }}>
            {stats.pending}
          </p>
          <span style={{ fontSize: '0.68rem', color: stats.pending > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
            {stats.pending > 0 ? 'Needs review' : 'All clear 🎉'}
          </span>
        </div>

        {/* High Effort Card */}
        <div
          className="stat-card"
          style={{
            padding: '0.85rem',
            borderColor: stats.highEffort > 0 ? 'rgba(255, 77, 77, 0.35)' : 'var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              High Strain
            </span>
            <Flame size={15} color={stats.highEffort > 0 ? 'var(--color-error)' : 'var(--color-brand)'} />
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: stats.highEffort > 0 ? 'var(--color-error)' : 'var(--color-brand)', lineHeight: 1.15, margin: '0.2rem 0' }}>
            {stats.highEffort}
          </p>
          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
            Effort ≥ 4/5
          </span>
        </div>

        {/* Avg Effort Card */}
        <div className="stat-card" style={{ padding: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avg Effort
            </span>
            <Sparkles size={15} color="var(--color-brand)" />
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15, margin: '0.2rem 0' }}>
            {stats.avgEffort} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>/ 5</span>
          </p>
          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
            Exertion index
          </span>
        </div>

        {/* Avg Energy Card */}
        <div className="stat-card" style={{ padding: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recovery
            </span>
            <BatteryCharging size={15} color="var(--color-brand)" />
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15, margin: '0.2rem 0' }}>
            {stats.avgEnergy} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>/ 5</span>
          </p>
          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
            Vitality score
          </span>
        </div>
      </div>

      {/* ── Mobile-Optimized Search & Filter Controls ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          background: 'var(--color-surface)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Horizontally scrollable pill tabs (swipeable on mobile) */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '2px',
          }}
        >
          {[
            { id: 'pending', label: 'Pending', count: stats.pending, alert: stats.pending > 0 },
            { id: 'high_effort', label: 'High Strain', count: stats.highEffort, alert: stats.highEffort > 0 },
            { id: 'reviewed', label: 'Reviewed', count: stats.reviewed },
            { id: 'all', label: 'All Entries', count: stats.total },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  border: `1.5px solid ${isActive ? 'var(--color-brand)' : 'transparent'}`,
                  background: isActive ? 'rgba(61, 255, 79, 0.14)' : 'var(--color-surface-2)',
                  color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    background: isActive
                      ? 'var(--color-brand)'
                      : tab.alert
                        ? 'rgba(255, 176, 32, 0.25)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#000' : tab.alert ? 'var(--color-warning)' : 'var(--color-text-dim)',
                    fontWeight: 800,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or note keywords…"
            style={{
              paddingLeft: '2.25rem',
              paddingRight: search ? '2.25rem' : '0.75rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              fontSize: '0.85rem',
              height: '40px',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Check-ins List ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3.5rem 0' }}>
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem 1.25rem', textAlign: 'center' }}>
          <EmptyState
            icon={CalendarCheck}
            title={
              filter === 'pending'
                ? 'All Caught Up!'
                : filter === 'high_effort'
                  ? 'No High Strain Reports'
                  : 'No Check-ins Found'
            }
            message={
              filter === 'pending'
                ? 'Great job! There are no pending check-ins waiting for your review.'
                : filter === 'high_effort'
                  ? 'None of your clients reported extreme exertion or fatigue (effort ≥ 4/5).'
                  : 'No weekly check-ins match your current search or filter query.'
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.map((ci) => {
            const client = clientMap[ci.client_id];
            const isHighEffort = ci.effort >= 4;
            const isLowEnergy = ci.energy <= 2;
            const isUpdating = updatingId === ci.id;
            const effortInfo = EFFORT_META[ci.effort] || { label: 'Unrated', color: 'var(--color-text)' };
            const energyInfo = ENERGY_META[ci.energy] || { label: 'Unrated', color: 'var(--color-text)' };

            return (
              <div
                key={ci.id}
                className="card"
                style={{
                  background: 'var(--color-surface)',
                  border: ci.reviewed
                    ? '1px solid var(--color-border)'
                    : '1.5px solid rgba(255, 176, 32, 0.45)',
                  borderLeft: ci.reviewed
                    ? '4px solid var(--color-border-light)'
                    : isHighEffort
                      ? '4px solid var(--color-error)'
                      : '4px solid var(--color-warning)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: ci.reviewed ? 'var(--shadow-card)' : '0 4px 18px rgba(0,0,0,0.55)',
                }}
              >
                {/* ── Top Header Row: Client + Date + Status Badge ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                    {/* Avatar Circle */}
                    <div
                      style={{
                        width: '2.4rem',
                        height: '2.4rem',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)',
                        color: '#000',
                        fontWeight: 800,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {client?.full_name?.[0] || 'C'}
                    </div>

                    {/* Name & Week */}
                    <div style={{ minWidth: 0 }}>
                      <Link
                        to={`/trainer/clients/${ci.client_id}`}
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: 'var(--color-text)',
                          textDecoration: 'none',
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {client?.full_name || 'Client'}
                      </Link>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                        Week of {fmtDate(ci.week_start)}
                      </p>
                    </div>
                  </div>

                  {/* Status chip */}
                  <div style={{ flexShrink: 0 }}>
                    {ci.reviewed ? (
                      <span className="badge badge-green" style={{ fontSize: '0.7rem', padding: '0.25rem 0.55rem', gap: '0.3rem' }}>
                        <CheckCircle2 size={12} />
                        Reviewed
                      </span>
                    ) : (
                      <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '0.25rem 0.55rem', gap: '0.3rem' }}>
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Goal & Diet Badges ── */}
                {(client?.goal || client?.diet_pref) && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {client?.goal && (
                      <span className="badge badge-gray" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                        {GOAL_LABELS[client.goal] || client.goal}
                      </span>
                    )}
                    {client?.diet_pref && (
                      <span className="badge badge-gray" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                        {DIET_LABELS[client.diet_pref] || client.diet_pref}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Responsive Metrics Grid (Effort & Recovery Energy) ── */}
                <div className="reviews-metrics-grid">
                  {/* Effort Rating Box */}
                  <div
                    style={{
                      background: 'var(--color-surface-2)',
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: isHighEffort ? '1px solid rgba(255, 176, 32, 0.4)' : '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <Flame size={13} color={effortInfo.color} />
                        <span>Session Effort</span>
                      </div>
                      {isHighEffort && (
                        <span className="badge badge-red" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          <AlertTriangle size={10} /> High
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: effortInfo.color }}>
                        {ci.effort} <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>/ 5</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {effortInfo.label}
                      </span>
                    </div>

                    {/* 5-bar meter */}
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.15rem' }}>
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const isFilled = lvl <= ci.effort;
                        const barColor = isHighEffort ? '#FFB020' : 'var(--color-brand)';
                        return (
                          <div
                            key={lvl}
                            style={{
                              flex: 1,
                              height: '5px',
                              borderRadius: '999px',
                              background: isFilled ? barColor : 'rgba(255, 255, 255, 0.1)',
                              boxShadow: isFilled ? `0 0 5px ${barColor}44` : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Recovery Energy Box */}
                  <div
                    style={{
                      background: 'var(--color-surface-2)',
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: isLowEnergy ? '1px solid rgba(255, 77, 77, 0.35)' : '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <BatteryCharging size={13} color={energyInfo.color} />
                        <span>Recovery Energy</span>
                      </div>
                      {isLowEnergy && (
                        <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          Low
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: energyInfo.color }}>
                        {ci.energy} <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>/ 5</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {energyInfo.label}
                      </span>
                    </div>

                    {/* 5-bar meter */}
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.15rem' }}>
                      {[1, 2, 3, 4, 5].map((lvl) => {
                        const isFilled = lvl <= ci.energy;
                        const barColor = isLowEnergy ? '#FFB020' : 'var(--color-brand)';
                        return (
                          <div
                            key={lvl}
                            style={{
                              flex: 1,
                              height: '5px',
                              borderRadius: '999px',
                              background: isFilled ? barColor : 'rgba(255, 255, 255, 0.1)',
                              boxShadow: isFilled ? `0 0 5px ${barColor}44` : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Client Reflection Note ── */}
                {ci.note ? (
                  <div
                    style={{
                      padding: '0.75rem 0.85rem',
                      background: 'rgba(255, 176, 32, 0.05)',
                      border: '1px solid rgba(255, 176, 32, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: '3px solid var(--color-warning)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                      <MessageSquare size={12} color="var(--color-warning)" />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Client Note
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontStyle: 'italic', lineHeight: 1.45, margin: 0 }}>
                      "{ci.note}"
                    </p>
                  </div>
                ) : null}

                {/* ── Mobile-Friendly Bottom Action Bar ── */}
                <div className="reviews-action-bar">
                  <button
                    type="button"
                    onClick={() => toggleReviewed(ci)}
                    disabled={isUpdating}
                    className={ci.reviewed ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                    style={{
                      flex: 1,
                      height: '42px',
                      fontSize: '0.825rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {isUpdating ? (
                      <Spinner className="w-4 h-4" />
                    ) : ci.reviewed ? (
                      <>
                        <RotateCcw size={14} />
                        <span>Mark Unreviewed</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Mark as Reviewed</span>
                      </>
                    )}
                  </button>

                  {/* Chat with Client */}
                  <Link
                    to={`/trainer/chat?client=${ci.client_id}`}
                    className="btn btn-secondary btn-sm"
                    style={{
                      height: '42px',
                      padding: '0 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      flexShrink: 0,
                    }}
                    title="Chat with client"
                  >
                    <MessageSquare size={15} />
                    <span style={{ fontWeight: 600 }}>Chat</span>
                  </Link>

                  {/* Client Details */}
                  <Link
                    to={`/trainer/clients/${ci.client_id}`}
                    className="btn btn-ghost btn-sm"
                    style={{
                      height: '42px',
                      width: '42px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                    title="View client plan & details"
                  >
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
