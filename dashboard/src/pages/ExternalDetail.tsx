import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Globe } from "lucide-react";
import { fetchExternalHostDetail, type ExternalHostDetail } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { fmtMs, serviceColor } from "@/lib/colors";
import { fullTimestamp } from "@/lib/chartTime";
import CopyButton from "@/components/CopyButton";

function errClass(rate: number) {
  return rate > 5 ? "text-status-error" : rate > 1 ? "text-status-warn" : "text-muted-foreground";
}

export default function ExternalDetail() {
  const { host = "" } = useParams();
  const { range, setRange } = useGlobalTimeRange();
  const [data, setData] = useState<ExternalHostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchExternalHostDetail(host, rangeToMinutes(range))
      .then(setData)
      .finally(() => setLoading(false));
  }, [host, range]);

  useEffect(() => { load(); }, [load]);
  const refresh = useAutoRefresh(load);

  const ov = data?.overview;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/external" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to external APIs
        </Link>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded bg-accent border border-border flex items-center justify-center">
          <Globe className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono">{host}</h1>
            <CopyButton text={host} label="host" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Outbound HTTP dependency · {rangeToLabel(range)}</p>
        </div>
      </div>

      {loading && !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !ov || ov.call_count === 0 ? (
        <div className="panel px-5 py-10 text-center text-sm text-muted-foreground">No calls to this host in this window.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              ["Calls", ov.call_count.toLocaleString()],
              ["Error rate", `${ov.error_rate.toFixed(2)}%`],
              ["p50", fmtMs(ov.p50_ms)],
              ["p95", fmtMs(ov.p95_ms)],
              ["p99", fmtMs(ov.p99_ms)],
              ["Avg", fmtMs(ov.avg_ms)],
            ].map(([k, v]) => (
              <div key={k} className="panel p-4">
                <div className="data-label">{k}</div>
                <div className={`text-lg font-mono mt-1 ${k === "Error rate" ? errClass(ov.error_rate) : ""}`}>{v}</div>
              </div>
            ))}
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            First seen {fullTimestamp(ov.first_seen)} · last seen {fullTimestamp(ov.last_seen)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Callers */}
            <div className="panel">
              <div className="px-5 py-3 border-b border-border"><div className="data-label">Called by</div></div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Service</th>
                    <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Calls</th>
                    <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">p95</th>
                    <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Error rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.callers.map((c) => (
                    <tr key={c.service} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-5 py-2">
                        <Link to={`/app/services/${encodeURIComponent(c.service)}`} className="inline-flex items-center gap-1.5 font-mono hover:underline">
                          <span className="w-2 h-2 rounded-full" style={{ background: serviceColor(c.service) }} />
                          {c.service}
                        </Link>
                      </td>
                      <td className="px-5 py-2 font-mono text-right">{c.call_count.toLocaleString()}</td>
                      <td className="px-5 py-2 font-mono text-right text-muted-foreground">{fmtMs(c.p95_ms)}</td>
                      <td className={`px-5 py-2 font-mono text-right ${errClass(c.error_rate)}`}>{c.error_rate.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent traces */}
            <div className="panel">
              <div className="px-5 py-3 border-b border-border"><div className="data-label">Recent calls</div></div>
              <div className="divide-y divide-border text-xs">
                {data!.recent.length === 0 ? (
                  <div className="px-5 py-6 text-muted-foreground">No recent calls.</div>
                ) : (
                  data!.recent.map((t, i) => (
                    <Link key={`${t.trace_id}-${i}`} to={`/app/traces/${t.trace_id}`} className="grid grid-cols-12 px-5 py-2 hover:bg-secondary/40 items-center">
                      <div className="col-span-4 font-mono text-muted-foreground truncate">{new Date(t.timestamp).toLocaleTimeString("en-US", { hour12: false })}</div>
                      <div className="col-span-5 font-mono truncate">{t.service}</div>
                      <div className="col-span-2 font-mono text-right">{t.duration_ms}ms</div>
                      <div className="col-span-1 text-right">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${t.status === "error" ? "bg-status-error" : "bg-status-ok"}`} />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
