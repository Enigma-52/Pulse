import type { Span as UISpan, SpanKind, Log, Trace, Metric } from "./mockData";

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

interface APITrace {
  trace_id: string;
  service: string;
  route: string;
  duration_ms: number;
  status: string;
  timestamp: string;
}

interface APILogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  environment: string;
  trace_id: string;
  span_id: string;
  fields: Record<string, string | number>;
}

interface APIMetricMeta {
  name: string;
  type: string;
  unit: string;
  value: number;
  delta: number;
  description: string;
}

interface APIMetricSeriesPoint {
  timestamp: string;
  value: number;
}

interface APIDashboardSummary {
  request_rate: number;
  p99_latency: number;
  error_rate: number;
  trace_count: number;
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

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("pulse_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  const traceStart = Math.min(
    ...apiSpans.map((s) => new Date(s.start_time).getTime())
  );

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

    const events = (s.events || []).map((e) => {
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

function formatTimestamp(iso: string): string {
  const ts = new Date(iso);
  return ts.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

// ── Traces ──────────────────────────────────────────────────────────────

export async function fetchTraces(params?: {
  service?: string;
  status?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Trace[]> {
  const q = new URLSearchParams();
  q.set("limit", String(params?.limit ?? 50));
  if (params?.service) q.set("service", params.service);
  if (params?.status) q.set("status", params.status);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);

  const res = await fetch(`${API_BASE}/traces?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: APITrace[] } = await res.json();
  if (!data.items) return [];
  return data.items.map((t) => ({
    id: t.trace_id,
    name: t.route || "unknown",
    service: t.service,
    duration: t.duration_ms,
    spans: 0,
    status: (t.status === "error" ? "error" : "ok") as "ok" | "error",
    timestamp: formatTimestamp(t.timestamp),
  }));
}

export async function fetchTraceDetail(
  traceId: string
): Promise<TraceDetail | null> {
  const [traceRes, logsRes] = await Promise.all([
    fetch(`${API_BASE}/traces/${traceId}`, { headers: authHeaders() }),
    fetch(`${API_BASE}/logs?trace_id=${traceId}&limit=100`, { headers: authHeaders() }),
  ]);
  if (!traceRes.ok) return null;

  const data: APITraceDetail = await traceRes.json();
  const spans = transformSpans(data.spans);

  const logs: Log[] = [];
  if (logsRes.ok) {
    const logsData: { items: APILogEntry[] } = await logsRes.json();
    if (logsData.items) {
      for (const l of logsData.items) {
        logs.push({
          id: `${l.trace_id}-${l.span_id}-${l.timestamp}`,
          timestamp: formatTimestamp(l.timestamp),
          level: l.level as Log["level"],
          service: l.service,
          message: l.message,
          trace_id: l.trace_id,
          span_id: l.span_id,
          attributes: l.fields || {},
        });
      }
    }
  }

  return {
    id: data.trace_id,
    name: data.name,
    service: data.service,
    duration: data.duration,
    status: data.status === "error" ? "error" : "ok",
    timestamp: formatTimestamp(data.timestamp),
    spanCount: data.span_count,
    spans,
    logs,
  };
}

// ── Logs ────────────────────────────────────────────────────────────────

export async function fetchLogs(params?: {
  service?: string;
  level?: string;
  search?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Log[]> {
  const q = new URLSearchParams();
  if (params?.service) q.set("service", params.service);
  if (params?.level) q.set("level", params.level);
  if (params?.search) q.set("search", params.search);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);
  q.set("limit", String(params?.limit ?? 100));

  const res = await fetch(`${API_BASE}/logs?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: APILogEntry[] } = await res.json();
  if (!data.items) return [];
  return data.items.map((l) => ({
    id: `${l.trace_id || "no-trace"}-${l.timestamp}`,
    timestamp: formatTimestamp(l.timestamp),
    level: l.level as Log["level"],
    service: l.service,
    message: l.message,
    trace_id: l.trace_id || undefined,
    span_id: l.span_id || undefined,
    attributes: l.fields || {},
  }));
}

// ── Metrics ─────────────────────────────────────────────────────────────

export async function fetchMetrics(): Promise<Metric[]> {
  const res = await fetch(`${API_BASE}/metrics`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: APIMetricMeta[] } = await res.json();
  if (!data.items) return [];
  return data.items.map((m) => ({
    id: m.name.replace(/\./g, "_"),
    name: m.name,
    unit: m.unit || "",
    value: m.value,
    delta: m.delta,
    description: m.description || "",
  }));
}

export async function fetchMetricSeries(
  name: string,
  minutes = 15,
  interval = 30
): Promise<{ t: number; value: number }[]> {
  const res = await fetch(
    `${API_BASE}/metrics/${encodeURIComponent(name)}/series?minutes=${minutes}&interval=${interval}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return [];
  const data: { points: APIMetricSeriesPoint[] } = await res.json();
  if (!data.points) return [];
  return data.points.map((p, i) => ({
    t: i,
    value: p.value,
  }));
}

export async function queryMetrics(params: {
  name?: string;
  service?: string;
  type?: string;
  minutes?: number;
  interval?: number;
}): Promise<{
  series: { name: string; unit: string; points: { t: number; value: number }[] }[];
}> {
  const q = new URLSearchParams();
  if (params.name) q.set("name", params.name);
  if (params.service) q.set("service", params.service);
  if (params.type) q.set("type", params.type);
  q.set("minutes", String(params.minutes ?? 15));
  q.set("interval", String(params.interval ?? 30));

  const res = await fetch(`${API_BASE}/metrics/query?${q}`, { headers: authHeaders() });
  if (!res.ok) return { series: [] };
  const data = await res.json();
  if (!data.series) return { series: [] };
  return {
    series: data.series.map((s: { name: string; unit: string; points: { timestamp: string; value: number }[] }) => ({
      name: s.name,
      unit: s.unit,
      points: (s.points || []).map((p: { timestamp: string; value: number }, i: number) => ({
        t: i,
        value: p.value,
      })),
    })),
  };
}

// ── Services ─────────────────────────────────────────────────────────────

export interface ServiceSummary {
  service: string;
  trace_count: number;
  error_count: number;
  error_rate: number;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  last_seen: string;
}

export async function fetchServicesList(minutes = 15): Promise<ServiceSummary[]> {
  const res = await fetch(`${API_BASE}/services?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: ServiceSummary[] } = await res.json();
  return data.items || [];
}

// ── Databases ───────────────────────────────────────────────────────────

export interface DatabaseSummary {
  system: string;
  query_count: number;
  error_count: number;
  error_rate: number;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  last_seen: string;
}

export interface DatabaseOperation {
  trace_id: string;
  span_id: string;
  service: string;
  db_system: string;
  db_name: string;
  db_statement: string;
  duration_ms: number;
  status: string;
  timestamp: string;
}

export interface DatabaseThroughputPoint {
  timestamp: string;
  count: number;
  errors: number;
  avg_ms: number;
}

export interface DatabaseOverviewData {
  overview: {
    system: string;
    query_count: number;
    error_count: number;
    error_rate: number;
    avg_duration_ms: number;
    p50_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
    database_names: string[];
  };
  throughput: DatabaseThroughputPoint[];
}

export async function fetchDatabasesList(minutes = 15): Promise<DatabaseSummary[]> {
  const res = await fetch(`${API_BASE}/databases?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: DatabaseSummary[] } = await res.json();
  return data.items || [];
}

export async function fetchDatabaseOverview(system: string, minutes = 15): Promise<DatabaseOverviewData | null> {
  const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(system)}/overview?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchDatabaseQueries(system: string, minutes = 15, limit = 50): Promise<DatabaseOperation[]> {
  const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(system)}/queries?minutes=${minutes}&limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: DatabaseOperation[] } = await res.json();
  return data.items || [];
}

// ── Dashboard ───────────────────────────────────────────────────────────

export interface DashboardData {
  requestRate: number;
  p99Latency: number;
  errorRate: number;
  traceCount: number;
}

export async function fetchDashboardSummary(minutes = 15): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard/summary?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return { requestRate: 0, p99Latency: 0, errorRate: 0, traceCount: 0 };
  const data: APIDashboardSummary = await res.json();
  return {
    requestRate: data.request_rate,
    p99Latency: data.p99_latency,
    errorRate: data.error_rate,
    traceCount: data.trace_count,
  };
}
