import { useState, useEffect, useCallback, useMemo } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import TraceAnalytics from "@/components/TraceAnalytics";
import EmptyState from "@/components/EmptyState";
import { GitBranch } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import TimeRangeSelector, { type TimeRange, rangeToStartEnd, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import { useEnvironment } from "@/lib/environment";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import type { Trace } from "@/lib/mockData";
import { fetchTracesPage } from "@/lib/api";
import { chart as chartColors, status as statusColors } from "@/lib/colors";

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

  while (buckets.length > 0 && buckets[buckets.length - 1].count === 0) {
    buckets.pop();
  }
  return buckets;
}

export default function Traces() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "analytics" ? "analytics" : "list";
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();
  const { environment } = useEnvironment();
  const [serviceFilter, setServiceFilter] = useState(searchParams.get("service") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [textFilter, setTextFilter] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<"time" | "duration">("time");
  const PAGE_SIZE = 50;

  // Keep filters shareable via the URL.
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of [["service", serviceFilter], ["status", statusFilter], ["q", textFilter]] as const) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  }, [serviceFilter, statusFilter, textFilter, setSearchParams]);

  const setView = (v: "list" | "analytics") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === "analytics") next.set("view", "analytics");
      else next.delete("view");
      return next;
    });
  };

  const load = useCallback((r: TimeRange, service?: string, status?: string, text?: string, pageNum = 0) => {
    setLoading(true);
    const { start, end } = rangeToStartEnd(r);
    fetchTracesPage({
      start,
      end,
      service: service || undefined,
      status: status || undefined,
      environment: environment || undefined,
      q: text || undefined,
      limit: PAGE_SIZE,
      offset: pageNum * PAGE_SIZE,
    })
      .then(({ items, total: t }) => {
        setTraces(items);
        setTotal(t);
      })
      .finally(() => setLoading(false));
  }, [environment]);

  useEffect(() => {
    setPage(0);
    load(range, serviceFilter, statusFilter, textFilter, 0);
  }, [range, serviceFilter, statusFilter, textFilter, load]);

  const refresh = useAutoRefresh(() => load(range, serviceFilter, statusFilter, textFilter, page));

  const handleFilter = () => {
    setPage(0);
    load(range, serviceFilter, statusFilter, textFilter, 0);
  };

  const goToPage = (p: number) => {
    setPage(p);
    load(range, serviceFilter, statusFilter, textFilter, p);
  };

  const sortedTraces = useMemo(() => {
    if (sortKey === "duration") return [...traces].sort((a, b) => b.duration - a.duration);
    return traces;
  }, [traces, sortKey]);

  const durationBuckets = useMemo(() => buildDurationBuckets(traces), [traces]);
  const p50 = useMemo(() => {
    if (traces.length === 0) return 0;
    const sorted = [...traces].sort((a, b) => a.duration - b.duration);
    return sorted[Math.floor(sorted.length * 0.5)]?.duration ?? 0;
  }, [traces]);

  const errorCount = traces.filter(t => t.status === "error").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Traces</h1>
          <p className="text-sm text-muted-foreground mt-1">Distributed traces · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["list", "analytics"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
              view === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "analytics" && <TraceAnalytics range={range} service={serviceFilter || undefined} />}

      {view === "list" && (<>
      {/* Filters */}
      <div className="flex gap-2">
        <input
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFilter()}
          placeholder="Search route or operation"
          className="h-8 w-56 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
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
        <button onClick={handleFilter} className="h-8 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring transition-colors">Filter</button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-4 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: chartColors.primary }} />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total traces</div>
          <div className="text-2xl font-mono font-medium mt-1">{total.toLocaleString()}</div>
        </div>
        <div className="panel p-4 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: chartColors.secondary }} />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">p50 duration (page)</div>
          <div className="text-2xl font-mono font-medium mt-1">{p50}<span className="text-xs text-muted-foreground ml-1">ms</span></div>
        </div>
        <div className="panel p-4 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: errorCount > 0 ? statusColors.error : chartColors.primary }} />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors (page)</div>
          <div className={`text-2xl font-mono font-medium mt-1 ${errorCount > 0 ? "text-status-error" : ""}`}>{errorCount}</div>
        </div>
      </div>

      {/* Duration Distribution */}
      {durationBuckets.length > 0 && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration distribution</div>
            <div className="text-[10px] font-mono text-muted-foreground">{traces.length} traces · p50 = {p50}ms</div>
          </div>
          <div className="h-28">
            <ResponsiveContainer>
              <BarChart data={durationBuckets}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                  formatter={(value: number) => [`${value} traces`, "Count"]}
                  labelFormatter={(label: string) => `${label}ms`}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {durationBuckets.map((_, i) => (
                    <Cell key={i} fill={chartColors.primary} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Trace Table */}
      <div className="panel">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trace list</div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Time</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Trace ID</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Operation</th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Service</th>
              <th
                onClick={() => setSortKey(sortKey === "duration" ? "time" : "duration")}
                className={`px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right cursor-pointer select-none hover:text-foreground ${sortKey === "duration" ? "text-foreground" : ""}`}
              >
                Duration{sortKey === "duration" ? " ↓" : ""}
              </th>
              <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : traces.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={GitBranch}
                    title="No traces in this time range"
                    hint="Point any OpenTelemetry SDK's OTLP/HTTP exporter at http://<pulse-host>:4321/v1/traces to start seeing traces here."
                  />
                </td>
              </tr>
            ) : sortedTraces.map(t => (
              <tr
                key={t.id}
                onClick={() => navigate(`/app/traces/${t.id}`)}
                className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <td className="px-5 py-2.5 font-mono text-muted-foreground">{t.timestamp}</td>
                <td className="px-5 py-2.5 font-mono">
                  <Link to={`/app/traces/${t.id}`} className="hover:text-foreground text-muted-foreground transition-colors">{t.id.slice(0, 12)}</Link>
                </td>
                <td className="px-5 py-2.5 font-mono">{t.name}</td>
                <td className="px-5 py-2.5 text-muted-foreground">
                  <Link to={`/app/services/${t.service}`} onClick={(e) => e.stopPropagation()} className="hover:text-foreground transition-colors">{t.service}</Link>
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
            ))}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
                className="h-7 px-2.5 rounded border border-border hover:border-ring disabled:opacity-40 disabled:hover:border-border"
              >
                ← Prev
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="h-7 px-2.5 rounded border border-border hover:border-ring disabled:opacity-40 disabled:hover:border-border"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
