import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

const OVERALL_CONFIG = {
  operational: {
    label: 'All systems operational',
    sub:   'Everything is running smoothly.',
    bg:    'bg-green-50 border-green-200',
    text:  'text-green-800',
    icon:  '✅',
  },
  degraded: {
    label: 'Partial service disruption',
    sub:   'Some services are experiencing issues.',
    bg:    'bg-red-50 border-red-200',
    text:  'text-red-800',
    icon:  '🔴',
  },
  pending: {
    label: 'Status pending',
    sub:   'Collecting monitoring data…',
    bg:    'bg-amber-50 border-amber-200',
    text:  'text-amber-800',
    icon:  '⏳',
  },
};

export default function StatusPage() {
  const { userId } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    api.get(`/status/${userId}`)
      .then(res => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    // Refresh every 60 seconds
    const interval = setInterval(() => {
      api.get(`/status/${userId}`)
        .then(res => setData(res.data))
        .catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, [userId]);

  if (loading) return <Shell><LoadingState /></Shell>;
  if (error)   return <Shell><ErrorState /></Shell>;
  if (!data)   return null;

  const overall = OVERALL_CONFIG[data.overall_status] || OVERALL_CONFIG.pending;
  const openIncidents = data.incidents.filter(i => !i.is_resolved);

  return (
    <Shell>
      {/* Branding */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xl">📡</span>
          <span className="font-display font-bold text-stone-900 text-lg">
            {data.owner}'s Status
          </span>
        </div>
        <p className="text-stone-400 text-xs">
          Powered by{' '}
          <span className="font-medium text-stone-500">PulseBoard</span>
          {' '}· Updated {formatRelative(new Date(data.generated_at))}
        </p>
      </div>

      {/* Overall status banner */}
      <div className={`border rounded-2xl p-6 mb-8 text-center ${overall.bg}`}>
        <div className="text-3xl mb-2">{overall.icon}</div>
        <h1 className={`font-display font-bold text-xl ${overall.text}`}>{overall.label}</h1>
        <p className={`text-sm mt-1 ${overall.text} opacity-70`}>{overall.sub}</p>
      </div>

      {/* Active incidents */}
      {openIncidents.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-semibold text-stone-900 mb-3">Active incidents</h2>
          <div className="space-y-3">
            {openIncidents.map((inc, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 status-dot-down" />
                  <span className="font-medium text-red-800 text-sm">{inc.monitor_name}</span>
                  <span className="text-xs text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                    Ongoing
                  </span>
                </div>
                <p className="text-xs text-red-600 font-mono">
                  Since {formatDateTime(new Date(inc.started_at))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services list */}
      <div className="mb-8">
        <h2 className="font-display font-semibold text-stone-900 mb-3">Services</h2>
        {data.monitors.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-8">No public services to display.</p>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100">
            {data.monitors.map(m => {
              const s = m.current_status;
              return (
                <div key={m.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      s === 'up'      ? 'bg-green-500 status-dot-up'  :
                      s === 'down'    ? 'bg-red-500 status-dot-down'  :
                      'bg-amber-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-stone-900">{m.name}</p>
                      <p className="text-xs text-stone-400 font-mono">{m.url}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      s === 'up' ? 'text-green-700' : s === 'down' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {s === 'up' ? 'Operational' : s === 'down' ? 'Disrupted' : 'Checking…'}
                    </p>
                    <p className="text-xs text-stone-400 font-mono">
                      {parseFloat(m.uptime_percentage || 100).toFixed(2)}% uptime
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past incidents */}
      {data.incidents.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-stone-900 mb-3">Incident history</h2>
          <div className="space-y-3">
            {data.incidents.filter(i => i.is_resolved).slice(0, 5).map((inc, i) => (
              <div key={i} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                      Resolved
                    </span>
                    <span className="text-sm font-medium text-stone-700">{inc.monitor_name}</span>
                  </div>
                  {inc.duration_minutes && (
                    <span className="text-xs text-stone-400">
                      {formatDuration(inc.duration_minutes)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400 font-mono">
                  {formatDateTime(new Date(inc.started_at))} →{' '}
                  {inc.resolved_at ? formatDateTime(new Date(inc.resolved_at)) : 'Ongoing'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center text-xs text-stone-300">
        <p>This status page refreshes automatically every 60 seconds.</p>
      </div>
    </Shell>
  );
}

// ─── Layout shell ─────────────────────────────────────────
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-stone-200 rounded w-48 mx-auto" />
      <div className="h-32 bg-stone-200 rounded-2xl" />
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">🔍</div>
      <h2 className="font-display font-bold text-xl text-stone-700 mb-2">Page not found</h2>
      <p className="text-stone-400 text-sm">This status page doesn't exist or has been removed.</p>
    </div>
  );
}

// ─── Utils ────────────────────────────────────────────────
function formatRelative(date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60)  return 'just now';
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
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(1)}h`;
}
