import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchServicesList, type ServiceSummary } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { serviceColor, status as statusColors } from "@/lib/colors";

export default function Services() {
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("15m");

  const load = useCallback(() => {
    fetchServicesList(rangeToMinutes(range))
      .then(setServices)
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useAutoRefresh(load);

  function healthStatus(errRate: number): { label: string; color: string; cls: string } {
    if (errRate > 5) return { label: "CRITICAL", color: statusColors.error, cls: "border-status-error/40 text-status-error" };
    if (errRate > 1) return { label: "DEGRADED", color: statusColors.warn, cls: "border-status-warn/40 text-status-warn" };
    return { label: "HEALTHY", color: statusColors.ok, cls: "border-status-ok/40 text-status-ok" };
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">All instrumented services · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No services found. Send telemetry data to get started.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {services.map((s) => {
            const health = healthStatus(s.error_rate);
            const svcColor = serviceColor(s.service);
            const lastSeen = s.last_seen
              ? new Date(s.last_seen).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "-";

            return (
              <Link
                key={s.service}
                to={`/app/services/${s.service}`}
                className="panel p-4 hover:border-ring/40 transition-colors relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: svcColor }} />

                {/* Service name + health badge */}
                <div className="flex items-center justify-between mb-3 pl-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm font-medium truncate">{s.service}</span>
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${health.cls}`}>
                    {health.label}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 pl-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Requests</div>
                    <div className="font-mono text-sm mt-0.5">{s.trace_count.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Error rate</div>
                    <div className={`font-mono text-sm mt-0.5 ${s.error_rate > 1 ? "text-status-error" : ""}`}>{s.error_rate.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">p99</div>
                    <div className="font-mono text-sm mt-0.5">{s.p99_duration_ms.toFixed(0)}ms</div>
                  </div>
                </div>

                {/* Secondary stats */}
                <div className="flex items-center gap-4 mt-3 pl-2 text-[10px] font-mono text-muted-foreground">
                  <span>p50 {s.p50_duration_ms.toFixed(0)}ms</span>
                  <span>·</span>
                  <span>p95 {s.p95_duration_ms.toFixed(0)}ms</span>
                  <span>·</span>
                  <span>avg {s.avg_duration_ms.toFixed(0)}ms</span>
                  <span className="ml-auto">last seen {lastSeen}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
