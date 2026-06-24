import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { fetchServicesList, type ServiceSummary } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

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

  return (
    <div className="p-6 space-y-6">
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

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Requests</th>
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
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading services...</td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">No services found. Send some telemetry data first.</td>
              </tr>
            ) : (
              services.map((s) => {
                const errClass = s.error_rate > 5 ? "text-status-error" : s.error_rate > 1 ? "text-status-warn" : "text-muted-foreground";
                const lastSeen = s.last_seen ? new Date(s.last_seen).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
                return (
                  <tr key={s.service} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-3">
                      <Link to={`/app/services/${s.service}`} className="font-mono text-xs hover:underline">
                        {s.service}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-right">{s.trace_count.toLocaleString()}</td>
                    <td className={`px-5 py-3 font-mono text-xs text-right ${errClass}`}>{s.error_rate.toFixed(2)}%</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{s.p50_duration_ms.toFixed(0)}ms</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{s.p95_duration_ms.toFixed(0)}ms</td>
                    <td className="px-5 py-3 font-mono text-xs text-right">{s.p99_duration_ms.toFixed(0)}ms</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{s.avg_duration_ms.toFixed(0)}ms</td>
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
