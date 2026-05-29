import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import Header        from '../components/Header';
import UptimeBar     from '../components/UptimeBar';
import ResponseChart from '../components/ResponseChart';
import MonitorModal  from '../components/MonitorModal';

const STATUS_STYLES = {
  up:      { label: 'Operational', badge: 'text-green-700 bg-green-50 border-green-200', dot: 'status-dot-up' },
  down:    { label: 'Down',        badge: 'text-red-700 bg-red-50 border-red-200',       dot: 'status-dot-down' },
  pending: { label: 'Pending',     badge: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'status-dot-pending' },
};

export default function MonitorDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const [monitor,     setMonitor]     = useState(null);
  const [checks,      setChecks]      = useState([]);
  const [dailyUptime, setDailyUptime] = useState([]);
  const [incidents,   setIncidents]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [monRes, checkRes, dailyRes, incRes] = await Promise.all([
        api.get(`/monitors/${id}`),
        api.get(`/monitors/${id}/checks?limit=100`),
        api.get(`/monitors/${id}/daily-uptime`),
        api.get(`/monitors/${id}/incidents`),
      ]);
      setMonitor(monRes.data);
      setChecks(checkRes.data);
      setDailyUptime(dailyRes.data);
      setIncidents(incRes.data);
    } catch (err) {
      if (err.response?.status === 404) navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(formData) {
    try {
      const res = await api.put(`/monitors/${id}`, formData);
      setMonitor(res.data);
      setShowModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update monitor.');
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${monitor.name}" and all its history? This cannot be undone.`)) return;
    try {
      await api.delete(`/monitors/${id}`);
      navigate('/', { replace: true });
    } catch {
      alert('Failed to delete monitor.');
    }
  }

  if (loading) return <PageShell><LoadingState /></PageShell>;
  if (!monitor) return null;

  const status  = STATUS_STYLES[monitor.current_status] || STATUS_STYLES.pending;
  const uptime  = parseFloat(monitor.uptime_percentage || 100).toFixed(2);

  // Last 10 checks for the recent checks table
  const recentChecks = checks.slice(0, 10);

  // Avg response time from checks that were 'up'
  const upChecks = checks.filter(c => c.status === 'up' && c.response_time_ms != null);
  const avgResponse = upChecks.length > 0
    ? Math.round(upChecks.reduce((a, c) => a + c.response_time_ms, 0) / upChecks.length)
    : null;

  return (
    <PageShell>
      {/* Back link */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All monitors
        </Link>
      </div>

      {/* Monitor header */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className={`inline-block w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${status.dot}`} />
            <div>
              <h1 className="font-display font-bold text-2xl text-stone-900">{monitor.name}</h1>
              <a
                href={monitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-400 font-mono text-sm hover:text-stone-600 transition-colors"
              >
                {monitor.url}
              </a>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.badge}`}>
                  {status.label}
                </span>
                <span className="text-xs text-stone-400">
                  Checked every {monitor.interval_minutes}m
                </span>
                {monitor.last_checked_at && (
                  <span className="text-xs text-stone-400">
                    Last: {formatRelative(new Date(monitor.last_checked_at))}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="px-3.5 py-2 text-sm font-medium text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-3.5 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-stone-100">
          <Metric label="30-day uptime"    value={`${uptime}%`}             mono />
          <Metric label="Avg response"     value={avgResponse ? `${avgResponse}ms` : '—'} mono />
          <Metric label="Total checks"     value={checks.length.toLocaleString()} mono />
          <Metric label="Open incidents"   value={incidents.filter(i => !i.is_resolved).length} mono />
        </div>
      </div>

      {/* Response time chart */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
        <h2 className="font-display font-semibold text-stone-900 mb-4">Response time</h2>
        <ResponseChart checks={checks} />
      </div>

      {/* Uptime bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
        <h2 className="font-display font-semibold text-stone-900 mb-4">90-day uptime</h2>
        <UptimeBar data={dailyUptime} />
      </div>

      {/* Recent checks + Incidents — side by side on wide screens */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Recent checks */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h2 className="font-display font-semibold text-stone-900 mb-4">Recent checks</h2>
          {recentChecks.length === 0 ? (
            <p className="text-stone-400 text-sm">No checks recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentChecks.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={c.status} />
                    <span className="font-mono text-stone-500 text-xs">
                      {formatDateTime(new Date(c.checked_at))}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {c.status_code && (
                      <span className="text-stone-400 font-mono">HTTP {c.status_code}</span>
                    )}
                    {c.response_time_ms != null && (
                      <span className="text-stone-600 font-mono">{c.response_time_ms}ms</span>
                    )}
                    {c.status !== 'up' && c.error_message && (
                      <span className="text-red-500 truncate max-w-[120px]" title={c.error_message}>
                        {c.error_message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incidents */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h2 className="font-display font-semibold text-stone-900 mb-4">Incidents</h2>
          {incidents.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-stone-400 text-sm">No incidents recorded.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map(inc => (
                <div key={inc.id} className="border border-stone-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {inc.is_resolved
                      ? <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">Resolved</span>
                      : <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Ongoing</span>
                    }
                    {inc.duration_minutes && (
                      <span className="text-xs text-stone-400">
                        {formatDuration(inc.duration_minutes)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 font-mono">
                    Started: {formatDateTime(new Date(inc.started_at))}
                  </p>
                  {inc.resolved_at && (
                    <p className="text-xs text-stone-400 font-mono">
                      Resolved: {formatDateTime(new Date(inc.resolved_at))}
                    </p>
                  )}
                  {inc.root_cause && (
                    <p className="text-xs text-stone-400 mt-1 truncate" title={inc.root_cause}>
                      {inc.root_cause}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <MonitorModal
          monitor={monitor}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </PageShell>
  );
}

// ─── Helpers ──────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}

function Metric({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold text-stone-900 mt-0.5 ${mono ? 'font-mono' : 'font-display'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { up: 'bg-green-500', down: 'bg-red-500', timeout: 'bg-amber-500' };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-stone-300'}`} />;
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 bg-stone-200 rounded w-24" />
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <div className="h-6 bg-stone-200 rounded w-1/3 mb-2" />
        <div className="h-4 bg-stone-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function formatRelative(date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function formatDateTime(date) {
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function formatDuration(minutes) {
  const m = parseFloat(minutes);
  if (m < 60)  return `${Math.round(m)}m downtime`;
  return `${(m / 60).toFixed(1)}h downtime`;
}
