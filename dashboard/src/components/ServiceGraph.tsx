import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ServiceDependency } from "@/lib/api";

type Node = { id: string; x: number; y: number; errorRate: number; callsIn: number };

// Assign each service to a column based on its longest distance from a root
// (a service that is never called), then space nodes evenly within each column.
function layout(deps: ServiceDependency[]): { nodes: Node[]; positions: Record<string, Node> } {
  const ids = new Set<string>();
  const outgoing = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const d of deps) {
    ids.add(d.from_service);
    ids.add(d.to_service);
    hasParent.add(d.to_service);
    (outgoing.get(d.from_service) ?? outgoing.set(d.from_service, []).get(d.from_service)!).push(d.to_service);
  }

  // Longest-path layering from roots via BFS relaxation (graphs may have cycles;
  // cap depth by node count to stay bounded).
  const depth = new Map<string, number>();
  for (const id of ids) depth.set(id, 0);
  const roots = [...ids].filter((id) => !hasParent.has(id));
  const seeds = roots.length ? roots : [...ids];
  const maxIter = ids.size;
  for (let i = 0; i < maxIter; i++) {
    let changed = false;
    for (const d of deps) {
      const nd = (depth.get(d.from_service) ?? 0) + 1;
      if (nd > (depth.get(d.to_service) ?? 0)) {
        depth.set(d.to_service, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const s of seeds) if (!depth.has(s)) depth.set(s, 0);

  // Per-node aggregates for coloring/detail.
  const callsIn = new Map<string, number>();
  const errCalls = new Map<string, number>();
  for (const d of deps) {
    callsIn.set(d.to_service, (callsIn.get(d.to_service) ?? 0) + d.calls);
    errCalls.set(d.to_service, (errCalls.get(d.to_service) ?? 0) + d.error_count);
  }

  const cols = new Map<number, string[]>();
  for (const id of ids) {
    const c = depth.get(id) ?? 0;
    (cols.get(c) ?? cols.set(c, []).get(c)!).push(id);
  }
  const colCount = Math.max(1, cols.size);
  const width = 900;
  const height = 600;
  const colGap = width / (colCount + 1);

  const positions: Record<string, Node> = {};
  const nodes: Node[] = [];
  [...cols.keys()].sort((a, b) => a - b).forEach((c, ci) => {
    const col = cols.get(c)!.sort();
    const rowGap = height / (col.length + 1);
    col.forEach((id, ri) => {
      const cin = callsIn.get(id) ?? 0;
      const n: Node = {
        id,
        x: colGap * (ci + 1),
        y: rowGap * (ri + 1),
        errorRate: cin > 0 ? ((errCalls.get(id) ?? 0) / cin) * 100 : 0,
        callsIn: cin,
      };
      positions[id] = n;
      nodes.push(n);
    });
  });
  return { nodes, positions };
}

export default function ServiceGraph({ deps }: { deps: ServiceDependency[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const navigate = useNavigate();
  const { nodes, positions } = useMemo(() => layout(deps), [deps]);

  const maxCalls = useMemo(() => Math.max(1, ...deps.map((d) => d.calls)), [deps]);

  const isConnected = (id: string) => {
    if (!hover) return true;
    if (id === hover) return true;
    return deps.some((e) => (e.from_service === hover && e.to_service === id) || (e.to_service === hover && e.from_service === id));
  };
  const isEdgeActive = (from: string, to: string) => !hover || from === hover || to === hover;

  if (deps.length === 0) {
    return (
      <div className="w-full h-[560px] flex items-center justify-center rounded-md border border-border bg-grid text-center px-6">
        <div className="max-w-sm">
          <div className="text-sm font-medium">No service dependencies yet</div>
          <div className="text-xs text-muted-foreground mt-1">
            Edges appear once traces span more than one service — a parent span in one service calling a child span in another.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[560px] bg-grid rounded-md border border-border overflow-hidden">
      <div className="absolute top-3 left-3 z-10 panel px-3 py-2 bg-card/80 backdrop-blur text-xs flex items-center gap-4">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-ok" /> healthy</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-warn" /> degraded</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-error" /> error</div>
      </div>
      <div className="absolute top-3 right-3 z-10 panel px-3 py-2 bg-card/80 backdrop-blur text-xs font-mono text-muted-foreground">
        {nodes.length} services · {deps.length} edges
      </div>

      <svg viewBox="0 0 900 600" className="w-full h-full">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="hsl(0 0% 30%)" />
          </marker>
          <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--foreground))" />
          </marker>
        </defs>

        {/* Edges */}
        {deps.map((e, i) => {
          const a = positions[e.from_service];
          const b = positions[e.to_service];
          if (!a || !b) return null;
          const active = isEdgeActive(e.from_service, e.to_service);
          const errored = e.error_rate > 1;
          return (
            <g key={i} opacity={active ? 1 : 0.12}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={errored ? "hsl(var(--status-error) / 0.6)" : active && hover ? "hsl(var(--foreground) / 0.6)" : "hsl(0 0% 22%)"}
                strokeWidth={Math.max(0.6, Math.min(3, (e.calls / maxCalls) * 3))}
                markerEnd={active && hover ? "url(#arrow-active)" : "url(#arrow)"}
              />
              {hover && (e.from_service === hover || e.to_service === hover) && (
                <text
                  x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                  fill="hsl(var(--muted-foreground))"
                  fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle"
                >
                  {e.calls} calls · p95 {Math.round(e.p95_ms)}ms
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((s) => {
          const status = s.errorRate > 1 ? "error" : s.errorRate > 0.5 ? "warn" : "ok";
          const statusColor =
            status === "error" ? "hsl(var(--status-error))" :
            status === "warn" ? "hsl(var(--status-warn))" : "hsl(var(--status-ok))";
          const dim = !isConnected(s.id);
          const label = s.id.length > 16 ? `${s.id.slice(0, 15)}…` : s.id;
          return (
            <g
              key={s.id}
              transform={`translate(${s.x}, ${s.y})`}
              opacity={dim ? 0.25 : 1}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => navigate(`/app/services/${encodeURIComponent(s.id)}`)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={-62} y={-16} width={124} height={32} rx={4}
                fill="hsl(var(--card))"
                stroke={hover === s.id ? "hsl(var(--foreground))" : "hsl(var(--border))"}
                strokeWidth={hover === s.id ? 1.5 : 1}
              />
              <circle cx={-50} cy={0} r={3} fill={statusColor} />
              <text x={-40} y={3} fill="hsl(var(--foreground))" fontSize="10" fontFamily="Inter" fontWeight="500">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Detail panel */}
      {hover && positions[hover] && (
        <div className="absolute bottom-3 left-3 panel p-4 w-72 bg-card/95 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium truncate">{hover}</div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              positions[hover].errorRate > 1 ? "border-status-error/40 text-status-error" : "border-status-ok/40 text-status-ok"
            }`}>
              {positions[hover].errorRate > 1 ? "DEGRADED" : "HEALTHY"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div>
              <div className="data-label">Calls in</div>
              <div className="font-mono mt-0.5">{positions[hover].callsIn.toLocaleString()}</div>
            </div>
            <div>
              <div className="data-label">Error rate</div>
              <div className="font-mono mt-0.5">{positions[hover].errorRate.toFixed(2)}%</div>
            </div>
          </div>
          <button
            onClick={() => navigate(`/app/services/${encodeURIComponent(hover)}`)}
            className="mt-3 w-full text-xs text-primary hover:underline text-left"
          >
            Open service →
          </button>
        </div>
      )}
    </div>
  );
}
