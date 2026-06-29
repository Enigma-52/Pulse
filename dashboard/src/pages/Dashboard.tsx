import { useEffect, useState, useCallback } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import StatCard from "@/components/StatCard";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, rangeToStartEnd, rangeToInterval } from "@/components/TimeRangeSelector";
import type { Trace } from "@/lib/mockData";
import { fetchTraces, fetchDashboardSummary, fetchMetricSeries, type DashboardData } from "@/lib/api";
import { Link } from "react-router-dom";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [reqSeries, setReqSeries] = useState<{ t: number; value: number }[]>([]);
  const [range, setRange] = useState<TimeRange>("15m");

  const load = useCallback((r: TimeRange) => {
    const minutes = rangeToMinutes(r);
    const { start, end } = rangeToStartEnd(r);
    const interval = rangeToInterval(r);

    fetchDashboardSummary(minutes).then(setSummary);
    fetchTraces({ start, end, limit: 6 }).then(setTraces);
    fetchMetricSeries("http.server.duration", minutes, interval).then((s) => {
      if (s.length > 0) setReqSeries(s);
    });
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const refresh = useAutoRefresh(() => load(range));

  const rate = summary?.requestRate ?? 0;
  const p99 = summary?.p99Latency ?? 0;
  const errRate = summary?.errorRate ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">production · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Requests" value={rate.toFixed(1)} unit="req/s" />
        <StatCard label="p99 latency" value={p99.toFixed(0)} unit="ms" inverse />
        <StatCard label="Error rate" value={errRate.toFixed(2)} unit="%" inverse />
        <StatCard label="Traces" value={String(summary?.traceCount ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="data-label">Request volume</div>
              <div className="text-sm mt-1">http.server.duration metric series</div>
            </div>
          </div>
          <div className="h-64">
            {reqSeries.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No metric data yet</div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={reqSeries}>
                  <defs>
                    <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={1.5} fill="url(#req)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <div className="data-label mb-4">Recent activity</div>
          <div className="space-y-3">
            {traces.length === 0 ? (
              <div className="text-xs text-muted-foreground">No traces yet</div>
            ) : (
              traces.slice(0, 7).map(t => (
                <Link key={t.id} to={`/app/traces/${t.id}`} className="flex items-center gap-3 text-sm hover:bg-secondary/40 -mx-2 px-2 py-1 rounded">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.status === "error" ? "bg-status-error" : "bg-status-ok"}`} />
                  <span className="flex-1 truncate font-mono text-xs">{t.name || t.service}</span>
                  <span className="font-mono text-xs text-muted-foreground w-16 text-right">{t.duration}ms</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="data-label">Recent traces</div>
            <div className="text-sm mt-1">Latest spans across all services</div>
          </div>
          <Link to="/app/traces" className="text-xs font-mono text-muted-foreground hover:text-foreground">view all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">ID</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Operation</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Duration</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {traces.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-muted-foreground">No traces found. Send telemetry data first.</td></tr>
            ) : (
              traces.map(t => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                    <Link to={`/app/traces/${t.id}`} className="hover:text-foreground">{t.id.slice(0, 10)}</Link>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs">{t.name}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">{t.service}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-right">{t.duration}ms</td>
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
