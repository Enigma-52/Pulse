import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, GitBranch, BarChart3, ScrollText, Network, Loader2, Info, type LucideIcon } from "lucide-react";
import type { Span, Log } from "@/lib/mockData";
import { fetchTraceDetail, type TraceDetail as TraceDetailData } from "@/lib/api";
import Flamegraph, { spanColorFor } from "@/components/Flamegraph";

type Tab = "flamegraph" | "waterfall" | "services" | "graph" | "logs" | "raw";
type TabDef = { key: Tab; label: string; icon?: LucideIcon };

const tabs: TabDef[] = [
  { key: "flamegraph", label: "Flamegraph", icon: BarChart3 },
  { key: "waterfall", label: "Waterfall", icon: GitBranch },
  { key: "services", label: "By service", icon: Network },
  { key: "graph", label: "Service graph", icon: Network },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "raw", label: "Raw" },
];

function SpanDetailPanel({ span, onClose }: { span: Span; onClose: () => void }) {
  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: span.status === "error" ? "hsl(var(--status-error))" : spanColorFor(span.service) }} />
          <span className="font-mono text-sm font-medium">{span.name}</span>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">close</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Service", span.service],
          ["Kind", span.kind],
          ["Duration", `${span.duration}ms`],
          ["Status", span.status.toUpperCase()],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="data-label">{k}</div>
            <div className="text-sm font-mono mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div>
          <div className="data-label mb-1">Span ID</div>
          <div className="text-muted-foreground">{span.id}</div>
        </div>
        {span.parentId && (
          <div>
            <div className="data-label mb-1">Parent ID</div>
            <div className="text-muted-foreground">{span.parentId}</div>
          </div>
        )}
      </div>

      {Object.keys(span.attributes).length > 0 && (
        <div>
          <div className="data-label mb-2">Attributes</div>
          <dl className="text-xs font-mono space-y-1">
            {Object.entries(span.attributes).map(([k, v]) => (
              <div key={k} className="flex">
                <dt className="text-muted-foreground w-48 shrink-0 truncate">{k}</dt>
                <dd className="truncate">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {span.events && span.events.length > 0 && (
        <div>
          <div className="data-label mb-2">Events</div>
          <div className="space-y-1 text-xs font-mono">
            {span.events.map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-muted-foreground w-16">{e.time}ms</span>
                <span>{e.name}</span>
                {e.attrs && Object.entries(e.attrs).map(([k, v]) => (
                  <span key={k} className="text-muted-foreground">{k}={String(v)}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TraceDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState<Tab>("flamegraph");
  const [loading, setLoading] = useState(true);
  const [traceData, setTraceData] = useState<TraceDetailData | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchTraceDetail(id)
      .then(setTraceData)
      .catch(() => setTraceData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const spans: Span[] = traceData?.spans ?? [];
  const linkedLogs: Log[] = traceData?.logs ?? [];
  const total = traceData?.duration ?? 0;

  // Per-service aggregation
  const serviceStats = useMemo(() => {
    const map = new Map<string, { service: string; spans: number; total: number; self: number; errors: number }>();
    for (const s of spans) {
      const cur = map.get(s.service) ?? { service: s.service, spans: 0, total: 0, self: 0, errors: 0 };
      cur.spans += 1;
      cur.total += s.duration;
      const children = spans.filter((c) => c.parentId === s.id);
      const childTotal = children.reduce((a, c) => a + c.duration, 0);
      cur.self += Math.max(0, s.duration - childTotal);
      if (s.status === "error") cur.errors += 1;
      map.set(s.service, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.self - a.self);
  }, [spans]);

  // Build trace-scoped service graph
  const traceEdges = useMemo(() => {
    const set = new Set<string>();
    const list: { from: string; to: string; calls: number }[] = [];
    for (const s of spans) {
      if (!s.parentId) continue;
      const parent = spans.find((p) => p.id === s.parentId);
      if (!parent || parent.service === s.service) continue;
      const key = `${parent.service}->${s.service}`;
      if (set.has(key)) {
        const e = list.find((x) => x.from === parent.service && x.to === s.service)!;
        e.calls += 1;
      } else {
        set.add(key);
        list.push({ from: parent.service, to: s.service, calls: 1 });
      }
    }
    return list;
  }, [spans]);

  // Layout services horizontally by depth-of-first-occurrence
  const traceServiceNodes = useMemo(() => {
    const depth = new Map<string, number>();
    for (const s of spans) {
      const d = depth.get(s.service);
      if (d === undefined || s.depth < d) depth.set(s.service, s.depth);
    }
    const cols = new Map<number, string[]>();
    depth.forEach((d, svc) => {
      const arr = cols.get(d) ?? [];
      arr.push(svc);
      cols.set(d, arr);
    });
    const positions: Record<string, { x: number; y: number }> = {};
    cols.forEach((svcs, d) => {
      svcs.forEach((svc, i) => {
        positions[svc] = {
          x: 80 + d * 200,
          y: 60 + i * 90 + (svcs.length === 1 ? 120 : 0),
        };
      });
    });
    return positions;
  }, [spans]);

  // Compute critical path (longest chain of spans)
  const criticalPath = useMemo(() => {
    if (spans.length === 0) return 0;
    // Find the span with the latest end time relative to the trace start
    let maxEnd = 0;
    for (const s of spans) {
      const end = s.start + s.duration;
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }, [spans]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading trace...</span>
      </div>
    );
  }

  if (!traceData) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/app/traces" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to traces
        </Link>
        <div className="panel p-8 text-center">
          <Info className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-medium">Trace not found</h2>
          <p className="text-sm text-muted-foreground mt-1">The trace <span className="font-mono">{id}</span> was not found or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link to="/app/traces" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> Back to traces
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            traceData.status === "ok" ? "border-status-ok/40 text-status-ok" : "border-status-error/40 text-status-error"
          }`}>
            {traceData.status.toUpperCase()}
          </span>
          <div className="data-label">Trace</div>
        </div>
        <h1 className="text-xl font-mono mt-1">{traceData.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-mono text-muted-foreground">
          <span>id: {traceData.id}</span>
          <span>·</span>
          <span>{traceData.timestamp}</span>
          <span>·</span>
          <span>{spans.length} spans</span>
          <span>·</span>
          <span>{serviceStats.length} services</span>
          <span>·</span>
          <span>{total}ms total</span>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Duration", `${total}ms`],
          ["Spans", String(spans.length)],
          ["Services", String(serviceStats.length)],
          ["Errors", String(spans.filter((s) => s.status === "error").length)],
          ["Critical path", `${criticalPath}ms`],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4">
            <div className="data-label">{k}</div>
            <div className="text-lg font-mono mt-1">{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-1 text-xs font-medium">
        {tabs.map(({ key, label, icon: Icon }) => {
          const count = key === "logs" ? linkedLogs.length : undefined;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 -mb-px border-b flex items-center gap-1.5 ${
                tab === key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {Icon ? <Icon className="w-3.5 h-3.5" strokeWidth={1.75} /> : null}
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground ml-0.5">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Span detail drawer */}
      {selectedSpan && <SpanDetailPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} />}

      {/* Tab content */}
      {tab === "flamegraph" && <Flamegraph spans={spans} total={total} />}

      {tab === "waterfall" && (
        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="data-label">Waterfall</div>
            <div className="text-xs font-mono text-muted-foreground">0ms — {total}ms</div>
          </div>
          <div className="px-5 py-2 border-b border-border flex text-[10px] font-mono text-muted-foreground">
            <div className="w-[40%]" />
            <div className="flex-1 flex justify-between">
              {[0, 0.25, 0.5, 0.75, 1].map((p) => <span key={p}>{Math.round(total * p)}ms</span>)}
            </div>
          </div>
          <div className="divide-y divide-border">
            {spans.map((s) => (
              <div
                key={s.id}
                className={`grid grid-cols-12 items-center px-5 py-2 hover:bg-secondary/40 text-xs cursor-pointer ${selectedSpan?.id === s.id ? "bg-secondary/60" : ""}`}
                onClick={() => setSelectedSpan(selectedSpan?.id === s.id ? null : s)}
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0" style={{ paddingLeft: s.depth * 14 }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: s.status === "error" ? "hsl(var(--status-error))" : spanColorFor(s.service) }}
                  />
                  <span className="font-mono truncate">{s.name}</span>
                </div>
                <div className="col-span-2 font-mono text-muted-foreground truncate">{s.service}</div>
                <div className="col-span-1 font-mono text-[10px] text-muted-foreground">{s.kind}</div>
                <div className="col-span-5 relative h-4 bg-secondary/40 rounded-sm">
                  <div
                    className="absolute h-full rounded-sm"
                    style={{
                      left: `${(s.start / total) * 100}%`,
                      width: `${Math.max(0.4, (s.duration / total) * 100)}%`,
                      background: s.status === "error" ? "hsl(var(--status-error) / 0.85)" : spanColorFor(s.service),
                    }}
                  />
                  {/* Event markers */}
                  {s.events?.map((e, i) => (
                    <div
                      key={i}
                      className="absolute top-0 w-0.5 h-full bg-foreground/50"
                      style={{ left: `${(e.time / total) * 100}%` }}
                      title={e.name}
                    />
                  ))}
                </div>
                <div className="col-span-1 font-mono text-right text-muted-foreground">{s.duration}ms</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "services" && (
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="panel">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="data-label">Time spent per service</div>
              <span className="text-[10px] font-mono text-muted-foreground">self time</span>
            </div>
            <div className="divide-y divide-border">
              {serviceStats.map((s) => {
                const pct = total > 0 ? (s.self / total) * 100 : 0;
                return (
                  <div
                    key={s.service}
                    className="grid grid-cols-12 items-center px-5 py-3 hover:bg-secondary/40 text-xs"
                  >
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: spanColorFor(s.service) }} />
                      <span className="font-mono truncate">{s.service}</span>
                    </div>
                    <div className="col-span-6">
                      <div className="h-2 bg-secondary/40 rounded-sm relative">
                        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: spanColorFor(s.service) }} />
                      </div>
                    </div>
                    <div className="col-span-1 font-mono text-right text-muted-foreground">{pct.toFixed(0)}%</div>
                    <div className="col-span-1 font-mono text-right">{s.self}ms</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="px-5 py-3 border-b border-border">
              <div className="data-label">Service breakdown</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Service</th>
                  <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Spans</th>
                  <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Total</th>
                  <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Self</th>
                  <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider text-right">Errors</th>
                </tr>
              </thead>
              <tbody>
                {serviceStats.map((s) => (
                  <tr key={s.service} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-2 font-mono">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: spanColorFor(s.service) }} />
                        {s.service}
                      </span>
                    </td>
                    <td className="px-5 py-2 font-mono text-right">{s.spans}</td>
                    <td className="px-5 py-2 font-mono text-right">{s.total}ms</td>
                    <td className="px-5 py-2 font-mono text-right">{s.self}ms</td>
                    <td className={`px-5 py-2 font-mono text-right ${s.errors > 0 ? "text-status-error" : "text-muted-foreground"}`}>
                      {s.errors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "graph" && (
        <div className="panel p-4">
          <div className="data-label mb-3">Trace-scoped service graph</div>
          <div className="bg-grid rounded h-[440px]">
            <svg viewBox="0 0 900 440" className="w-full h-full">
              <defs>
                <marker id="t-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="hsl(0 0% 50%)" />
                </marker>
              </defs>
              {traceEdges.map((e, i) => {
                const a = traceServiceNodes[e.from];
                const b = traceServiceNodes[e.to];
                if (!a || !b) return null;
                return (
                  <g key={i}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(0 0% 35%)" strokeWidth={1.2} markerEnd="url(#t-arrow)" />
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">
                      {e.calls} call{e.calls > 1 ? "s" : ""}
                    </text>
                  </g>
                );
              })}
              {Object.entries(traceServiceNodes).map(([svc, p]) => {
                const stats = serviceStats.find((s) => s.service === svc);
                return (
                  <g key={svc} transform={`translate(${p.x}, ${p.y})`}>
                    <rect x={-72} y={-26} width={144} height={52} rx={4} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
                    <circle cx={-58} cy={-8} r={3} fill={spanColorFor(svc)} />
                    <text x={-50} y={-4} fill="hsl(var(--foreground))" fontSize="11" fontFamily="Inter" fontWeight="500">{svc}</text>
                    <text x={-58} y={14} fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="JetBrains Mono">
                      {stats?.spans ?? 0} spans · {stats?.self ?? 0}ms
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="data-label">Logs linked to this trace</div>
            <span className="text-[10px] font-mono text-muted-foreground">{linkedLogs.length} entries</span>
          </div>
          {linkedLogs.length === 0 ? (
            <div className="px-5 py-8 text-xs text-muted-foreground text-center">No correlated logs found for this trace.</div>
          ) : (
            <div className="divide-y divide-border font-mono text-xs">
              {linkedLogs.map((l) => (
                <div key={l.id} className="grid grid-cols-12 px-5 py-2 hover:bg-secondary/40">
                  <div className="col-span-2 text-muted-foreground">{l.timestamp}</div>
                  <div className="col-span-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      l.level === "error" ? "text-status-error border-status-error/40" :
                      l.level === "warn" ? "text-status-warn border-status-warn/40" :
                      "text-status-info border-status-info/40"
                    }`}>{l.level.toUpperCase()}</span>
                  </div>
                  <div className="col-span-2 text-muted-foreground truncate">{l.service}</div>
                  <div className="col-span-7 truncate">
                    {l.message}
                    {Object.entries(l.attributes).slice(0, 2).map(([k, v]) => (
                      <span key={k} className="ml-3 text-muted-foreground">
                        <span className="text-foreground/60">{k}=</span>{String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "raw" && (
        <div className="panel p-5">
          <div className="data-label mb-3">Raw trace data</div>
          <pre className="text-[11px] font-mono text-muted-foreground bg-secondary/40 p-3 rounded overflow-auto max-h-[600px]">
{JSON.stringify({
  trace_id: traceData.id,
  name: traceData.name,
  service: traceData.service,
  duration_ms: total,
  status: traceData.status,
  span_count: spans.length,
  spans: spans.map((s) => ({
    span_id: s.id,
    parent_id: s.parentId,
    name: s.name,
    service: s.service,
    kind: s.kind,
    start_ms: s.start,
    duration_ms: s.duration,
    status: s.status,
    attributes: s.attributes,
    events: s.events,
  })),
  logs: linkedLogs.map((l) => ({
    timestamp: l.timestamp,
    level: l.level,
    service: l.service,
    message: l.message,
    attributes: l.attributes,
  })),
}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
