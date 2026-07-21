import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import { fetchDatabaseOverview, fetchDatabaseQueries, type DatabaseOverviewData, type DatabaseOperation } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import { fmtMs, chart as chartColors, status as statusColors } from "@/lib/colors";

export default function DatabaseDetail() {
  const { system } = useParams();
  const { range, setRange } = useGlobalTimeRange();
  const [overview, setOverview] = useState<DatabaseOverviewData | null>(null);
  const [queries, setQueries] = useState<DatabaseOperation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!system) return;
    const minutes = rangeToMinutes(range);
    Promise.all([
      fetchDatabaseOverview(system, minutes),
      fetchDatabaseQueries(system, minutes, 50),
    ]).then(([ov, qs]) => {
      setOverview(ov);
      setQueries(qs);
    }).finally(() => setLoading(false));
  }, [system, range]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Loading database details...</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/app/databases" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to databases
        </Link>
        <div className="text-sm text-muted-foreground">No data found for database system "{system}".</div>
      </div>
    );
  }

  const { overview: ov, throughput } = overview;

  const chartData = throughput.map((p) => ({
    timestamp: p.timestamp,
    queries: p.count,
    errors: p.errors,
    avg_ms: Math.round(p.avg_ms),
  }));

  const truncateStatement = (stmt: string, max = 120) =>
    stmt.length > max ? stmt.slice(0, max) + "..." : stmt;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/databases" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to databases
        </Link>
        <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
      </div>

      <div>
        <h1 className="text-xl font-mono">{system}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-mono text-muted-foreground">
          <span>{ov.query_count.toLocaleString()} queries</span>
          <span>·</span>
          <span>{ov.error_rate.toFixed(2)}% error rate</span>
          <span>·</span>
          <span>{rangeToLabel(range)}</span>
          {ov.database_names.length > 0 && (
            <>
              <span>·</span>
              <span>databases: {ov.database_names.join(", ")}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Queries", ov.query_count.toLocaleString()],
          ["Avg latency", fmtMs(ov.avg_duration_ms)],
          ["p50", fmtMs(ov.p50_duration_ms)],
          ["p95", fmtMs(ov.p95_duration_ms)],
          ["p99", fmtMs(ov.p99_duration_ms)],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4">
            <div className="data-label">{k}</div>
            <div className="text-lg font-mono mt-1">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel p-5">
          <div className="data-label mb-3">Query throughput & errors</div>
          <TimeSeriesChart
            data={chartData}
            series={["queries", "errors"]}
            mode="bar"
            height={208}
            colors={{ queries: chartColors.primary, errors: statusColors.error }}
          />
        </div>

        <div className="panel p-5">
          <div className="data-label mb-3">Average latency · ms</div>
          <TimeSeriesChart
            data={chartData}
            series={["avg_ms"]}
            mode="area"
            height={208}
            colors={{ avg_ms: chartColors.secondary }}
          />
        </div>
      </div>

      <div className="panel">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="data-label">Slowest queries</div>
          <span className="text-[10px] font-mono text-muted-foreground">sorted by duration</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Statement</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Database</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Duration</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Status</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Trace</th>
            </tr>
          </thead>
          <tbody>
            {queries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No queries found.</td>
              </tr>
            ) : (
              queries.map((q, i) => {
                const durationClass = q.duration_ms > 1000 ? "text-status-error" : q.duration_ms > 100 ? "text-status-warn" : "";
                return (
                  <tr key={`${q.trace_id}-${q.span_id}-${i}`} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-3 font-mono text-xs max-w-md">
                      <span className="block truncate" title={q.db_statement}>
                        {truncateStatement(q.db_statement || "(no statement)")}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      <Link to={`/app/services/${q.service}`} className="hover:text-foreground transition-colors">{q.service}</Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{q.db_name || "-"}</td>
                    <td className={`px-5 py-3 font-mono text-xs text-right ${durationClass}`}>{fmtMs(q.duration_ms)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        q.status === "error" ? "border-status-error/40 text-status-error" : "border-status-ok/40 text-status-ok"
                      }`}>{q.status === "error" ? "ERROR" : "OK"}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/app/traces/${q.trace_id}`} className="text-[10px] font-mono text-muted-foreground hover:text-foreground hover:underline">
                        {q.trace_id.slice(0, 8)}...
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
