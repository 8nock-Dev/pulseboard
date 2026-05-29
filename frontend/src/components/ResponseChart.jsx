import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

/**
 * ResponseChart
 *
 * Renders a response-time area chart from the last N check results.
 *
 * Props:
 *   checks - array of check objects from /api/monitors/:id/checks
 */
export default function ResponseChart({ checks = [] }) {
  // Reverse so chronological order (oldest → newest)
  const data = [...checks]
    .reverse()
    .slice(-100) // last 100 data points
    .map(c => ({
      time: formatTime(new Date(c.checked_at)),
      ms:   c.status === 'up' ? c.response_time_ms : null,
      down: c.status !== 'up' ? 1 : null,
    }));

  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-stone-400 text-sm">
        No check data yet — first results will appear shortly.
      </div>
    );
  }

  const maxMs = Math.max(...data.map(d => d.ms || 0));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradMs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F4" vertical={false} />

        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: '#A8A29E', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />

        <YAxis
          tickFormatter={v => `${v}ms`}
          tick={{ fontSize: 11, fill: '#A8A29E', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          domain={[0, maxMs > 0 ? Math.ceil(maxMs * 1.2) : 200]}
          width={55}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="ms"
          stroke="#16A34A"
          strokeWidth={1.5}
          fill="url(#gradMs)"
          dot={false}
          connectNulls={false}
          name="Response time"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ms = payload[0]?.value;

  return (
    <div className="bg-stone-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
      <p className="text-stone-400 mb-0.5">{label}</p>
      {ms != null
        ? <p className="font-mono font-medium">{ms} ms</p>
        : <p className="text-red-400 font-medium">Down / Timeout</p>
      }
    </div>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
