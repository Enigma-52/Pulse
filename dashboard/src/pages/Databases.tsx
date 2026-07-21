import { useState, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Link } from "react-router-dom";
import { fetchDatabasesList, type DatabaseSummary } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { fmtMs } from "@/lib/colors";

const DB_ICONS: Record<string, string> = {
  postgresql: "PG",
  mysql: "My",
  mongodb: "Mo",
  redis: "Re",
  clickhouse: "CH",
  sqlite: "SQ",
  mssql: "MS",
  oracle: "Or",
  cassandra: "Ca",
  elasticsearch: "ES",
};

function dbBadge(system: string) {
  return DB_ICONS[system.toLowerCase()] || system.slice(0, 2).toUpperCase();
}

export default function Databases() {
  const [databases, setDatabases] = useState<DatabaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();

  const load = useCallback(() => {
    fetchDatabasesList(rangeToMinutes(range))
      .then(setDatabases)
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useAutoRefresh(load);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Databases</h1>
          <p className="text-sm text-muted-foreground mt-1">Detected database systems from trace attributes · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">System</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Queries</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Error rate</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">p50</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">p95</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">p99</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Avg</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={8} />
            ) : databases.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No database calls detected. Instrument your app with OTel database spans (db.system attribute).
                </td>
              </tr>
            ) : (
              databases.map((d) => {
                const errClass = d.error_rate > 5 ? "text-status-error" : d.error_rate > 1 ? "text-status-warn" : "text-muted-foreground";
                const lastSeen = d.last_seen ? new Date(d.last_seen).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
                return (
                  <tr key={d.system} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-3">
                      <Link to={`/app/databases/${d.system}`} className="flex items-center gap-2.5 hover:underline">
                        <span className="w-7 h-7 rounded bg-accent border border-border flex items-center justify-center text-[10px] font-mono font-semibold">
                          {dbBadge(d.system)}
                        </span>
                        <span className="font-mono text-xs">{d.system}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-right">{d.query_count.toLocaleString()}</td>
                    <td className={`px-5 py-3 font-mono text-xs text-right ${errClass}`}>{d.error_rate.toFixed(2)}%</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{fmtMs(d.p50_duration_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{fmtMs(d.p95_duration_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right">{fmtMs(d.p99_duration_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{fmtMs(d.avg_duration_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{lastSeen}</td>
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
