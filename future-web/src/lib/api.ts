import type { Span as UISpan, SpanKind, Log } from "./mockData";

// Raw API response types
interface APISpanEvent {
  time: number;
  name: string;
  attrs?: Record<string, string | number>;
}

interface APISpan {
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  service: string;
  environment: string;
  route: string;
  name: string;
  kind: string;
  duration_ms: number;
  status: string;
  error: string;
  start_time: string;
  end_time: string;
  attributes: Record<string, string | number | boolean>;
  events: APISpanEvent[];
}

interface APITraceDetail {
  trace_id: string;
  name: string;
  service: string;
  duration: number;
  status: string;
  timestamp: string;
  span_count: number;
  spans: APISpan[];
}

export interface TraceDetail {
  id: string;
  name: string;
  service: string;
  duration: number;
  status: "ok" | "error";
  timestamp: string;
  spanCount: number;
  spans: UISpan[];
  logs: Log[];
}

const API_BASE = "/api";

function computeDepth(
  spanId: string,
  parentMap: Map<string, string>,
  cache: Map<string, number>
): number {
  if (cache.has(spanId)) return cache.get(spanId)!;
  const parentId = parentMap.get(spanId);
  if (!parentId) {
    cache.set(spanId, 0);
    return 0;
  }
  const d = computeDepth(parentId, parentMap, cache) + 1;
  cache.set(spanId, d);
  return d;
}

function transformSpans(apiSpans: APISpan[]): UISpan[] {
  if (apiSpans.length === 0) return [];

  // Find earliest start time (trace start)
  const traceStart = Math.min(
    ...apiSpans.map((s) => new Date(s.start_time).getTime())
  );

  // Build parent map for depth computation
  const parentMap = new Map<string, string>();
  for (const s of apiSpans) {
    if (s.parent_span_id) {
      parentMap.set(s.span_id, s.parent_span_id);
    }
  }
  const depthCache = new Map<string, number>();

  return apiSpans.map((s) => {
    const startMs = new Date(s.start_time).getTime();
    const relativeStart = startMs - traceStart;
    const depth = computeDepth(s.span_id, parentMap, depthCache);
    const kind = (s.kind || "internal") as SpanKind;

    // Convert events: API sends absolute timestamps, UI expects relative to span start
    const events = (s.events || []).map((e) => {
      // If event time looks like an absolute timestamp (> 1e12), convert to relative
      const relTime =
        e.time > 1e12 ? e.time - traceStart : relativeStart + e.time;
      return {
        time: relTime,
        name: e.name,
        ...(e.attrs ? { attrs: e.attrs } : {}),
      };
    });

    return {
      id: s.span_id,
      parentId: s.parent_span_id || null,
      name: s.name,
      service: s.service,
      kind,
      start: relativeStart,
      duration: s.duration_ms,
      status: (s.status === "error" ? "error" : "ok") as "ok" | "error",
      depth,
      attributes: s.attributes || {},
      events: events.length > 0 ? events : undefined,
    };
  });
}

export async function fetchTraceDetail(
  traceId: string
): Promise<TraceDetail | null> {
  const res = await fetch(`${API_BASE}/traces/${traceId}`);
  if (!res.ok) return null;

  const data: APITraceDetail = await res.json();

  const spans = transformSpans(data.spans);

  // Format timestamp for display
  const ts = new Date(data.timestamp);
  const timestamp = ts.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  return {
    id: data.trace_id,
    name: data.name,
    service: data.service,
    duration: data.duration,
    status: data.status === "error" ? "error" : "ok",
    timestamp,
    spanCount: data.span_count,
    spans,
    logs: [], // TODO: fetch linked logs when log API is ready
  };
}
