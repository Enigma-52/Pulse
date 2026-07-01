import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fetchMetrics, queryMetrics } from "@/lib/api";
import type { Metric } from "@/lib/mockData";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToInterval, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";

export default function Metrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("15m");
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<{ name: string; unit: string; points: { t: string; value: number }[] }[] | null>(null);
  const [querying, setQuerying] = useState(false);

  useEffect(() => {
    fetchMetrics()
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!query.trim()) return;
    setQuerying(true);
    try {
      const minutes = rangeToMinutes(range);
      const interval = rangeToInterval(range);
      const result = await queryMetrics({
        name: query.trim(),
        minutes,
        interval,
      });
      setQueryResult(result.series);
    } catch {
      setQueryResult([]);
    } finally {
      setQuerying(false);
    }
  }, [query, range]);

  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">Time-series across the cluster · {rangeToLabel(range)}</p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleExecute()}
          placeholder="Enter metric name, e.g. http.requests.total"
          className="h-9 flex-1 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <button
          onClick={handleExecute}
          disabled={querying}
          className="h-9 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring disabled:opacity-50"
        >
          {querying ? "Loading..." : "Execute"}
        </button>
      </div>

      {queryResult !== null && (
        <div className="space-y-3">
          {queryResult.length === 0 ? (
            <div className="panel p-5 text-sm text-muted-foreground">No results found for "{query}"</div>
          ) : (
            queryResult.map((s, idx) => (
              <div key={s.name} className="panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{s.name}</div>
                    <div className="text-sm mt-1">{s.unit}</div>
                  </div>
                  <button
                    onClick={() => setQueryResult(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    clear
                  </button>
                </div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart data={s.points}>
                      <defs>
                        <linearGradient id={`q-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke={chartColors[idx % chartColors.length]} strokeWidth={1.25} fill={`url(#q-${idx})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading metrics...</div>
      ) : metrics.length === 0 ? (
        <div className="text-sm text-muted-foreground">No metrics data</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {metrics.map((m) => {
          const positive = m.delta >= 0;
          return (
            <Link
              key={m.id}
              to={`/app/metrics/${m.id}`}
              className="panel p-5 hover:border-ring/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground truncate">{m.name}</div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-mono">{m.value >= 1 ? Math.round(m.value).toLocaleString() : m.value.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground font-mono">{m.unit}</span>
                  </div>
                </div>
                <span className={`text-xs font-mono ${positive ? "text-status-warn" : "text-status-ok"}`}>
                  {positive ? "+" : ""}{m.delta.toFixed(1)}%
                </span>
              </div>
              <div className="h-5 mt-3" />
              <div className="text-xs text-muted-foreground mt-2 truncate">{m.description}</div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
