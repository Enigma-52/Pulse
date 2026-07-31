import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fetchMetrics, fetchMetricSeries, fetchMetricAttributes, type MetricAttribute } from "@/lib/api";
import type { Metric } from "@/lib/types";
import TimeRangeSelector, { type TimeRange, TIME_RANGES, rangeToMinutes, rangeToInterval, rangeToLabel } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { chart as chartColors, fmtMs } from "@/lib/colors";
import { axisTick, fullTimestamp, spanMinutes } from "@/lib/chartTime";

function fmtValue(v: number, unit: string): string {
  if (unit === "ms") return fmtMs(v).replace("ms", "");
  if (v >= 1000) return Math.round(v).toLocaleString();
  if (v >= 1) return v.toFixed(1);
  return v.toFixed(3);
}

export default function MetricDetail() {
  const { id } = useParams();
  const [metric, setMetric] = useState<Metric | null>(null);
  const [series, setSeries] = useState<{ tms: number; value: number }[]>([]);
  const [attributes, setAttributes] = useState<MetricAttribute[]>([]);
  const [attrFilter, setAttrFilter] = useState(""); // "key=value" or ""
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();

  const loadSeries = useCallback((m: Metric, r: TimeRange, filter?: string) => {
    const minutes = rangeToMinutes(r);
    const interval = rangeToInterval(r);
    const f = filter ?? attrFilter;
    const [key, ...rest] = f.split("=");
    const attr = f && rest.length > 0 ? { key, value: rest.join("=") } : undefined;
    fetchMetricSeries(m.name, minutes, interval, attr).then(setSeries);
    fetchMetricAttributes(m.name, minutes).then(setAttributes);
  }, [attrFilter]);

  useEffect(() => {
    fetchMetrics(rangeToMinutes(range)).then((all) => {
      const found = all.find((m) => m.id === id) ?? all[0] ?? null;
      setMetric(found);
      if (found) loadSeries(found, range);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (metric) loadSeries(metric, range);
  }, [range, metric, loadSeries]);

  const refresh = useAutoRefresh(() => {
    if (metric) loadSeries(metric, range);
  });

  // Compute stats from actual series data
  const stats = useMemo(() => {
    if (series.length === 0) return { current: 0, min: 0, max: 0, avg: 0 };
    const values = series.map(p => p.value);
    const current = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { current, min, max, avg };
  }, [series]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Loading metric...</div>
      </div>
    );
  }

  if (!metric) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/app/metrics" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to metrics
        </Link>
        <div className="panel p-8 text-center text-sm text-muted-foreground">No metrics data</div>
      </div>
    );
  }

  const unit = metric.unit || "";
  const statCards = [
    { label: "Current", value: fmtValue(stats.current, unit), color: chartColors.primary },
    { label: "Average", value: fmtValue(stats.avg, unit), color: chartColors.secondary },
    { label: "Min", value: fmtValue(stats.min, unit), color: chartColors.tertiary },
    { label: "Max", value: fmtValue(stats.max, unit), color: chartColors.quaternary },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/app/metrics" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to metrics
          </Link>
          <h1 className="text-xl font-mono tracking-tight">{metric.name}</h1>
          {metric.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{metric.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={TIME_RANGES} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="panel p-4 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: s.color }} />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-mono font-medium">{s.value}</span>
              {unit && <span className="text-xs text-muted-foreground font-mono">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Main chart */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.name}</div>
            <div className="text-sm text-muted-foreground mt-0.5 font-mono">
              {unit} · {rangeToLabel(range)} · {series.length} data points
            </div>
          </div>
          <div className="flex items-center gap-3">
            {attributes.length > 0 && (
              <select
                value={attrFilter}
                onChange={(e) => {
                  setAttrFilter(e.target.value);
                  if (metric) loadSeries(metric, range, e.target.value);
                }}
                className="h-7 px-2 text-[11px] font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring text-foreground max-w-[240px]"
              >
                <option value="">All attributes</option>
                {attributes.slice(0, 30).map((a) => (
                  <option key={`${a.key}=${a.value}`} value={`${a.key}=${a.value}`}>
                    {a.key}={a.value} ({a.count})
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: chartColors.primary }} />
              <span className="text-[10px] font-mono text-muted-foreground">{metric.name}</span>
            </div>
          </div>
        </div>
        <div className="h-80">
          {series.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No metric data in this range</div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="m-detail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="tms" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} minTickGap={44} tickFormatter={(v) => axisTick(v, spanMinutes(series.map((p) => ({ timestamp: p.tms }))))} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v >= 1 ? Math.round(v).toString() : v.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  formatter={(value: number) => [`${fmtValue(value, unit)} ${unit}`, metric.name]}
                  labelFormatter={(v) => fullTimestamp(Number(v))}
                />
                <Area type="monotone" dataKey="value" stroke={chartColors.primary} strokeWidth={1.5} fill="url(#m-detail)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Details panel */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Details</div>
        <dl className="text-xs font-mono space-y-2">
          <div className="flex">
            <dt className="text-muted-foreground w-32">Name</dt>
            <dd>{metric.name}</dd>
          </div>
          <div className="flex">
            <dt className="text-muted-foreground w-32">Type</dt>
            <dd>{metric.type ?? "gauge"}</dd>
          </div>
          <div className="flex">
            <dt className="text-muted-foreground w-32">Unit</dt>
            <dd>{unit || "—"}</dd>
          </div>
          <div className="flex">
            <dt className="text-muted-foreground w-32">Delta</dt>
            <dd className={metric.delta >= 0 ? "text-status-warn" : "text-status-ok"}>
              {metric.delta >= 0 ? "+" : ""}{metric.delta.toFixed(1)}%
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
