// src/pages/trainer/TrainerDashboard.jsx
// ──────────────────────────────────────────────────────────────────
// Trainer dashboard with 4 stat cards:
//   • Active clients
//   • Flagged clients
//   • Plans awaiting approval
//   • Average weekly adherence
// Plus a list of flagged clients with reasons.
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, AlertTriangle, ClipboardList, TrendingUp, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { FLAG_CONFIG, FLAG_REASONS } from '../../lib/flagConfig';
import { calcAdherence, todayISO, addDays, weekStart } from '../../lib/utils';

// In-memory cache for instant zero-delay navigation
let _dashboardCache = null;

export function invalidateDashboardCache() {
  _dashboardCache = null;
}

export function TrainerDashboard() {
  const { user } = useAuth();

  const [loading,   setLoading]   = useState(!_dashboardCache);
  const [error,     setError]     = useState('');
  const [stats,     setStats]     = useState(_dashboardCache?.stats || { active: 0, flagged: 0, pending: 0, avgAdherence: 0 });
  const [flagged,   setFlagged]   = useState(_dashboardCache?.flagged || []); // [{client, reasons:[]}]

  async function load(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError('');

    try {
      // 1. All clients assigned to this trainer
      const { data: clients, error: clientsErr } = await supabase
        .from('profiles')
        .select('id, full_name, goal')
        .eq('trainer_id', user.id)
        .eq('role', 'client');

      if (clientsErr) {
        setError(clientsErr.message);
        setLoading(false);
        return;
      }

      const clientIds = (clients || []).map((c) => c.id);

      if (clientIds.length === 0) {
        const emptyStats = { active: 0, flagged: 0, pending: 0, avgAdherence: 0 };
        _dashboardCache = { stats: emptyStats, flagged: [] };
        setStats(emptyStats);
        setFlagged([]);
        setLoading(false);
        return;
      }

      const thisWeek = weekStart(todayISO());
      const twoWeeksAgo = addDays(todayISO(), -14);

      // 2–6: Run ALL dependent queries concurrently in Promise.all!
      const [draftPlansRes, compsRes, logsRes, checkinsRes, lastActCompsRes] = await Promise.all([
        supabase
          .from('plans')
          .select('id, client_id')
          .in('client_id', clientIds)
          .eq('status', 'draft'),
        supabase
          .from('completions')
          .select('client_id, date, done')
          .in('client_id', clientIds)
          .gte('date', thisWeek),
        supabase
          .from('logs')
          .select('client_id, date')
          .in('client_id', clientIds)
          .gte('date', twoWeeksAgo),
        supabase
          .from('checkins')
          .select('client_id, week_start, effort')
          .in('client_id', clientIds)
          .order('week_start', { ascending: false }),
        supabase
          .from('completions')
          .select('client_id, date')
          .in('client_id', clientIds)
          .eq('done', true)
          .order('date', { ascending: false }),
      ]);

      const draftPlans = draftPlansRes.data || [];
      const comps = compsRes.data || [];
      const logs = logsRes.data || [];
      const checkins = checkinsRes.data || [];
      const lastActComps = lastActCompsRes.data || [];

      const pending = draftPlans.length;

      // ── Compute per-client flags ──────────────────────────────────
      const today        = todayISO();
      const flaggedList  = [];
      let   totalAdh     = 0;
      let   adhCount     = 0;

      for (const client of clients || []) {
        const id = client.id;
        const reasons = [];

        // Last activity
        const lastAct = lastActComps.find((c) => c.client_id === id);
        if (!lastAct) {
          reasons.push(FLAG_REASONS.inactive);
        } else {
          const daysSince = Math.floor(
            (new Date(today) - new Date(lastAct.date)) / 86400000
          );
          if (daysSince >= FLAG_CONFIG.inactiveDays) reasons.push(FLAG_REASONS.inactive);
        }

        // Weekly adherence
        const clientComps = comps.filter((c) => c.client_id === id);
        if (clientComps.length > 0) {
          const adh = calcAdherence(clientComps);
          totalAdh += adh;
          adhCount++;
          if (adh < FLAG_CONFIG.lowAdherencePct) reasons.push(FLAG_REASONS.lowAdherence);
        }

        // Weight not logged
        const clientLogs = logs.filter((l) => l.client_id === id);
        if (clientLogs.length === 0) reasons.push(FLAG_REASONS.noWeight);

        // High effort 2+ consecutive check-ins
        const clientCheckins = checkins
          .filter((c) => c.client_id === id)
          .slice(0, FLAG_CONFIG.highEffortConsecutive);
        if (
          clientCheckins.length >= FLAG_CONFIG.highEffortConsecutive &&
          clientCheckins.every((c) => c.effort >= FLAG_CONFIG.highEffortThreshold)
        ) {
          reasons.push(FLAG_REASONS.highEffort);
        }

        if (reasons.length > 0) {
          flaggedList.push({ client, reasons });
        }
      }

      const calculatedStats = {
        active:       (clients || []).length,
        flagged:      flaggedList.length,
        pending,
        avgAdherence: adhCount > 0 ? Math.round(totalAdh / adhCount) : 0,
      };

      _dashboardCache = { stats: calculatedStats, flagged: flaggedList };
      setStats(calculatedStats);
      setFlagged(flaggedList);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // If we have cached data, load silently in background so UI is immediate!
    load(Boolean(_dashboardCache));
  }, [user.id]);

  const statCards = [
    { label: 'Active clients',       value: stats.active,       icon: Users,         color: 'var(--color-brand)'   },
    { label: 'Flagged clients',      value: stats.flagged,      icon: AlertTriangle,  color: '#D97706'              },
    { label: 'Plans for approval',   value: stats.pending,      icon: ClipboardList,  color: '#2563EB'              },
    { label: 'Avg. weekly adherence',value: `${stats.avgAdherence}%`, icon: TrendingUp, color: 'var(--color-success)' },
  ];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><Spinner /></div>;

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-brand)' }}>Dashboard</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Overview of your clients this week</p>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* ── Stats grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <Icon size={22} color={color} />
            <p className="stat-value" style={{ color }}>{value}</p>
            <p className="stat-label">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Flagged clients ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: '#D97706' }} />
            Follow-up flags
          </h2>
          <Link
            to="/trainer/clients"
            style={{ fontSize: '0.875rem', color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'none' }}
          >
            All clients →
          </Link>
        </div>

        {flagged.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            ✅ No clients need follow-up right now. Great work!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {flagged.map(({ client, reasons }) => (
              <Link
                key={client.id}
                to={`/trainer/clients/${client.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem',
                    borderLeft: '4px solid #D97706', cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                >
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--color-text)' }}>{client.full_name}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {reasons.map((r) => (
                        <span key={r} className="badge badge-gold" style={{ fontSize: '0.72rem' }}>
                          ⚠️ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
