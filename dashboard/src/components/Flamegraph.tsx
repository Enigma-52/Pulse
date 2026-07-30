import { useMemo } from "react";
import { Span } from "@/lib/types";
import { chartPalette } from "@/lib/colors";

const PALETTE = chartPalette as unknown as string[];

export const ERROR_COLOR = "#F44336";

// ── Operation Category Colors ────────────────────────────────────
// Used when a trace has only one service so spans get distinct colors
// by what they *do* rather than which service they belong to.

const OP_CATEGORY_COLORS: Record<string, string> = {
  http:       "#4E92F9", // blue — HTTP server/request handler
  database:   "#26C6DA", // teal — pg.query, pg.connect, db operations
  middleware: "#78909C", // blue grey — middleware-*
  network:    "#FF9800", // orange — tcp.connect, dns.resolve
  queue:      "#AB47BC", // violet — queue/message operations
  cache:      "#9CCC65", // light green — redis, cache
  grpc:       "#7C4DFF", // purple — gRPC calls
  internal:   "#546E7A", // grey — generic internal spans
};

const OP_CATEGORY_LABELS: Record<string, string> = {
  http:       "HTTP",
  database:   "Database",
  middleware: "Middleware",
  network:    "Network",
  queue:      "Queue",
  cache:      "Cache",
  grpc:       "gRPC",
  internal:   "Internal",
};

function classifyOperation(name: string, kind: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith("pg.") || lower.startsWith("pg-pool") || lower.includes("query") || lower.includes("sql") || lower.includes("database")) return "database";
  if (lower.startsWith("middleware")) return "middleware";
  if (lower.includes("tcp.") || lower.includes("dns.") || lower.includes("net.")) return "network";
  if (lower.includes("redis") || lower.includes("cache") || lower.includes("memcache")) return "cache";
  if (lower.includes("grpc")) return "grpc";
  if (lower.includes("queue") || lower.includes("kafka") || lower.includes("rabbitmq") || lower.includes("amqp")) return "queue";
  if (kind === "server" || kind === "client" || lower.startsWith("get") || lower.startsWith("post") || lower.startsWith("put") || lower.startsWith("delete") || lower.startsWith("patch") || lower.includes("request handler") || lower.includes("http")) return "http";
  return "internal";
}

// Deterministic color from service name (hash-based, no global state)
export function spanColorFor(service: string): string {
  let hash = 0;
  for (let i = 0; i < service.length; i++) {
    hash = ((hash << 5) - hash + service.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export type ColorMapResult = {
  colorOf: (span: Span) => string;
  legend: { key: string; label: string; color: string }[];
  isByCategory: boolean;
};

// Build color mapping — by service when multi-service, by operation category when single-service
export function buildSpanColorMapping(spans: Span[]): ColorMapResult {
  const services = new Set(spans.map(s => s.service));

  if (services.size > 1) {
    // Multi-service: color by service
    const map = new Map<string, string>();
    let idx = 0;
    for (const s of spans) {
      if (!map.has(s.service)) {
        map.set(s.service, PALETTE[idx % PALETTE.length]);
        idx++;
      }
    }
    return {
      colorOf: (span) => map.get(span.service) ?? PALETTE[0],
      legend: Array.from(map.entries()).map(([svc, color]) => ({ key: svc, label: svc, color })),
      isByCategory: false,
    };
  }

  // Single service: color by operation category
  const usedCategories = new Set<string>();
  for (const s of spans) {
    usedCategories.add(classifyOperation(s.name, s.kind));
  }
  return {
    colorOf: (span) => OP_CATEGORY_COLORS[classifyOperation(span.name, span.kind)] ?? OP_CATEGORY_COLORS.internal,
    legend: Array.from(usedCategories).map(cat => ({
      key: cat,
      label: OP_CATEGORY_LABELS[cat] ?? cat,
      color: OP_CATEGORY_COLORS[cat] ?? OP_CATEGORY_COLORS.internal,
    })),
    isByCategory: true,
  };
}

// Backward-compat: build a service-only color map
export function buildServiceColorMap(spans: Span[]): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  for (const s of spans) {
    if (!map.has(s.service)) {
      map.set(s.service, PALETTE[idx % PALETTE.length]);
      idx++;
    }
  }
  return map;
}

export function formatDuration(ms: number): string {
  if (ms < 0.01) return "<0.01ms";
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Timeline minimap — overview of all spans
export function TimelineMinimap({ spans, total, colorMapping }: { spans: Span[]; total: number; colorMapping: ColorMapResult }) {
  if (spans.length === 0 || total === 0) return null;

  const rowH = 6;
  const gap = 2;
  const height = spans.length * (rowH + gap) - gap;

  return (
    <div className="w-full overflow-hidden rounded bg-[hsl(var(--secondary)/0.3)] border border-border px-3 py-2">
      <svg width="100%" height={Math.max(height, 16)} viewBox={`0 0 1000 ${Math.max(height, 16)}`} preserveAspectRatio="none">
        {spans.map((s, row) => {
          const x = (s.start / total) * 1000;
          const w = Math.max(2, (s.duration / total) * 1000);
          const color = s.status === "error" ? ERROR_COLOR : colorMapping.colorOf(s);
          return (
            <rect
              key={s.id}
              x={x} y={row * (rowH + gap)}
              width={w} height={rowH}
              rx={1}
              fill={color}
              opacity={0.85}
            />
          );
        })}
      </svg>
    </div>
  );
}

// Default export kept for backwards compat
export default function Flamegraph({ spans, total }: { spans: Span[]; total: number }) {
  const colorMapping = useMemo(() => buildSpanColorMapping(spans), [spans]);
  return <TimelineMinimap spans={spans} total={total} colorMapping={colorMapping} />;
}
