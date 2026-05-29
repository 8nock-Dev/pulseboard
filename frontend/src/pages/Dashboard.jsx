import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Header       from '../components/Header';
import MonitorCard  from '../components/MonitorCard';
import MonitorModal from '../components/MonitorModal';

export default function Dashboard() {
  const { token, user }   = useAuth();
  const [monitors, setMonitors]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [sseStatus, setSseStatus] = useState('connecting'); // connecting | live | offline
  const esRef = useRef(null);

  // ─── Fetch all monitors ────────────────────────────────
  const fetchMonitors = useCallback(async () => {
    try {
      const res = await api.get('/monitors');
      setMonitors(res.data);
    } catch (err) {
      console.error('Failed to fetch monitors:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  // ─── SSE real-time connection ──────────────────────────
  useEffect(() => {
    if (!token) return;

    function connect() {
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const url     = `${apiBase}/events?token=${token}`;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => setSseStatus('live');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected' || data.type === 'heartbeat') return;

          if (data.type === 'monitor_update') {
            setMonitors(prev => prev.map(m =>
              m.id === data.monitorId
                ? {
                    ...m,
                    current_status:    data.status,
                    last_checked_at:   data.lastCheckedAt,
                    uptime_percentage: data.uptimePercentage,
                  }
                : m
            ));
          }
        } catch {
          // Malformed event — ignore
        }
      };

      es.onerror = () => {
        setSseStatus('offline');
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
    };
  }, [token]);

  // ─── Computed stats ───────────────────────────────────
  const upCount   = monitors.filter(m => m.current_status === 'up').length;
  const downCount = monitors.filter(m => m.current_status === 'down').length;
  const avgUptime = monitors.length > 0
    ? (monitors.reduce((a, m) => a + parseFloat(m.uptime_percentage || 100), 0) / monitors.length).toFixed(1)
    : '100.0';

  // ─── Actions ──────────────────────────────────────────
  function openAdd() { setEditing(null); setShowModal(true); }
  function openEdit(m) { setEditing(m); setShowModal(true); }

  async function handleDelete(id) {
    if (!window.confirm('Delete this monitor and all its history?')) return;
    try {
      await api.delete(`/monitors/${id}`);
      setMonitors(prev => prev.filter(m => m.id !== id));
    } catch {
      alert('Failed to delete monitor. Please try again.');
    }
  }

  async function handleSave(formData) {
    try {
      if (editing) {
        const res = await api.put(`/monitors/${editing.id}`, formData);
        setMonitors(prev => prev.map(m => m.id === editing.id ? res.data : m));
      } else {
        const res = await api.post('/monitors', formData);
        setMonitors(prev => [...prev, res.data]);
      }
      setShowModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save monitor.');
    }
  }

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Monitors"    value={monitors.length} />
          <StatCard label="Operational" value={upCount}   color="green" />
          <StatCard label="Down"        value={downCount} color="red" />
          <StatCard label="Avg uptime"  value={`${avgUptime}%`} color="blue" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-xl text-stone-900">
              Monitors
            </h1>
            <LiveBadge status={sseStatus} />
          </div>

          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add monitor
          </button>
        </div>

        {/* Monitor list */}
        {loading ? (
          <LoadingSkeleton />
        ) : monitors.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <div className="space-y-3">
            {monitors.map(monitor => (
              <MonitorCard
                key={monitor.id}
                monitor={monitor}
                onEdit={() => openEdit(monitor)}
                onDelete={() => handleDelete(monitor.id)}
              />
            ))}
          </div>
        )}

        {/* Status page link */}
        {monitors.length > 0 && user && (
          <div className="mt-8 p-4 bg-white border border-stone-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-700">Your public status page</p>
              <p className="text-xs text-stone-400 mt-0.5">
                Share this with your users to show real-time service status
              </p>
            </div>
            <a
              href={`/status/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 border border-stone-300 text-sm font-medium text-stone-700 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap"
            >
              View status page
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </main>

      {showModal && (
        <MonitorModal
          monitor={editing}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function StatCard({ label, value, color }) {
  const colors = {
    green: 'text-green-600',
    red:   'text-red-600',
    blue:  'text-blue-600',
  };
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-4">
      <p className="text-stone-400 text-xs uppercase tracking-wider font-medium">{label}</p>
      <p className={`font-mono text-3xl font-bold mt-1 ${colors[color] || 'text-stone-900'}`}>
        {value}
      </p>
    </div>
  );
}

function LiveBadge({ status }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-dot-up" />
        Live
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Reconnecting…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
      Connecting…
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white border border-stone-200 rounded-xl p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-stone-200 rounded w-1/4" />
              <div className="h-3 bg-stone-100 rounded w-1/3" />
            </div>
            <div className="h-6 bg-stone-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-24 border-2 border-dashed border-stone-200 rounded-2xl bg-white">
      <div className="text-5xl mb-4 select-none">📡</div>
      <h3 className="font-display font-semibold text-stone-700 text-lg mb-1.5">
        No monitors yet
      </h3>
      <p className="text-stone-400 text-sm mb-6 max-w-xs mx-auto">
        Add your first monitor to start tracking uptime and response times.
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
      >
        Add your first monitor
      </button>
    </div>
  );
}
