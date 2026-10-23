// src/pages/trainer/ClientList.jsx
// ──────────────────────────────────────────────────────────────────
// Sortable, filterable list of all trainer's clients.
// Each row shows: name, adherence %, last activity, status tag.
// Status: "On track" | "Needs follow-up" | "Inactive"
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, UserPlus, Copy, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { FLAG_CONFIG } from '../../lib/flagConfig';
import { calcAdherence, todayISO, addDays, weekStart, fmtDate } from '../../lib/utils';

function getStatus(daysSinceActivity, adherence) {
  if (daysSinceActivity >= FLAG_CONFIG.inactiveDays || adherence < FLAG_CONFIG.lowAdherencePct) {
    return daysSinceActivity >= FLAG_CONFIG.inactiveDays ? 'Inactive' : 'Needs follow-up';
  }
  return 'On track';
}

function StatusBadge({ status }) {
  const map = {
    'On track':        'badge-green',
    'Needs follow-up': 'badge-gold',
    'Inactive':        'badge-red',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

// In-memory cache for instant zero-delay navigation
let _clientListCache = null;

export function invalidateClientListCache() {
  _clientListCache = null;
}

export function ClientList() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading,  setLoading]  = useState(!_clientListCache);
  const [error,    setError]    = useState('');
  const [clients,  setClients]  = useState(_clientListCache || []);
  const [filtered, setFiltered] = useState(_clientListCache || []);
  const [query,    setQuery]    = useState('');
  const [sortBy,   setSortBy]   = useState('name');
  const [copied,   setCopied]   = useState(false);

  const inviteCode = profile?.invite_code || '—';

  async function load(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError('');

    try {
      // 1. Clients
      const { data: clientRows, error: err } = await supabase
        .from('profiles')
        .select('id, full_name, goal, diet_pref')
        .eq('trainer_id', user.id)
        .eq('role', 'client');

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const ids = (clientRows || []).map((c) => c.id);
      const thisWeek = weekStart(todayISO());

      // 2 & 3. Run completions and activity queries in PARALLEL!
      const [compsRes, lastActsRes] = await Promise.all([
        supabase
          .from('completions')
          .select('client_id, date, done')
          .in('client_id', ids.length ? ids : ['_'])
          .gte('date', thisWeek),
        supabase
          .from('completions')
          .select('client_id, date')
          .in('client_id', ids.length ? ids : ['_'])
          .eq('done', true)
          .order('date', { ascending: false }),
      ]);

      const comps = compsRes.data || [];
      const lastActs = lastActsRes.data || [];

      const today = todayISO();
      const enriched = (clientRows || []).map((c) => {
        const myComps   = comps.filter((x) => x.client_id === c.id);
        const lastAct   = lastActs.find((x) => x.client_id === c.id);
        const adherence = calcAdherence(myComps);
        const daysSince = lastAct
          ? Math.floor((new Date(today) - new Date(lastAct.date)) / 86400000)
          : 999;
        const status = getStatus(daysSince, adherence);
        const lastActivityLabel = lastAct ? fmtDate(lastAct.date) : 'Never';
        return { ...c, adherence, daysSince, status, lastActivityLabel };
      });

      _clientListCache = enriched;
      setClients(enriched);
      applyFilter(enriched, query, sortBy);
    } catch (e) {
      console.error('Error loading clients list:', e);
      setError(e.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  function applyFilter(list, q, sort) {
    let out = q
      ? list.filter((c) => c.full_name.toLowerCase().includes(q.toLowerCase()))
      : list;

    out = [...out].sort((a, b) => {
      if (sort === 'name')      return a.full_name.localeCompare(b.full_name);
      if (sort === 'adherence') return b.adherence - a.adherence;
      if (sort === 'status') {
        const order = { 'Needs follow-up': 0, 'Inactive': 1, 'On track': 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      return 0;
    });

    setFiltered(out);
  }

  useEffect(() => {
    load(Boolean(_clientListCache));
  }, [user.id]);
  useEffect(() => { applyFilter(clients, query, sortBy); }, [query, sortBy, clients]);

  function copyInvite() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><Spinner /></div>;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-brand)' }}>Clients</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>{clients.length} total</p>
        </div>
        {/* Invite code */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.875rem',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <UserPlus size={16} color="var(--color-brand)" />
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Your invite code</p>
            <p style={{ fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-brand)' }}>{inviteCode}</p>
          </div>
          <button
            onClick={copyInvite}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.25rem' }}
            title="Copy invite code"
            id="copy-invite"
          >
            <Copy size={14} />
          </button>
          {copied && <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>Copied!</span>}
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="search"
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            id="client-search"
          />
        </div>

        {/* Sort */}
        <select
          className="form-select"
          style={{ width: 'auto' }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          id="client-sort"
        >
          <option value="name">Sort: Name</option>
          <option value="adherence">Sort: Adherence</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <EmptyState title="No clients found" message={clients.length === 0 ? "Share your invite code above to add clients." : "No clients match your search."} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map((c) => (
            <Link key={c.id} to={`/trainer/clients/${c.id}`} style={{ textDecoration: 'none' }}>
              <div
                className="card card-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
              >
                {/* Avatar */}
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                }}>
                  {c.full_name?.[0] || '?'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.full_name}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Last active: {c.lastActivityLabel}
                  </p>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--color-brand)' }}>{c.adherence}%</p>
                  <StatusBadge status={c.status} />
                </div>

                {/* Quick Chat Shortcut */}
                <button
                  type="button"
                  title={`Chat with ${c.full_name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/trainer/chat?client=${c.id}`);
                  }}
                  style={{
                    background: 'rgba(61, 255, 79, 0.12)',
                    border: '1px solid rgba(61, 255, 79, 0.3)',
                    color: 'var(--color-brand)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-brand)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F0FDF4';
                    e.currentTarget.style.color = 'var(--color-brand)';
                  }}
                >
                  <MessageSquare size={14} />
                </button>

                <ChevronRight size={16} color="var(--color-text-muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
