import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ChevronDown, ChevronRight, Copy, Check,
  Clock, Loader2, Info, AlertTriangle, Search,
} from "lucide-react";
import type { Span, Log } from "@/lib/mockData";
import { fetchTraceDetail, type TraceDetail as TraceDetailData } from "@/lib/api";
import { spanColorFor, resetServiceColors, ERROR_COLOR, formatDuration, TimelineMinimap } from "@/components/Flamegraph";

/* ── Helpers ─────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
      {copied ? <Check className="w-3 h-3 text-status-ok" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ── Detail Tabs ─────────────────────────────────────────────── */

type DetailTab = "tags" | "events";

function SpanDetailSidebar({ span, onClose }: { span: Span; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>("tags");
  const [search, setSearch] = useState("");
  const color = span.status === "error" ? ERROR_COLOR : spanColorFor(span.service);
  const eventCount = span.events?.length ?? 0;

  const filteredAttrs = useMemo(() => {
    const entries = Object.entries(span.attributes);
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q));
  }, [span.attributes, search]);

  return (
    <div className="h-full flex flex-col border-l border-border bg-[hsl(var(--card))]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            Span details
          </div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            close
          </button>
        </div>

        {/* Span ID */}
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Span ID</div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-foreground">{span.id.slice(0, 16)}...</span>
              <CopyButton text={span.id} />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Service</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: spanColorFor(span.service) }} />
              <span className="font-mono text-xs">{span.service}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Operation</div>
            <span className="font-mono text-xs">{span.name}</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Duration</div>
              <span className="font-mono text-xs">{formatDuration(span.duration)}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Kind</div>
              <span className="font-mono text-xs">{span.kind}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Status</div>
              <span className={`font-mono text-xs ${span.status === "error" ? "text-status-error" : "text-status-ok"}`}>
                {span.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Signals */}
      <div className="px-4 py-2 border-b border-border flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Related signals</div>
        <div className="flex gap-1.5">
          <Link
            to={`/app/logs?trace_id=${span.id}`}
            className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:border-ring hover:text-foreground text-muted-foreground transition-colors"
          >
            Logs
          </Link>
          <Link
            to={`/app/services/${span.service}`}
            className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:border-ring hover:text-foreground text-muted-foreground transition-colors"
          >
            Service
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2 border-b border-border flex gap-0 flex-shrink-0">
        <button
          onClick={() => setTab("tags")}
          className={`px-3 py-1.5 text-xs font-medium -mb-px border-b-2 transition-colors ${
            tab === "tags"
              ? "border-[#4E92F9] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Tags
        </button>
        <button
          onClick={() => setTab("events")}
          className={`px-3 py-1.5 text-xs font-medium -mb-px border-b-2 transition-colors flex items-center gap-1 ${
            tab === "events"
              ? "border-[#4E92F9] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Events
          {eventCount > 0 && (
            <span className="text-[10px] font-mono bg-secondary px-1 rounded">{eventCount}</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "tags" && (
          <div className="p-4">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tags..."
                className="w-full h-7 pl-7 pr-2 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
              />
            </div>
            {filteredAttrs.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                {Object.keys(span.attributes).length === 0 ? "No tags" : "No matching tags"}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAttrs.map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[11px] text-muted-foreground mb-0.5 truncate">{k}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-secondary/80 border border-border px-1.5 py-0.5 rounded break-all">
                        {String(v)}
                      </span>
                      <CopyButton text={String(v)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "events" && (
          <div className="p-4">
            {!span.events || span.events.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No events</div>
            ) : (
              <div className="space-y-3">
                {span.events.map((e, i) => (
                  <div key={i} className="border border-border rounded p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{e.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        +{formatDuration(e.time)}
                      </span>
                    </div>
                    {e.attrs && Object.entries(e.attrs).length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {Object.entries(e.attrs).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="text-foreground">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Span Row ────────────────────────────────────────────────── */

function SpanRow({
  span,
  total,
  childCount,
  isCollapsed,
  isSelected,
  onToggle,
  onSelect,
}: {
  span: Span;
  total: number;
  childCount: number;
  isCollapsed: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const color = span.status === "error" ? ERROR_COLOR : spanColorFor(span.service);
  const hasChildren = childCount > 0;
  const barLeft = total > 0 ? (span.start / total) * 100 : 0;
  const barWidth = total > 0 ? Math.max(0.3, (span.duration / total) * 100) : 0;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-0 cursor-pointer group transition-colors border-b border-border/50 ${
        isSelected
          ? "bg-[hsl(var(--secondary)/0.8)]"
          : "hover:bg-[hsl(var(--secondary)/0.4)]"
      }`}
      style={{ minHeight: 40 }}
    >
      {/* Left: span info */}
      <div className="w-[45%] flex-shrink-0 flex items-center min-w-0 px-2 py-1.5" style={{ paddingLeft: 8 + span.depth * 18 }}>
        {/* Collapse toggle */}
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground flex-shrink-0 mr-1"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {isCollapsed && (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1 rounded">
                {childCount}
              </span>
            )}
          </button>
        ) : (
          <span className="w-3.5 flex-shrink-0 mr-1" />
        )}

        {/* Error icon */}
        {span.status === "error" && (
          <AlertTriangle className="w-3 h-3 text-status-error flex-shrink-0 mr-1.5" />
        )}

        <div className="min-w-0 flex-1">
          {/* Operation name */}
          <div className="font-mono text-xs font-medium truncate leading-tight">
            {span.name}
          </div>
          {/* Service + timing */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] text-muted-foreground truncate">
              {span.service}
            </span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
              {span.start === 0 ? "start" : `${formatDuration(span.start)} after start`}
            </span>
          </div>
        </div>
      </div>

      {/* Right: duration bar */}
      <div className="flex-1 flex items-center gap-2 pr-3 min-w-0">
        <div className="relative h-[18px] flex-1 rounded-sm">
          <div
            className="absolute h-full rounded-sm transition-opacity"
            style={{
              left: `${barLeft}%`,
              width: `${barWidth}%`,
              background: color,
              opacity: isSelected ? 1 : 0.8,
              minWidth: 3,
            }}
          />
          {/* Event markers */}
          {span.events?.map((ev, i) => (
            <div
              key={i}
              className="absolute top-0 w-[2px] h-full bg-foreground/60 rounded-full"
              style={{ left: `${total > 0 ? (ev.time / total) * 100 : 0}%` }}
              title={ev.name}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground w-16 text-right flex-shrink-0 flex items-center justify-end gap-0.5">
          <Clock className="w-2.5 h-2.5 opacity-50" />
          {formatDuration(span.duration)}
        </span>
      </div>
    </div>
  );
}

/* ── Time Ruler ──────────────────────────────────────────────── */

function TimeRuler({ total }: { total: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="flex items-center border-b border-border bg-[hsl(var(--secondary)/0.2)]" style={{ minHeight: 24 }}>
      <div className="w-[45%] flex-shrink-0 px-3 text-[10px] font-mono text-muted-foreground">
        Span
      </div>
      <div className="flex-1 flex justify-between pr-3">
        {ticks.map(p => (
          <span key={p} className="text-[9px] font-mono text-muted-foreground/60">
            {formatDuration(total * p)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export default function TraceDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [traceData, setTraceData] = useState<TraceDetailData | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const spanListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resetServiceColors();
    if (!id) return;
    setLoading(true);
    fetchTraceDetail(id)
      .then(d => {
        setTraceData(d);
        if (d && d.spans.length > 0) setSelectedSpanId(d.spans[0].id);
      })
      .catch(() => setTraceData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const spans: Span[] = traceData?.spans ?? [];
  const linkedLogs: Log[] = traceData?.logs ?? [];
  const total = traceData?.duration ?? 0;

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Span[]>();
    for (const s of spans) {
      const arr = map.get(s.parentId) ?? [];
      arr.push(s);
      map.set(s.parentId, arr);
    }
    return map;
  }, [spans]);

  // Count all descendants (not just direct children)
  const descendantCount = useCallback((spanId: string): number => {
    const children = childrenMap.get(spanId) ?? [];
    let count = children.length;
    for (const c of children) {
      count += descendantCount(c.id);
    }
    return count;
  }, [childrenMap]);

  const isHidden = useCallback((span: Span): boolean => {
    let cur = span.parentId;
    while (cur) {
      if (collapsed.has(cur)) return true;
      const parent = spans.find(s => s.id === cur);
      cur = parent?.parentId ?? null;
    }
    return false;
  }, [collapsed, spans]);

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const visible = useMemo(() => spans.filter(s => !isHidden(s)), [spans, isHidden]);
  const selectedSpan = spans.find(s => s.id === selectedSpanId) ?? null;
  const errorCount = spans.filter(s => s.status === "error").length;

  // Unique services
  const serviceList = useMemo(() => {
    const seen = new Set<string>();
    return spans.filter(s => { if (seen.has(s.service)) return false; seen.add(s.service); return true; });
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
          <p className="text-sm text-muted-foreground mt-1">
            The trace <span className="font-mono">{id}</span> was not found or has expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-border flex-shrink-0 bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between mb-2">
          <Link to="/app/traces" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to traces
          </Link>
        </div>

        {/* Trace ID row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              traceData.status === "ok"
                ? "border-status-ok/40 text-status-ok"
                : "border-status-error/40 text-status-error"
            }`}>
              {traceData.status.toUpperCase()}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Trace ID</span>
            <span className="font-mono text-xs text-foreground">{traceData.id}</span>
            <CopyButton text={traceData.id} />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="font-mono">Across {serviceList.length} service{serviceList.length !== 1 ? "s" : ""}</span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {formatDuration(total)}
            </span>
            <span className="text-border">|</span>
            <span className="font-mono">{traceData.timestamp}</span>
            {traceData.name && (
              <>
                <span className="text-border">|</span>
                <span className="font-mono text-foreground">{traceData.name}</span>
              </>
            )}
          </div>

          {/* Span + Error counts */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Spans</div>
              <div className="font-mono text-sm font-medium">{spans.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</div>
              <div className={`font-mono text-sm font-medium ${errorCount > 0 ? "text-status-error" : ""}`}>
                {errorCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline Minimap ────────────────────────────────────── */}
      <div className="px-5 py-2 border-b border-border flex-shrink-0 bg-[hsl(var(--card))]">
        <TimelineMinimap spans={spans} total={total} />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="px-5 py-1.5 border-b border-border flex items-center justify-between flex-shrink-0 bg-[hsl(var(--secondary)/0.15)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(new Set())}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={() => setCollapsed(new Set(spans.filter(s => (childrenMap.get(s.id)?.length ?? 0) > 0).map(s => s.id)))}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded transition-colors"
          >
            Collapse all
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Service legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {serviceList.map(s => (
              <div key={s.service} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: spanColorFor(s.service) }} />
                <span className="text-[10px] font-mono text-muted-foreground">{s.service}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content: Waterfall + Detail Panel ──────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Span waterfall */}
        <div className={`${selectedSpan ? "w-[60%]" : "w-full"} flex flex-col min-h-0 transition-all`}>
          <TimeRuler total={total} />
          <div ref={spanListRef} className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No spans found</div>
            ) : (
              visible.map(s => (
                <SpanRow
                  key={s.id}
                  span={s}
                  total={total}
                  childCount={descendantCount(s.id)}
                  isCollapsed={collapsed.has(s.id)}
                  isSelected={selectedSpanId === s.id}
                  onToggle={() => toggle(s.id)}
                  onSelect={() => setSelectedSpanId(selectedSpanId === s.id ? null : s.id)}
                />
              ))
            )}

            {/* Linked logs section */}
            {linkedLogs.length > 0 && (
              <div className="border-t border-border mt-2">
                <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-[hsl(var(--secondary)/0.15)]">
                  Linked logs ({linkedLogs.length})
                </div>
                <div className="divide-y divide-border/50">
                  {linkedLogs.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-1.5 text-xs hover:bg-[hsl(var(--secondary)/0.3)]">
                      <span className="font-mono text-muted-foreground text-[10px] w-20 flex-shrink-0">{l.timestamp}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${
                        l.level === "error" ? "text-status-error border-status-error/40" :
                        l.level === "warn" ? "text-status-warn border-status-warn/40" :
                        "text-status-info border-status-info/40"
                      }`}>{l.level.toUpperCase()}</span>
                      <span className="font-mono text-muted-foreground flex-shrink-0 text-[10px]">{l.service}</span>
                      <span className="font-mono truncate text-[11px]">{l.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail sidebar */}
        {selectedSpan && (
          <div className="w-[40%] flex-shrink-0 overflow-hidden">
            <SpanDetailSidebar
              span={selectedSpan}
              onClose={() => setSelectedSpanId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
