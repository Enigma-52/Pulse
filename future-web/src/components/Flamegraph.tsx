import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Span } from "@/lib/mockData";

type Props = { spans: Span[]; total: number };

// Color per service — muted, distinct
const serviceColors: Record<string, string> = {
  "api-gateway": "hsl(0 0% 70%)",
  "auth-service": "hsl(210 30% 60%)",
  "users-service": "hsl(190 25% 58%)",
  "orders-service": "hsl(38 50% 60%)",
  "payments-service": "hsl(20 50% 62%)",
  "inventory-service": "hsl(142 25% 55%)",
  "notifications": "hsl(280 20% 65%)",
  "postgres": "hsl(220 25% 60%)",
  "redis": "hsl(0 40% 60%)",
  "kafka": "hsl(260 20% 62%)",
};

const colorFor = (s: string) => serviceColors[s] ?? "hsl(0 0% 60%)";

export default function Flamegraph({ spans, total }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>(spans[0]?.id ?? "");
  const [expanded, setExpanded] = useState(false);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Span[]>();
    for (const s of spans) {
      const arr = map.get(s.parentId) ?? [];
      arr.push(s);
      map.set(s.parentId, arr);
    }
    return map;
  }, [spans]);

  const isHidden = (span: Span): boolean => {
    let cur = span.parentId;
    while (cur) {
      if (collapsed.has(cur)) return true;
      cur = spans.find(s => s.id === cur)?.parentId ?? null;
    }
    return false;
  };

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const visible = spans.filter(s => !isHidden(s));
  const sel = spans.find(s => s.id === selected);

  return (
    <div className="panel">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="data-label">Flamegraph</div>
          <span className="text-xs font-mono text-muted-foreground">{spans.length} spans · {total}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(new Set())}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded"
          >
            expand all
          </button>
          <button
            onClick={() => setCollapsed(new Set(spans.filter(s => childrenOf.get(s.id)?.length).map(s => s.id)))}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded"
          >
            collapse all
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground border border-border p-1 rounded"
            aria-label="toggle size"
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Time ruler */}
      <div className="px-5 py-2 border-b border-border flex text-[10px] font-mono text-muted-foreground">
        <div className="w-[44%]" />
        <div className="flex-1 flex justify-between">
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <span key={p}>{Math.round(total * p)}ms</span>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-12 ${expanded ? "min-h-[640px]" : ""}`}>
        {/* Span tree + bars */}
        <div className="col-span-8 border-r border-border divide-y divide-border">
          {visible.map(s => {
            const hasChildren = (childrenOf.get(s.id)?.length ?? 0) > 0;
            const isCollapsed = collapsed.has(s.id);
            const isSelected = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`grid grid-cols-12 items-center w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/40 ${
                  isSelected ? "bg-secondary/60" : ""
                }`}
              >
                {/* tree label */}
                <div className="col-span-5 flex items-center gap-1 min-w-0" style={{ paddingLeft: s.depth * 14 }}>
                  {hasChildren ? (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); toggle(s.id); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                  ) : (
                    <span className="w-3" />
                  )}
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: s.status === "error" ? "hsl(var(--status-error))" : colorFor(s.service) }}
                  />
                  <span className="font-mono truncate">{s.name}</span>
                </div>
                {/* bar */}
                <div className="col-span-7 flex items-center gap-2">
                  <div className="relative h-4 flex-1 bg-secondary/40 rounded-sm">
                    <div
                      className="absolute h-full rounded-sm"
                      style={{
                        left: `${(s.start / total) * 100}%`,
                        width: `${Math.max(0.4, (s.duration / total) * 100)}%`,
                        background: s.status === "error" ? "hsl(var(--status-error) / 0.85)" : colorFor(s.service),
                        opacity: isSelected ? 1 : 0.85,
                      }}
                    />
                    {s.events?.map((ev, i) => (
                      <span
                        key={i}
                        title={ev.name}
                        className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-foreground/70"
                        style={{ left: `${((s.start + ev.time - s.start) / total) * 100}%` }}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground w-14 text-right shrink-0">
                    {s.duration < 1 ? s.duration.toFixed(1) : s.duration}ms
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Span detail panel */}
        <aside className="col-span-4 p-4 text-xs">
          {sel ? (
            <>
              <div className="data-label mb-1">Span</div>
              <div className="font-mono text-sm break-all">{sel.name}</div>
              <div className="mt-1 text-muted-foreground font-mono text-[11px]">id: {sel.id}</div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {[
                  ["service", sel.service],
                  ["kind", sel.kind],
                  ["duration", `${sel.duration}ms`],
                  ["start", `+${sel.start}ms`],
                ].map(([k, v]) => (
                  <div key={k as string} className="bg-secondary/40 border border-border rounded p-2">
                    <div className="data-label">{k}</div>
                    <div className="font-mono mt-0.5 truncate">{v as string}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="data-label mb-2">Attributes</div>
                <dl className="font-mono space-y-1 max-h-48 overflow-auto pr-1">
                  {Object.entries(sel.attributes).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-5 gap-2">
                      <dt className="col-span-2 text-muted-foreground truncate">{k}</dt>
                      <dd className="col-span-3 break-all">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {sel.events && sel.events.length > 0 && (
                <div className="mt-4">
                  <div className="data-label mb-2">Events</div>
                  <ul className="font-mono space-y-1">
                    {sel.events.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground">+{e.time}ms</span>
                        <span>{e.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/app/services/${sel.service.replace("-service", "").replace("api-", "")}`}
                  className="text-[11px] font-mono border border-border px-2 py-1 rounded hover:border-ring"
                >
                  view service →
                </Link>
                <Link
                  to="/app/logs"
                  className="text-[11px] font-mono border border-border px-2 py-1 rounded hover:border-ring"
                >
                  view logs →
                </Link>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">Select a span</div>
          )}
        </aside>
      </div>
    </div>
  );
}

export { colorFor as spanColorFor };
