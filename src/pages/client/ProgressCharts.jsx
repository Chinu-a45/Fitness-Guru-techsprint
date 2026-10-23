// src/pages/client/ProgressCharts.jsx
// ──────────────────────────────────────────────────────────────────
// Shows five Recharts charts:
//  1. Weight over time (line chart)
//  2. Waist over time (line chart)
//  3. Sleep hours over time (line chart)
//  4. Workouts completed per week (bar chart)
//  5. Plain-text weekly summary
// ──────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Scale, Ruler, Dumbbell, Moon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { weekStart, groupBy } from '../../lib/utils';

// Helper to format YYYY-MM-DD to short label
function shortDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function ProgressCharts() {
  const { user } = useAuth();

  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [weightData,   setWeightData]   = useState([]);
  const [waistData,    setWaistData]    = useState([]);
  const [sleepData,    setSleepData]    = useState([]);
  const [weeklyData,   setWeeklyData]   = useState([]);
  const [summary,      setSummary]      = useState('');

  async function load() {
    setLoading(true);
    setError('');

    // Fetch logs (weight + waist + sleep)
    const { data: logs, error: logsErr } = await supabase
      .from('logs')
      .select('date, weight_kg, waist_cm, sleep_hours')
      .eq('client_id', user.id)
      .order('date', { ascending: true });

    if (logsErr) { setError(logsErr.message); setLoading(false); return; }

    setWeightData(
      (logs || []).filter((l) => l.weight_kg != null).map((l) => ({ date: shortDate(l.date), weight: l.weight_kg }))
    );
    setWaistData(
      (logs || []).filter((l) => l.waist_cm).map((l) => ({
        date: shortDate(l.date), waist: l.waist_cm,
      }))
    );
    setSleepData(
      (logs || []).filter((l) => l.sleep_hours != null).map((l) => ({
        date: shortDate(l.date), sleep: l.sleep_hours,
      }))
    );

    // Fetch completions for weekly workouts chart
    const { data: comps, error: compsErr } = await supabase
      .from('completions')
      .select('date, item_type, done')
      .eq('client_id', user.id)
      .eq('item_type', 'workout')
      .eq('done', true);

    if (!compsErr) {
      const byWeek = groupBy(comps || [], (c) => weekStart(c.date));
      const weeklyArr = Object.entries(byWeek)
        .map(([week, rows]) => ({
          week: shortDate(week),
          workouts: rows.length,
        }))
        .sort((a, b) => (a.week > b.week ? 1 : -1))
        .slice(-12); // last 12 weeks
      setWeeklyData(weeklyArr);
    }

    // Plain-text summary
    buildSummary(logs || [], comps || []);

    setLoading(false);
  }

  function buildSummary(logs, comps) {
    if (logs.length === 0) { setSummary(''); return; }

    const latest   = logs[logs.length - 1];
    const earliest = logs[0];
    const weeks    = logs.length > 1
      ? Math.max(1, Math.round((new Date(latest.date) - new Date(earliest.date)) / (7 * 86400 * 1000)))
      : 1;
    const totalWorkouts = comps.filter((c) => c.done).length;

    // Average sleep
    const sleepLogs = logs.filter((l) => l.sleep_hours != null);
    const avgSleep  = sleepLogs.length
      ? (sleepLogs.reduce((s, l) => s + l.sleep_hours, 0) / sleepLogs.length).toFixed(1)
      : null;

    setSummary(
      `Over the past ${weeks} week${weeks !== 1 ? 's' : ''}, you logged ${logs.length} weight entries ` +
      `and completed ${totalWorkouts} workout session${totalWorkouts !== 1 ? 's' : ''}.` +
      (avgSleep ? ` Your average sleep was ${avgSleep} hours per night.` : '') +
      ` Keep it up — consistency is key!`
    );
  }

  useEffect(() => { load(); }, [user.id]);

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <Spinner />
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)' }}>
          Progress Charts
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Your journey over time
        </p>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {/* ── Weight chart ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Scale size={18} color="var(--color-brand)" />
          <h2 className="section-heading" style={{ margin: 0 }}>Weight (kg)</h2>
        </div>

        {weightData.length < 2 ? (
          <EmptyState
            icon={Scale}
            title="Not enough data"
            message="Log at least 2 weight entries to see the chart."
          />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                formatter={(v) => [`${v} kg`, 'Weight']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--color-brand)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--color-brand)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Sleep chart ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Moon size={18} color="#818CF8" />
          <h2 className="section-heading" style={{ margin: 0 }}>Sleep (hours)</h2>
        </div>

        {sleepData.length < 2 ? (
          <EmptyState
            icon={Moon}
            title="Not enough sleep data"
            message="Log sleep hours on at least 2 dates to see the chart."
          />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sleepData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis
                domain={[0, 12]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                formatter={(v) => [`${v} hrs`, 'Sleep']}
              />
              {/* Healthy sleep reference band at 7-9h */}
              <Line
                type="monotone"
                dataKey="sleep"
                stroke="#818CF8"
                strokeWidth={2.5}
                dot={{ fill: '#818CF8', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Waist chart ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Ruler size={18} color="var(--color-gold)" />
          <h2 className="section-heading" style={{ margin: 0 }}>Waist (cm)</h2>
        </div>

        {waistData.length < 2 ? (
          <EmptyState
            icon={Ruler}
            title="Not enough data"
            message="Log waist measurements on at least 2 dates to see the chart."
          />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={waistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                formatter={(v) => [`${v} cm`, 'Waist']}
              />
              <Line
                type="monotone"
                dataKey="waist"
                stroke="var(--color-gold)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--color-gold)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Weekly workouts bar chart ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Dumbbell size={18} color="var(--color-brand)" />
          <h2 className="section-heading" style={{ margin: 0 }}>Workouts per week</h2>
        </div>

        {weeklyData.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workout data yet"
            message="Complete workouts to see weekly totals here."
          />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: '0.85rem', borderRadius: '0.5rem' }}
                formatter={(v) => [v, 'Workouts']}
              />
              <Bar dataKey="workouts" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Weekly summary ── */}
      {summary && (
        <div
          className="card"
          style={{
            background: 'rgba(31,77,58,0.04)',
            border: '1.5px solid rgba(31,77,58,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={18} color="var(--color-brand)" />
            <h2 className="section-heading" style={{ margin: 0 }}>Your summary</h2>
          </div>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
            {summary}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            Plans are created or approved by your trainer. This app does not give medical advice.
          </p>
        </div>
      )}
    </div>
  );
}
