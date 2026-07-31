import { useState, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Link, useNavigate } from "react-router-dom";
import { Globe, ChevronRight } from "lucide-react";
import { fetchExternalCalls, type ExternalCallSummary } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { fmtMs } from "@/lib/colors";

export default function External() {
  const [calls, setCalls] = useState<ExternalCallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();
  const navigate = useNavigate();

  const load = useCallback(() => {
    fetchExternalCalls({ minutes: rangeToMinutes(range) })
      .then(setCalls)
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
          <h1 className="text-xl font-medium tracking-tight">External calls</h1>
          <p className="text-sm text-muted-foreground mt-1">Outbound HTTP calls from client spans, grouped by host · {rangeToLabel(range)}</p>
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
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Host</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Calls</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Error rate</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Avg</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">p95</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : calls.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No outbound calls detected. Client spans with server.address or http.url attributes appear here.
                </td>
              </tr>
            ) : (
              calls.map((c) => {
                const errClass = c.error_rate > 5 ? "text-status-error" : c.error_rate > 1 ? "text-status-warn" : "text-muted-foreground";
                const lastSeen = c.last_seen ? new Date(c.last_seen).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
                return (
                  <tr
                    key={c.host}
                    onClick={() => navigate(`/app/external/${encodeURIComponent(c.host)}`)}
                    className="border-b border-border last:border-0 hover:bg-secondary/40 cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded bg-accent border border-border flex items-center justify-center">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                        </span>
                        <Link to={`/app/external/${encodeURIComponent(c.host)}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs hover:underline">{c.host}</Link>
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-right">{c.call_count.toLocaleString()}</td>
                    <td className={`px-5 py-3 font-mono text-xs text-right ${errClass}`}>{c.error_rate.toFixed(2)}%</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{fmtMs(c.avg_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right">{fmtMs(c.p95_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">
                      <span className="inline-flex items-center gap-2">{lastSeen}<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" /></span>
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
