import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Trace, Log } from "@/lib/mockData";
import TimeRangeSelector, { type TimeRange, rangeToStartEnd, rangeToLabel, rangeToMinutes, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { fetchTraces, fetchLogs, fetchServicesList, type ServiceSummary } from "@/lib/api";

export default function ServiceDetail() {
  const { id } = useParams();
  const [range, setRange] = useState<TimeRange>("15m");
  const [recentTraces, setRecentTraces] = useState<Trace[]>([]);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);
  const [svc, setSvc] = useState<ServiceSummary | null>(null);

  const loadData = useCallback((r: TimeRange) => {
    if (!id) return;
    const { start, end } = rangeToStartEnd(r);
    const minutes = rangeToMinutes(r);
    fetchTraces({ service: id, start, end, limit: 10 }).then(setRecentTraces);
    fetchLogs({ service: id, start, end, limit: 10 }).then(setRecentLogs);
    fetchServicesList(minutes).then((services) => {
      const found = services.find(s => s.service === id);
      if (found) setSvc(found);
    });
  }, [id]);

  useEffect(() => {
    loadData(range);
  }, [range, loadData]);

  const errRate = svc?.error_rate ?? 0;
  const status = errRate > 5 ? "DEGRADED" : errRate > 1 ? "WARN" : "HEALTHY";
  const statusColor = errRate > 5 ? "border-status-error/40 text-status-error" :
                      errRate > 1 ? "border-status-warn/40 text-status-warn" :
                      "border-status-ok/40 text-status-ok";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/services" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to services
        </Link>
        <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-mono">{id}</h1>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${statusColor}`}>{status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-mono text-muted-foreground">
            <span>{rangeToLabel(range)}</span>
            {svc && (
              <>
                <span>·</span>
                <span>{svc.trace_count.toLocaleString()} requests</span>
                <span>·</span>
                <span>{svc.error_rate.toFixed(2)}% errors</span>
              </>
            )}
          </div>
        </div>
      </div>

      {svc && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ["Requests", svc.trace_count.toLocaleString()],
            ["p50", `${svc.p50_duration_ms.toFixed(0)}ms`],
            ["p95", `${svc.p95_duration_ms.toFixed(0)}ms`],
            ["p99", `${svc.p99_duration_ms.toFixed(0)}ms`],
            ["Avg", `${svc.avg_duration_ms.toFixed(0)}ms`],
            ["Error rate", `${svc.error_rate.toFixed(2)}%`],
          ].map(([k, v]) => (
            <div key={k} className="panel p-4">
              <div className="data-label">{k}</div>
              <div className="text-lg font-mono mt-1">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="data-label">Recent traces</div>
            <Link to="/app/traces" className="text-[10px] font-mono text-muted-foreground hover:text-foreground">view all →</Link>
          </div>
          {recentTraces.length === 0 ? (
            <div className="px-5 py-6 text-xs text-muted-foreground">No traces in this window.</div>
          ) : (
            <div className="divide-y divide-border text-xs">
              {recentTraces.map(t => (
                <Link key={t.id} to={`/app/traces/${t.id}`} className="grid grid-cols-12 px-5 py-2 hover:bg-secondary/40 items-center">
                  <div className="col-span-3 font-mono text-muted-foreground">{t.timestamp}</div>
                  <div className="col-span-5 font-mono truncate">{t.name}</div>
                  <div className="col-span-2 font-mono text-right">{t.duration}ms</div>
                  <div className="col-span-2 text-right">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      t.status === "ok" ? "border-status-ok/40 text-status-ok" : "border-status-error/40 text-status-error"
                    }`}>{t.status.toUpperCase()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="data-label">Recent logs</div>
            <Link to="/app/logs" className="text-[10px] font-mono text-muted-foreground hover:text-foreground">view all →</Link>
          </div>
          {recentLogs.length === 0 ? (
            <div className="px-5 py-6 text-xs text-muted-foreground">No logs in this window.</div>
          ) : (
            <div className="divide-y divide-border text-xs font-mono">
              {recentLogs.map(l => (
                <div key={l.id} className="grid grid-cols-12 px-5 py-2 hover:bg-secondary/40">
                  <div className="col-span-2 text-muted-foreground">{l.timestamp}</div>
                  <div className="col-span-1">
                    <span className={`text-[10px] ${
                      l.level === "error" ? "text-status-error" :
                      l.level === "warn" ? "text-status-warn" : "text-status-info"
                    }`}>{l.level.toUpperCase()}</span>
                  </div>
                  <div className="col-span-9 truncate">{l.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
