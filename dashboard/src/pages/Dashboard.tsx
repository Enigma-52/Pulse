import { useEffect, useState, useCallback } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, rangeToStartEnd, rangeToIntervalMinutes } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import { useEnvironment } from "@/lib/environment";
import type { Trace } from "@/lib/types";
import { fetchTraces, fetchDashboardSummary, fetchServicesTimeseries, type DashboardData } from "@/lib/api";
import { Link } from "react-router-dom";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { chart as chartColors, status as statusColors } from "@/lib/colors";
import { axisTick, fullTimestamp, spanMinutes, windowCaption } from "@/lib/chartTime";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [errorTraces, setErrorTraces] = useState<Trace[]>([]);
  const [reqSeries, setReqSeries] = useState<{ tms: number; value: number }[]>([]);
  const { range, setRange } = useGlobalTimeRange();
  const { environment } = useEnvironment();
  const intervalMinutes = rangeToIntervalMinutes(range);

  const load = useCallback((r: TimeRange, env: string) => {
    const minutes = rangeToMinutes(r);
    const { start, end } = rangeToStartEnd(r);

    fetchDashboardSummary(minutes, env).then(setSummary);
    fetchTraces({ start, end, limit: 6, environment: env }).then(setTraces);
    // Recent activity panel = recent errors only, so it complements (not
    // duplicates) the full recent-traces table below.
    fetchTraces({ start, end, limit: 8, status: "error", environment: env }).then(setErrorTraces);
    // Request volume from traces: sum per-service counts into one series.
    fetchServicesTimeseries(minutes, rangeToIntervalMinutes(r), 12, env).then((points) => {
      const byTime = new Map<string, number>();
      for (const pt of points) {
        byTime.set(pt.timestamp, (byTime.get(pt.timestamp) ?? 0) + pt.value);
      }
      setReqSeries(
        Array.from(byTime.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ts, value]) => ({ tms: new Date(ts).getTime(), value })),
      );
    });
  }, []);

  useEffect(() => {
    load(range, environment);
  }, [range, environment, load]);

  const refresh = useAutoRefresh(() => load(range, environment));

  const rate = summary?.requestRate ?? 0;
  const p99 = summary?.p99Latency ?? 0;
  const errRate = summary?.errorRate ?? 0;
  const traceCount = summary?.traceCount ?? 0;

  const stats = [
    { label: "Request rate", value: rate.toFixed(1), unit: "req/s", color: chartColors.primary, to: "/app/traces" },
    { label: "p99 latency", value: p99.toFixed(0), unit: "ms", color: chartColors.secondary, to: "/app/traces?view=analytics" },
    { label: "Error rate", value: errRate.toFixed(2), unit: "%", color: errRate > 1 ? statusColors.error : statusColors.ok, to: "/app/traces?status=error" },
    { label: "Total traces", value: traceCount.toLocaleString(), unit: "", color: chartColors.tertiary, to: "/app/traces" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">{environment || "all environments"} · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Link key={s.label} to={s.to} className="panel p-4 relative overflow-hidden hover:border-ring/40 transition-colors">
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: s.color }} />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl font-mono font-medium tracking-tight">{s.value}</span>
              {s.unit && <span className="text-xs text-muted-foreground font-mono">{s.unit}</span>}
            </div>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Request Volume Chart */}
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Request volume</div>
              <div className="text-sm text-muted-foreground mt-0.5">requests · {intervalMinutes}m buckets</div>
            </div>
          </div>
          <div className="h-64">
            {reqSeries.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No requests in this time range</div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={reqSeries}>
                  <defs>
                    <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="tms" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} minTickGap={44} tickFormatter={(v) => axisTick(v, spanMinutes(reqSeries.map((p) => ({ timestamp: p.tms }))))} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                    labelFormatter={(v) => fullTimestamp(Number(v))}
                  />
                  <Area type="monotone" dataKey="value" stroke={chartColors.primary} strokeWidth={1.5} fill="url(#req)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {reqSeries.length > 0 && (
            <div className="mt-1 text-[10px] font-mono text-muted-foreground text-right">{windowCaption(reqSeries.map((p) => ({ timestamp: p.tms })))}</div>
          )}
        </div>

        {/* Recent Errors — complements the full recent-traces table below */}
        <div className="panel flex flex-col">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent errors</div>
            <Link to="/app/traces?status=error" className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">view all →</Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            {errorTraces.length === 0 ? (
              <div className="px-5 py-8 text-xs text-muted-foreground text-center">No errors in this range</div>
            ) : (
              <div className="divide-y divide-border">
                {errorTraces.map(t => (
                  <Link key={t.id} to={`/app/traces/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-status-error" />
                    <span className="flex-1 truncate font-mono text-xs">{t.name || t.service}</span>
                    <span className="font-mono text-[10px] text-muted-foreground w-16 text-right">{t.duration}ms</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Traces Table */}
      <div className="panel">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent traces</div>
          <Link to="/app/traces" className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">view all →</Link>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Trace ID</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Operation</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Duration</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {traces.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-muted-foreground">No traces found</td></tr>
            ) : (
              traces.map(t => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="px-5 py-2.5 font-mono text-muted-foreground">
                    <Link to={`/app/traces/${t.id}`} className="hover:text-foreground transition-colors">{t.id.slice(0, 12)}</Link>
                  </td>
                  <td className="px-5 py-2.5 font-mono">{t.name}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    <Link to={`/app/services/${t.service}`} className="hover:text-foreground transition-colors">{t.service}</Link>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-right">{t.duration}ms</td>
                  <td className="px-5 py-2.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      t.status === "ok" ? "border-status-ok/40 text-status-ok" : "border-status-error/40 text-status-error"
                    }`}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
