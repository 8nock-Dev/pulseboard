import { Link } from 'react-router-dom';

const STATUS_LABELS = {
  up:      { label: 'Operational', color: 'text-green-700 bg-green-50 border-green-200', dot: 'status-dot-up' },
  down:    { label: 'Down',        color: 'text-red-700 bg-red-50 border-red-200',       dot: 'status-dot-down' },
  pending: { label: 'Pending',     color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'status-dot-pending' },
};

export default function MonitorCard({ monitor, onEdit, onDelete }) {
  const status   = STATUS_LABELS[monitor.current_status] || STATUS_LABELS.pending;
  const uptime   = parseFloat(monitor.uptime_percentage || 100).toFixed(2);
  const lastSeen = monitor.last_checked_at
    ? formatRelative(new Date(monitor.last_checked_at))
    : 'Never checked';

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        {/* Left: info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Status dot */}
          <div className="mt-1 flex-shrink-0">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${status.dot}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                to={`/monitors/${monitor.id}`}
                className="font-display font-semibold text-stone-900 hover:text-stone-600 transition-colors"
              >
                {monitor.name}
              </Link>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                {status.label}
              </span>
              {monitor.open_incidents > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  {monitor.open_incidents} incident{monitor.open_incidents > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <p className="text-stone-400 text-sm font-mono mt-0.5 truncate">
              {monitor.url}
            </p>

            <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
              <span>Every {monitor.interval_minutes}m</span>
              <span>·</span>
              <span>{lastSeen}</span>
            </div>
          </div>
        </div>

        {/* Right: stats + actions */}
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="font-mono text-lg font-semibold text-stone-900">{uptime}%</p>
            <p className="text-xs text-stone-400">30-day uptime</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
              title="Edit monitor"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete monitor"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelative(date) {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)   return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
