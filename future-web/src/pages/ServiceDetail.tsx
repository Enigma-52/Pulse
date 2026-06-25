import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { services, edges, genSeries } from "@/lib/mockData";
import type { Trace, Log } from "@/lib/mockData";
import { spanColorFor } from "@/components/Flamegraph";
import TimeRangeSelector, { type TimeRange, rangeToStartEnd, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { fetchTraces, fetchLogs } from "@/lib/api";

export default function ServiceDetail() {
  const { id } = useParams();
  const [range, setRange] = useState<TimeRange>("15m");
  const [recentTraces, setRecentTraces] = useState<Trace[]>([]);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);

  const svc = useMemo(() => {
    return services.find(s => s.id === id)
      ?? services.find(s => s.name.includes(id ?? ""))
      ?? services[0];
  }, [id]);

  const loadData = useCallback((r: TimeRange) => {
    const { start, end } = rangeToStartEnd(r);
    fetchTraces({ service: svc.name, start, end, limit: 10 }).then(setRecentTraces);
    fetchLogs({ service: svc.name, start, end, limit: 10 }).then(setRecentLogs);
  }, [svc.name]);

  useEffect(() => {
    loadData(range);
  }, [range, loadData]);

  const upstream = edges.filter(e => e.to === svc.id);
  const downstream = edges.filter(e => e.from === svc.id);

  const rpsSeries = genSeries(60, svc.rps, svc.rps * 0.25, 4);
  const latencySeries = genSeries(60, svc.p99, svc.p99 * 0.4, 9).map(d => ({
    t: d.t,
    p50: Math.max(0, d.value * 0.15),
    p95: Math.max(0, d.value * 0.6),
    p99: d.value,
  }));
  const errorSeries = genSeries(60, svc.errorRate * 5, svc.errorRate * 6, 11).map(d => ({ t: d.t, value: Math.max(0, d.value) }));

  const status = svc.errorRate > 1 ? "DEGRADED" : svc.errorRate > 0.5 ? "WARN" : "HEALTHY";
  const statusColor = svc.errorRate > 1 ? "border-status-error/40 text-status-error" :
                      svc.errorRate > 0.5 ? "border-status-warn/40 text-status-warn" :
                      "border-status-ok/40 text-status-ok";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/traces" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to traces
        </Link>
        <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: spanColorFor(svc.name) }} />
            <h1 className="text-xl font-mono">{svc.name}</h1>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${statusColor}`}>{status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-mono text-muted-foreground">
            <span>{svc.language}</span><span>·</span>
            <span>v{svc.version}</span><span>·</span>
            <span>{svc.instances} instances</span><span>·</span>
            <span>owner: {svc.owner}</span><span>·</span>
            <span>{rangeToLabel(range)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ["RPS", `${svc.rps}`],
          ["p50", `${svc.p50}ms`],
          ["p95", `${svc.p95}ms`],
          ["p99", `${svc.p99}ms`],
          ["Error rate", `${svc.errorRate}%`],
          ["Apdex", `${svc.apdex}`],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4">
            <div className="data-label">{k}</div>
            <div className="text-lg font-mono mt-1">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="panel p-5">
          <div className="data-label mb-3">Request rate · req/s</div>
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={rpsSeries}>
                <defs>
                  <linearGradient id="r" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={1.25} fill="url(#r)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="data-label">Latency · ms</div>
            <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
              <span><span className="inline-block w-2 h-px bg-chart-3 mr-1 align-middle" />p50</span>
              <span><span className="inline-block w-2 h-px bg-chart-2 mr-1 align-middle" />p95</span>
              <span><span className="inline-block w-2 h-px bg-chart-1 mr-1 align-middle" />p99</span>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={latencySeries}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                <Area type="monotone" dataKey="p50" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.08)" strokeWidth={1.25} />
                <Area type="monotone" dataKey="p95" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.08)" strokeWidth={1.25} />
                <Area type="monotone" dataKey="p99" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / 0.12)" strokeWidth={1.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <div className="data-label mb-3">Errors · err/s</div>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={errorSeries}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                <Bar dataKey="value" fill="hsl(var(--status-error) / 0.7)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="px-5 py-3 border-b border-border">
            <div className="data-label">Upstream callers ({upstream.length})</div>
          </div>
          {upstream.length === 0 ? (
            <div className="px-5 py-6 text-xs text-muted-foreground">No upstream callers in this window.</div>
          ) : (
            <div className="divide-y divide-border">
              {upstream.map(e => {
                const s = services.find(x => x.id === e.from);
                return (
                  <Link key={e.from} to={`/app/services/${e.from}`} className="grid grid-cols-12 px-5 py-3 hover:bg-secondary/40 text-xs items-center">
                    <div className="col-span-5 flex items-center gap-2 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: spanColorFor(s?.name ?? "") }} />
                      {s?.name}
                    </div>
                    <div className="col-span-3 font-mono text-muted-foreground">{e.calls} req/s</div>
                    <div className="col-span-2 font-mono text-muted-foreground">{e.latency}ms</div>
                    <div className={`col-span-2 font-mono text-right ${e.errorRate > 1 ? "text-status-error" : "text-muted-foreground"}`}>
                      {e.errorRate}% err
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="px-5 py-3 border-b border-border">
            <div className="data-label">Downstream dependencies ({downstream.length})</div>
          </div>
          {downstream.length === 0 ? (
            <div className="px-5 py-6 text-xs text-muted-foreground">No downstream calls.</div>
          ) : (
            <div className="divide-y divide-border">
              {downstream.map(e => {
                const s = services.find(x => x.id === e.to);
                return (
                  <Link key={e.to} to={`/app/services/${e.to}`} className="grid grid-cols-12 px-5 py-3 hover:bg-secondary/40 text-xs items-center">
                    <div className="col-span-5 flex items-center gap-2 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: spanColorFor(s?.name ?? "") }} />
                      {s?.name}
                    </div>
                    <div className="col-span-3 font-mono text-muted-foreground">{e.calls} req/s</div>
                    <div className="col-span-2 font-mono text-muted-foreground">{e.latency}ms</div>
                    <div className={`col-span-2 font-mono text-right ${e.errorRate > 1 ? "text-status-error" : "text-muted-foreground"}`}>
                      {e.errorRate}% err
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
                <Link key={l.id} to={`/app/logs/${l.id}`} className="grid grid-cols-12 px-5 py-2 hover:bg-secondary/40">
                  <div className="col-span-2 text-muted-foreground">{l.timestamp}</div>
                  <div className="col-span-1">
                    <span className={`text-[10px] ${
                      l.level === "error" ? "text-status-error" :
                      l.level === "warn" ? "text-status-warn" : "text-status-info"
                    }`}>{l.level.toUpperCase()}</span>
                  </div>
                  <div className="col-span-9 truncate">{l.message}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="panel p-5">
          <div className="data-label mb-3">Top operations</div>
          <div className="space-y-2 text-xs">
            {[
              ["POST /api/orders", 480, 312],
              ["GET /api/orders/:id", 198, 64],
              ["GET /healthz", 1200, 4],
              ["POST /api/orders/:id/cancel", 22, 88],
              ["GET /api/orders", 142, 124],
            ].map(([op, rps, p99]) => (
              <div key={op as string} className="flex items-center gap-3">
                <span className="flex-1 font-mono truncate">{op}</span>
                <span className="font-mono text-muted-foreground w-16 text-right">{rps}/s</span>
                <span className="font-mono w-16 text-right">{p99}ms</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="data-label mb-3">Instances</div>
          <div className="space-y-2 text-xs font-mono">
            {Array.from({ length: svc.instances ?? 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-status-ok" />
                <span className="flex-1 truncate">{svc.id}-{String(i + 1).padStart(2, "0")}</span>
                <span className="text-muted-foreground">{Math.round(svc.rps / (svc.instances ?? 3))}/s</span>
                <span className="text-muted-foreground">{Math.round(40 + Math.random() * 30)}% cpu</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="data-label mb-3">Resource attributes</div>
          <dl className="text-xs font-mono space-y-1.5">
            {[
              ["service.name", svc.name],
              ["service.version", svc.version ?? "\u2014"],
              ["telemetry.sdk", "opentelemetry"],
              ["deployment.env", "production"],
              ["cloud.region", "us-east-1"],
              ["k8s.namespace", svc.owner],
              ["host.arch", "amd64"],
            ].map(([k, v]) => (
              <div key={k} className="flex">
                <dt className="text-muted-foreground w-36 truncate">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
