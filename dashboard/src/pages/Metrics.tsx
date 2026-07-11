import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { fetchMetrics, fetchMetricSeries, queryMetrics } from "@/lib/api";
import type { Metric } from "@/lib/mockData";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToInterval, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { chartPalette, chart as chartColors } from "@/lib/colors";

type MetricWithSeries = Metric & {
  series: { t: string; value: number }[];
};

export default function Metrics() {
  const [metrics, setMetrics] = useState<MetricWithSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<{ name: string; unit: string; points: { t: string; value: number }[] }[] | null>(null);
  const [querying, setQuerying] = useState(false);

  const load = useCallback(async (r: TimeRange) => {
    const minutes = rangeToMinutes(r);
    const interval = rangeToInterval(r);
    const allMetrics = await fetchMetrics();

    // Fetch series for each metric in parallel
    const withSeries = await Promise.all(
      allMetrics.map(async (m) => {
        const series = await fetchMetricSeries(m.name, minutes, interval);
        return { ...m, series };
      })
    );

    setMetrics(withSeries);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const refresh = useAutoRefresh(() => load(range));

  const handleExecute = useCallback(async () => {
    if (!query.trim()) return;
    setQuerying(true);
    try {
      const minutes = rangeToMinutes(range);
      const interval = rangeToInterval(range);
      const result = await queryMetrics({ name: query.trim(), minutes, interval });
      setQueryResult(result.series);
    } catch {
      setQueryResult([]);
    } finally {
      setQuerying(false);
    }
  }, [query, range]);

  function fmtValue(v: number): string {
    if (v >= 1000) return Math.round(v).toLocaleString();
    if (v >= 1) return Math.round(v).toString();
    return v.toFixed(2);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">Infrastructure &amp; application metrics · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      {/* Query bar */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleExecute()}
          placeholder="Search metrics, e.g. http.server.duration"
          className="h-8 flex-1 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <button
          onClick={handleExecute}
          disabled={querying}
          className="h-8 px-4 text-xs font-medium rounded bg-secondary border border-border hover:border-ring disabled:opacity-50 transition-colors"
        >
          {querying ? "Loading..." : "Query"}
        </button>
      </div>

      {/* Query results */}
      {queryResult !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Query results · {queryResult.length} series
            </div>
            <button
              onClick={() => setQueryResult(null)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              clear
            </button>
          </div>
          {queryResult.length === 0 ? (
            <div className="panel p-5 text-sm text-muted-foreground">No results found for &ldquo;{query}&rdquo;</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {queryResult.map((s, idx) => {
                const color = chartPalette[idx % chartPalette.length];
                return (
                  <div key={s.name} className="panel p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="font-mono text-xs truncate">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 ml-2">{s.unit}</span>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer>
                        <LineChart data={s.points}>
                          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                          <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={40} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                          />
                          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Metric panels with inline charts */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading metrics...</div>
      ) : metrics.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No metrics data. Send telemetry to get started.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {metrics.map((m, idx) => {
            const color = chartPalette[idx % chartPalette.length];
            const positive = m.delta >= 0;
            const latestValue = m.series.length > 0 ? m.series[m.series.length - 1].value : m.value;

            return (
              <Link
                key={m.id}
                to={`/app/metrics/${m.id}`}
                className="panel p-4 hover:border-ring/40 transition-colors group"
              >
                {/* Header row: name + current value */}
                <div className="flex items-start justify-between mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="font-mono text-xs text-foreground truncate">{m.name}</span>
                    </div>
                    {m.description && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 ml-4 truncate">{m.description}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-lg font-mono font-medium leading-tight">
                      {fmtValue(latestValue)}
                      {m.unit && <span className="text-xs text-muted-foreground ml-1">{m.unit}</span>}
                    </div>
                    <div className={`text-[10px] font-mono ${positive ? "text-status-warn" : "text-status-ok"}`}>
                      {positive ? "+" : ""}{m.delta.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Inline chart */}
                <div className="h-24 mt-2">
                  {m.series.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">
                      No data in range
                    </div>
                  ) : (
                    <ResponsiveContainer>
                      <AreaChart data={m.series}>
                        <defs>
                          <linearGradient id={`mg-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                        <XAxis
                          dataKey="t"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={8}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={8}
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v >= 1 ? Math.round(v).toString() : v.toFixed(1)}
                        />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                          formatter={(value: number) => [fmtValue(value) + (m.unit ? ` ${m.unit}` : ""), m.name]}
                          labelFormatter={(label: string) => label}
                        />
                        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#mg-${m.id})`} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
