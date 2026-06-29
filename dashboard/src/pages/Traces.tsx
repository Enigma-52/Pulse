import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import TimeRangeSelector, { type TimeRange, rangeToStartEnd, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import type { Trace } from "@/lib/mockData";
import { fetchTraces } from "@/lib/api";

function buildDurationBuckets(traces: Trace[]) {
  if (traces.length === 0) return [];
  const durations = traces.map(t => t.duration);
  const max = Math.max(...durations);
  const bucketCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(traces.length))));
  const bucketSize = Math.max(1, Math.ceil(max / bucketCount));
  const buckets: { label: string; count: number; from: number; to: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const from = i * bucketSize;
    const to = (i + 1) * bucketSize;
    const count = durations.filter(d => d >= from && d < to).length;
    if (i < bucketCount - 1 || count > 0) {
      buckets.push({ label: `${from}`, count, from, to });
    }
  }

  // Trim trailing empty buckets
  while (buckets.length > 0 && buckets[buckets.length - 1].count === 0) {
    buckets.pop();
  }
  return buckets;
}

export default function Traces() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("15m");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback((r: TimeRange, service?: string, status?: string) => {
    setLoading(true);
    const { start, end } = rangeToStartEnd(r);
    fetchTraces({
      start,
      end,
      service: service || undefined,
      status: status || undefined,
    })
      .then(setTraces)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(range, serviceFilter, statusFilter);
  }, [range, serviceFilter, statusFilter, load]);

  const refresh = useAutoRefresh(() => load(range, serviceFilter, statusFilter));

  const handleFilter = () => {
    load(range, serviceFilter, statusFilter);
  };

  const durationBuckets = useMemo(() => buildDurationBuckets(traces), [traces]);
  const p50 = useMemo(() => {
    if (traces.length === 0) return 0;
    const sorted = [...traces].sort((a, b) => a.duration - b.duration);
    return sorted[Math.floor(sorted.length * 0.5)]?.duration ?? 0;
  }, [traces]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Traces</h1>
          <p className="text-sm text-muted-foreground mt-1">Service dependency graph and recent spans · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={serviceFilter}
          onChange={e => setServiceFilter(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFilter()}
          placeholder="Filter by service name"
          className="h-8 w-56 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-8 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring text-foreground"
        >
          <option value="">All statuses</option>
          <option value="ok">OK</option>
          <option value="error">Error</option>
        </select>
        <button onClick={handleFilter} className="h-8 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">Filter</button>
      </div>

      {durationBuckets.length > 0 && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="data-label">Duration distribution</div>
              <div className="text-sm mt-1 text-muted-foreground">{traces.length} traces · p50 = {p50}ms</div>
            </div>
          </div>
          <div className="h-32">
            <ResponsiveContainer>
              <BarChart data={durationBuckets}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }}
                  formatter={(value: number) => [`${value} traces`, "Count"]}
                  labelFormatter={(label: string) => `${label}ms`}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {durationBuckets.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--chart-1))" fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="px-5 py-4 border-b border-border">
          <div className="data-label">Trace stream</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Time</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Trace ID</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Operation</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Duration</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Spans</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading traces...</td>
              </tr>
            ) : traces.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">No traces found</td>
              </tr>
            ) : traces.map(t => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{t.timestamp}</td>
                <td className="px-5 py-2.5 font-mono text-xs">
                  <Link to={`/app/traces/${t.id}`} className="hover:underline">{t.id}</Link>
                </td>
                <td className="px-5 py-2.5 font-mono text-xs">{t.name}</td>
                <td className="px-5 py-2.5 text-muted-foreground">{t.service}</td>
                <td className="px-5 py-2.5 font-mono text-xs text-right">{t.duration}ms</td>
                <td className="px-5 py-2.5 font-mono text-xs text-right text-muted-foreground">{t.spans}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    t.status === "ok" ? "border-status-ok/40 text-status-ok" : "border-status-error/40 text-status-error"
                  }`}>
                    {t.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
