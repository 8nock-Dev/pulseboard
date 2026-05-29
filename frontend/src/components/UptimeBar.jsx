/**
 * UptimeBar
 *
 * Renders a 90-day uptime visualization — one colored segment per day.
 * Green = high uptime, yellow = degraded, red = significant downtime,
 * gray = no data yet.
 *
 * Props:
 *   data - array of { day, uptime_pct } from /api/monitors/:id/daily-uptime
 */
export default function UptimeBar({ data = [], days = 90 }) {
  // Build a map of date string -> uptime_pct
  const dataMap = new Map(
    data.map(d => [d.day.split('T')[0], parseFloat(d.uptime_pct)])
  );

  // Generate the last `days` calendar days
  const segments = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    segments.push({ date: key, uptime: dataMap.get(key) ?? null });
  }

  const overallUptime = data.length > 0
    ? (data.reduce((acc, d) => acc + parseFloat(d.uptime_pct || 0), 0) / data.length).toFixed(2)
    : '100.00';

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-xs text-stone-400">
        <span>90 days ago</span>
        <span className="font-mono font-medium text-stone-700">{overallUptime}% uptime</span>
        <span>Today</span>
      </div>

      <div className="flex gap-px overflow-hidden rounded-md">
        {segments.map(({ date, uptime }) => (
          <DaySegment key={date} date={date} uptime={uptime} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        {[
          { color: 'bg-stone-200', label: 'No data' },
          { color: 'bg-green-500', label: '100%' },
          { color: 'bg-yellow-400', label: '< 90%' },
          { color: 'bg-red-500',   label: '< 50%' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-sm ${color}`} />
            <span className="text-xs text-stone-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DaySegment({ date, uptime }) {
  const color = uptime === null
    ? 'bg-stone-200'
    : uptime >= 99  ? 'bg-green-500'
    : uptime >= 90  ? 'bg-green-400'
    : uptime >= 75  ? 'bg-yellow-400'
    : uptime >= 50  ? 'bg-orange-400'
    : 'bg-red-500';

  const label = uptime === null
    ? 'No data'
    : `${uptime.toFixed(2)}% uptime`;

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div
      className={`flex-1 h-8 ${color} cursor-pointer transition-opacity hover:opacity-70 relative group`}
      title={`${formattedDate}: ${label}`}
    >
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
        <div className="bg-stone-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
          <p className="font-medium">{formattedDate}</p>
          <p className="text-stone-300">{label}</p>
        </div>
        <div className="w-2 h-2 bg-stone-900 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}
