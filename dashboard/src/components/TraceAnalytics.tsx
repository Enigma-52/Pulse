import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import {
  fetchTraceAnalytics,
  fetchTraceAnalyticsTimeseries,
  fetchSlowestTraces,
  type TraceAnalyticsRow,
  type TraceAnalyticsPoint,
  type SlowTrace,
} from "@/lib/api";
import { type TimeRange, rangeToMinutes, rangeToInterval, rangeToIntervalMinutes } from "@/components/TimeRangeSelector";
import { serviceColor, chartPalette, fmtMs } from "@/lib/colors";
import { axisTick, fullTimestamp, spanMinutes } from "@/lib/chartTime";

type GroupBy = "service" | "route" | "name";
type Metric = "count" | "p95" | "error_rate";
type SortKey = "trace_count" | "avg_ms" | "p95_ms" | "p99_ms" | "error_rate";

const GROUP_LABELS: Record<GroupBy, string> = { service: "Service", route: "Route", name: "Operation" };
const METRIC_LABELS: Record<Metric, string> = { count: "Request count", p95: "p95 latency", error_rate: "Error rate" };

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
};

export default function TraceAnalytics({ range, service }: { range: TimeRange; service?: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("service");
  const [metric, setMetric] = useState<Metric>("error_rate");
  const [sortKey, setSortKey] = useState<SortKey>("trace_count");
  const [rows, setRows] = useState<TraceAnalyticsRow[]>([]);
  const [points, setPoints] = useState<TraceAnalyticsPoint[]>([]);
  const [slowest, setSlowest] = useState<SlowTrace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const minutes = rangeToMinutes(range);
    setLoading(true);
    Promise.all([
      fetchTraceAnalytics({ groupBy, service, minutes }).then(setRows),
      fetchTraceAnalyticsTimeseries({ metric, groupBy, service, minutes, interval: rangeToIntervalMinutes(range) }).then(setPoints),
      fetchSlowestTraces({ service, minutes, limit: 10 }).then(setSlowest),
    ]).finally(() => setLoading(false));
  }, [range, service, groupBy, metric]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)),
    [rows, sortKey],
  );

  const { chartData, groups } = useMemo(() => {
    const groupSet: string[] = [];
    const byTime = new Map<string, Record<string, number | string>>();
    for (const p of points) {
      if (!groupSet.includes(p.group)) groupSet.push(p.group);
      const key = p.timestamp;
      if (!byTime.has(key)) {
        byTime.set(key, { tms: new Date(p.timestamp).getTime() });
      }
      byTime.get(key)![p.group] = p.value;
    }
    return { chartData: Array.from(byTime.values()), groups: groupSet };
  }, [points]);

  const groupColor = (g: string, i: number) =>
    groupBy === "service" ? serviceColor(g) : chartPalette[i % chartPalette.length];

  const header = (key: SortKey, label: string) => (
    <th
      onClick={() => setSortKey(key)}
      className={`px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right cursor-pointer select-none hover:text-foreground ${
        sortKey === key ? "text-foreground" : ""
      }`}
    >
      {label}{sortKey === key ? " ↓" : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="data-label">Group by</span>
        {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`h-7 px-2.5 text-xs rounded border transition-colors ${
              groupBy === g ? "border-ring bg-secondary text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {GROUP_LABELS[g]}
          </button>
        ))}
        <span className="data-label ml-4">Chart</span>
        {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`h-7 px-2.5 text-xs rounded border transition-colors ${
              metric === m ? "border-ring bg-secondary text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
          {METRIC_LABELS[metric]} over time · top {groups.length} by volume
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{loading ? "Loading..." : "No data in this time range."}</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="tms" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} minTickGap={44} tickFormatter={(v) => axisTick(v, spanMinutes(chartData.map((d) => ({ timestamp: d.tms as number }))))} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fullTimestamp(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {groups.map((g, i) => (
                  <Line key={g} type="monotone" dataKey={g} stroke={groupColor(g, i)} strokeWidth={1.5} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Breakdown by {GROUP_LABELS[groupBy].toLowerCase()}</div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">{GROUP_LABELS[groupBy]}</th>
              {header("trace_count", "Spans")}
              {header("avg_ms", "Avg")}
              {header("p95_ms", "p95")}
              {header("p99_ms", "p99")}
              {header("error_rate", "Error rate")}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading analytics...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No traces in this time range.</td></tr>
            ) : (
              sorted.map((r, i) => {
                const errClass = r.error_rate > 5 ? "text-status-error" : r.error_rate > 1 ? "text-status-warn" : "text-muted-foreground";
                return (
                  <tr key={r.group} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-2.5 font-mono max-w-[320px] truncate">
                      {groupBy === "service" ? (
                        <Link to={`/app/services/${encodeURIComponent(r.group)}`} className="inline-flex items-center gap-1.5 hover:underline">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: groupColor(r.group, i) }} />
                          {r.group}
                        </Link>
                      ) : (
                        r.group || "(none)"
                      )}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-right">{r.trace_count.toLocaleString()}</td>
                    <td className="px-5 py-2.5 font-mono text-right text-muted-foreground">{fmtMs(r.avg_ms)}</td>
                    <td className="px-5 py-2.5 font-mono text-right text-muted-foreground">{fmtMs(r.p95_ms)}</td>
                    <td className="px-5 py-2.5 font-mono text-right">{fmtMs(r.p99_ms)}</td>
                    <td className={`px-5 py-2.5 font-mono text-right ${errClass}`}>{r.error_rate.toFixed(2)}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Slowest traces</div>
        </div>
        <table className="w-full text-xs">
          <tbody>
            {slowest.length === 0 ? (
              <tr><td className="px-5 py-6 text-center text-sm text-muted-foreground">No traces in this time range.</td></tr>
            ) : (
              slowest.map((t) => (
                <tr key={t.trace_id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-5 py-2.5 font-mono">
                    <Link to={`/app/traces/${t.trace_id}`} className="text-muted-foreground hover:text-foreground">{t.trace_id.slice(0, 12)}</Link>
                  </td>
                  <td className="px-5 py-2.5 font-mono max-w-[280px] truncate">{t.name}</td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                      <span className="w-2 h-2 rounded-full" style={{ background: serviceColor(t.service) }} />
                      {t.service}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-right font-medium">{fmtMs(t.duration_ms)}</td>
                  <td className="px-5 py-2.5 text-right">
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
