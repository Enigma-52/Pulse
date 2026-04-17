import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { edges, nodePositions, services } from "@/lib/mockData";

export default function ServiceGraph() {
  const [hover, setHover] = useState<string | null>(null);
  const navigate = useNavigate();

  const isConnected = (id: string) => {
    if (!hover) return true;
    if (id === hover) return true;
    return edges.some(e => (e.from === hover && e.to === id) || (e.to === hover && e.from === id));
  };

  const isEdgeActive = (from: string, to: string) => !hover || from === hover || to === hover;

  return (
    <div className="relative w-full h-[560px] bg-grid rounded-md border border-border overflow-hidden">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 panel px-3 py-2 bg-card/80 backdrop-blur text-xs flex items-center gap-4">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-ok" /> healthy</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-warn" /> degraded</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-status-error" /> error</div>
      </div>
      <div className="absolute top-3 right-3 z-10 panel px-3 py-2 bg-card/80 backdrop-blur text-xs font-mono text-muted-foreground">
        {services.length} services · {edges.length} edges
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
        {edges.map((e, i) => {
          const a = nodePositions[e.from];
          const b = nodePositions[e.to];
          if (!a || !b) return null;
          const active = isEdgeActive(e.from, e.to);
          const errored = e.errorRate > 1;
          return (
            <g key={i} opacity={active ? 1 : 0.15}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={errored ? "hsl(var(--status-error) / 0.6)" : active && hover ? "hsl(var(--foreground) / 0.6)" : "hsl(0 0% 22%)"}
                strokeWidth={Math.max(0.5, Math.min(2.5, e.calls / 400))}
                markerEnd={active && hover ? "url(#arrow-active)" : "url(#arrow)"}
              />
              {hover && (e.from === hover || e.to === hover) && (
                <text
                  x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                  fill="hsl(var(--muted-foreground))"
                  fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle"
                >
                  {e.calls}/s · {e.latency}ms
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {services.map(s => {
          const p = nodePositions[s.id];
          if (!p) return null;
          const status = s.errorRate > 1 ? "error" : s.errorRate > 0.5 ? "warn" : "ok";
          const statusColor =
            status === "error" ? "hsl(var(--status-error))" :
            status === "warn" ? "hsl(var(--status-warn))" : "hsl(var(--status-ok))";
          const dim = !isConnected(s.id);
          return (
            <g
              key={s.id}
              transform={`translate(${p.x}, ${p.y})`}
              opacity={dim ? 0.25 : 1}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => navigate(`/app/services/${s.id}`)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={-62} y={-22} width={124} height={44} rx={4}
                fill="hsl(var(--card))"
                stroke={hover === s.id ? "hsl(var(--foreground))" : "hsl(var(--border))"}
                strokeWidth={hover === s.id ? 1.5 : 1}
              />
              <circle cx={-50} cy={0} r={3} fill={statusColor} />
              <text x={-40} y={-4} fill="hsl(var(--foreground))" fontSize="11" fontFamily="Inter" fontWeight="500">
                {s.name}
              </text>
              <text x={-40} y={10} fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="JetBrains Mono">
                {s.rps}/s · p99 {s.p99}ms
              </text>
            </g>
          );
        })}
      </svg>

      {/* Detail panel */}
      {hover && (() => {
        const s = services.find(x => x.id === hover)!;
        return (
          <div className="absolute bottom-3 left-3 panel p-4 w-72 bg-card/95 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{s.language}</div>
              </div>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                s.errorRate > 1 ? "border-status-error/40 text-status-error" : "border-status-ok/40 text-status-ok"
              }`}>
                {s.errorRate > 1 ? "DEGRADED" : "HEALTHY"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div>
                <div className="data-label">RPS</div>
                <div className="font-mono mt-0.5">{s.rps}</div>
              </div>
              <div>
                <div className="data-label">Errors</div>
                <div className="font-mono mt-0.5">{s.errorRate}%</div>
              </div>
              <div>
                <div className="data-label">p99</div>
                <div className="font-mono mt-0.5">{s.p99}ms</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
