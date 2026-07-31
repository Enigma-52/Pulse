import type { Span as UISpan, SpanKind, Log, Trace, Metric } from "./types";

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
  name: string;
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

// apiFetch wraps fetch for all query-API calls: a 401 means the stored token
// is missing/expired, so clear it and send the user back to login instead of
// silently rendering empty data everywhere.
async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && !window.location.pathname.startsWith("/login")) {
    localStorage.removeItem("pulse_token");
    window.location.assign("/login");
  }
  return res;
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
  const time = ts.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
  // Prefix the date for rows not from today so long ranges stay unambiguous.
  const now = new Date();
  if (ts.toDateString() === now.toDateString()) return time;
  return `${ts.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} ${time}`;
}

function formatChartTime(iso: string): string {
  const ts = new Date(iso);
  return ts.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function traceDisplayName(t: APITrace): string {
  // Prefer "METHOD /route" format, fall back to span name
  if (t.route && t.route !== "/") {
    return t.name && t.name !== "GET" && t.name !== "POST" && t.name !== "PUT" && t.name !== "DELETE" && t.name !== "PATCH"
      ? `${t.name} ${t.route}`
      : t.route;
  }
  if (t.name) return t.name;
  return t.route || "unknown";
}

// ── Traces ──────────────────────────────────────────────────────────────

export interface TracesPage {
  items: Trace[];
  total: number;
}

export async function fetchTracesPage(params?: {
  service?: string;
  status?: string;
  q?: string;
  environment?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}): Promise<TracesPage> {
  const q = new URLSearchParams();
  q.set("limit", String(params?.limit ?? 50));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.environment) q.set("environment", params.environment);
  if (params?.service) q.set("service", params.service);
  if (params?.status) q.set("status", params.status);
  if (params?.q) q.set("q", params.q);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);

  const res = await apiFetch(`${API_BASE}/traces?${q}`, { headers: authHeaders() });
  if (!res.ok) return { items: [], total: 0 };
  const data: { items: APITrace[]; total?: number } = await res.json();
  const items = (data.items || []).map((t) => ({
    id: t.trace_id,
    name: traceDisplayName(t),
    service: t.service,
    duration: t.duration_ms,
    spans: 0,
    status: (t.status === "error" ? "error" : "ok") as "ok" | "error",
    timestamp: formatTimestamp(t.timestamp),
  }));
  return { items, total: data.total ?? items.length };
}

export async function fetchTraces(params?: {
  service?: string;
  status?: string;
  environment?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Trace[]> {
  const q = new URLSearchParams();
  q.set("limit", String(params?.limit ?? 50));
  if (params?.service) q.set("service", params.service);
  if (params?.status) q.set("status", params.status);
  if (params?.environment) q.set("environment", params.environment);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);

  const res = await apiFetch(`${API_BASE}/traces?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: APITrace[] } = await res.json();
  if (!data.items) return [];
  return data.items.map((t) => ({
    id: t.trace_id,
    name: traceDisplayName(t),
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
    apiFetch(`${API_BASE}/traces/${traceId}`, { headers: authHeaders() }),
    apiFetch(`${API_BASE}/logs?trace_id=${traceId}&limit=100`, { headers: authHeaders() }),
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
  traceId?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Log[]> {
  const q = new URLSearchParams();
  if (params?.service) q.set("service", params.service);
  if (params?.level) q.set("level", params.level);
  if (params?.search) q.set("search", params.search);
  if (params?.traceId) q.set("trace_id", params.traceId);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);
  q.set("limit", String(params?.limit ?? 100));

  const res = await apiFetch(`${API_BASE}/logs?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: APILogEntry[] } = await res.json();
  if (!data.items) return [];
  return data.items.map((l) => ({
    // id encodes trace_id + raw timestamp so the detail page can re-query
    // the exact log after a refresh instead of matching a transient list.
    id: `${l.trace_id}~${l.timestamp}`,
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

export async function fetchMetrics(minutes = 15): Promise<Metric[]> {
  const res = await apiFetch(`${API_BASE}/metrics?minutes=${minutes}`, { headers: authHeaders() });
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
  interval = 30,
  attr?: { key: string; value: string }
): Promise<{ tms: number; value: number }[]> {
  const q = new URLSearchParams({ minutes: String(minutes), interval: String(interval) });
  if (attr) {
    q.set("attr_key", attr.key);
    q.set("attr_value", attr.value);
  }
  const res = await apiFetch(
    `${API_BASE}/metrics/${encodeURIComponent(name)}/series?${q}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return [];
  const data: { points: APIMetricSeriesPoint[] } = await res.json();
  if (!data.points) return [];
  return data.points.map((p) => ({
    tms: new Date(p.timestamp).getTime(),
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
  series: { name: string; unit: string; points: { t: string; value: number }[] }[];
}> {
  const q = new URLSearchParams();
  if (params.name) q.set("name", params.name);
  if (params.service) q.set("service", params.service);
  if (params.type) q.set("type", params.type);
  q.set("minutes", String(params.minutes ?? 15));
  q.set("interval", String(params.interval ?? 30));

  const res = await apiFetch(`${API_BASE}/metrics/query?${q}`, { headers: authHeaders() });
  if (!res.ok) return { series: [] };
  const data = await res.json();
  if (!data.series) return { series: [] };
  return {
    series: data.series.map((s: { name: string; unit: string; points: { timestamp: string; value: number }[] }) => ({
      name: s.name,
      unit: s.unit,
      points: (s.points || []).map((p: { timestamp: string; value: number }) => ({
        t: formatChartTime(p.timestamp),
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
  const res = await apiFetch(`${API_BASE}/services?minutes=${minutes}`, { headers: authHeaders() });
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
  const res = await apiFetch(`${API_BASE}/databases?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: DatabaseSummary[] } = await res.json();
  return data.items || [];
}

export async function fetchDatabaseOverview(system: string, minutes = 15): Promise<DatabaseOverviewData | null> {
  const res = await apiFetch(`${API_BASE}/databases/${encodeURIComponent(system)}/overview?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchDatabaseQueries(system: string, minutes = 15, limit = 50): Promise<DatabaseOperation[]> {
  const res = await apiFetch(`${API_BASE}/databases/${encodeURIComponent(system)}/queries?minutes=${minutes}&limit=${limit}`, { headers: authHeaders() });
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

export async function fetchDashboardSummary(minutes = 15, environment = ""): Promise<DashboardData> {
  const q = new URLSearchParams({ minutes: String(minutes) });
  if (environment) q.set("environment", environment);
  const res = await apiFetch(`${API_BASE}/dashboard/summary?${q}`, { headers: authHeaders() });
  if (!res.ok) return { requestRate: 0, p99Latency: 0, errorRate: 0, traceCount: 0 };
  const data: APIDashboardSummary = await res.json();
  return {
    requestRate: data.request_rate,
    p99Latency: data.p99_latency,
    errorRate: data.error_rate,
    traceCount: data.trace_count,
  };
}

// ── Alerts ──────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  signal: "traces" | "logs" | "metrics";
  metric_name: string;
  service: string;
  group_by_service: boolean;
  aggregation: string;
  operator: "gt" | "gte" | "lt" | "lte";
  threshold: number;
  window_minutes: number;
  channel_ids: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AlertRulePayload = Omit<AlertRule, "id" | "created_at" | "updated_at">;

export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  service: string;
  status: "firing" | "resolved";
  value: number;
  threshold: number;
  message: string;
  fired_at: string;
  resolved_at: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: "webhook" | "slack" | "email";
  config_json: string;
  created_at: string;
  updated_at: string;
}

export async function fetchAlertRules(): Promise<AlertRule[]> {
  const res = await apiFetch(`${API_BASE}/alerts/rules`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: AlertRule[] } = await res.json();
  return data.items || [];
}

export async function fetchAlertRule(id: string): Promise<AlertRule | null> {
  const res = await apiFetch(`${API_BASE}/alerts/rules/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function createAlertRule(payload: AlertRulePayload): Promise<AlertRule | null> {
  const res = await apiFetch(`${API_BASE}/alerts/rules`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function updateAlertRule(id: string, payload: AlertRulePayload): Promise<AlertRule | null> {
  const res = await apiFetch(`${API_BASE}/alerts/rules/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const res = await apiFetch(`${API_BASE}/alerts/rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.ok;
}

export async function fetchAlerts(params?: { status?: string; ruleId?: string; limit?: number }): Promise<Alert[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.ruleId) search.set("rule_id", params.ruleId);
  if (params?.limit) search.set("limit", String(params.limit));
  const res = await apiFetch(`${API_BASE}/alerts?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: Alert[] } = await res.json();
  return data.items || [];
}

export async function fetchAlert(id: string): Promise<Alert | null> {
  const res = await apiFetch(`${API_BASE}/alerts/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchChannels(): Promise<NotificationChannel[]> {
  const res = await apiFetch(`${API_BASE}/alerts/channels`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: NotificationChannel[] } = await res.json();
  return data.items || [];
}

export async function createChannel(payload: { name: string; type: string; config_json: string }): Promise<NotificationChannel | null> {
  const res = await apiFetch(`${API_BASE}/alerts/channels`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function updateChannel(id: string, payload: { name: string; type: string; config_json: string }): Promise<NotificationChannel | null> {
  const res = await apiFetch(`${API_BASE}/alerts/channels/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function deleteChannel(id: string): Promise<boolean> {
  const res = await apiFetch(`${API_BASE}/alerts/channels/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.ok;
}

// ── Exceptions ──────────────────────────────────────────────────────────

export interface ExceptionGroup {
  fingerprint: string;
  type: string;
  message: string;
  service: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
}

export interface ExceptionTrace {
  trace_id: string;
  service: string;
  name: string;
  duration_ms: number;
  status: string;
  timestamp: string;
}

export interface ExceptionDetail extends ExceptionGroup {
  environment: string;
  route: string;
  stacktrace: string;
  trace_ids: string[];
  traces: ExceptionTrace[];
}

export interface ExceptionBucket {
  timestamp: string;
  count: number;
}

export async function fetchExceptions(params?: { minutes?: number; service?: string; q?: string; limit?: number }): Promise<ExceptionGroup[]> {
  const search = new URLSearchParams();
  if (params?.minutes) search.set("minutes", String(params.minutes));
  if (params?.service) search.set("service", params.service);
  if (params?.q) search.set("q", params.q);
  if (params?.limit) search.set("limit", String(params.limit));
  const res = await apiFetch(`${API_BASE}/exceptions?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: ExceptionGroup[] } = await res.json();
  return data.items || [];
}

export async function fetchExceptionDetail(fingerprint: string, minutes = 15): Promise<ExceptionDetail | null> {
  const res = await apiFetch(`${API_BASE}/exceptions/${encodeURIComponent(fingerprint)}?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchExceptionTimeseries(fingerprint: string, minutes = 15, interval = 1): Promise<ExceptionBucket[]> {
  const res = await apiFetch(
    `${API_BASE}/exceptions/${encodeURIComponent(fingerprint)}/timeseries?minutes=${minutes}&interval=${interval}`,
    { headers: authHeaders() },
  );
  if (!res.ok) return [];
  const data: { points: ExceptionBucket[] } = await res.json();
  return data.points || [];
}

// ── Usage / settings ────────────────────────────────────────────────────

export interface UsageStat {
  signal: string;
  rows: number;
  bytes: number;
  oldest: string;
  newest: string;
  retention_days: number;
}

export async function fetchUsage(): Promise<UsageStat[]> {
  const res = await apiFetch(`${API_BASE}/usage`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: UsageStat[] } = await res.json();
  return data.items || [];
}

// ── Trace analytics ─────────────────────────────────────────────────────

export interface TraceAnalyticsRow {
  group: string;
  trace_count: number;
  avg_ms: number;
  p95_ms: number;
  p99_ms: number;
  error_count: number;
  error_rate: number;
}

export interface TraceAnalyticsPoint {
  timestamp: string;
  group: string;
  value: number;
}

export interface SlowTrace {
  trace_id: string;
  service: string;
  name: string;
  route: string;
  duration_ms: number;
  status: string;
  timestamp: string;
}

export async function fetchTraceAnalytics(params: { groupBy: string; service?: string; minutes?: number }): Promise<TraceAnalyticsRow[]> {
  const search = new URLSearchParams({ group_by: params.groupBy });
  if (params.service) search.set("service", params.service);
  if (params.minutes) search.set("minutes", String(params.minutes));
  const res = await apiFetch(`${API_BASE}/traces/analytics?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: TraceAnalyticsRow[] } = await res.json();
  return data.items || [];
}

export async function fetchTraceAnalyticsTimeseries(params: {
  metric: string;
  groupBy: string;
  service?: string;
  minutes?: number;
  interval?: number;
}): Promise<TraceAnalyticsPoint[]> {
  const search = new URLSearchParams({ metric: params.metric, group_by: params.groupBy });
  if (params.service) search.set("service", params.service);
  if (params.minutes) search.set("minutes", String(params.minutes));
  if (params.interval) search.set("interval", String(params.interval));
  const res = await apiFetch(`${API_BASE}/traces/analytics/timeseries?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { points: TraceAnalyticsPoint[] } = await res.json();
  return data.points || [];
}

export async function fetchSlowestTraces(params?: { service?: string; minutes?: number; limit?: number }): Promise<SlowTrace[]> {
  const search = new URLSearchParams();
  if (params?.service) search.set("service", params.service);
  if (params?.minutes) search.set("minutes", String(params.minutes));
  if (params?.limit) search.set("limit", String(params.limit));
  const res = await apiFetch(`${API_BASE}/traces/slowest?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: SlowTrace[] } = await res.json();
  return data.items || [];
}

// ── Global search ───────────────────────────────────────────────────────

export interface SearchResult {
  type: "trace" | "service" | "log" | "metric" | "exception";
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
}

export async function searchAll(q: string, minutes = 60): Promise<SearchResult[]> {
  const search = new URLSearchParams({ q, minutes: String(minutes) });
  const res = await apiFetch(`${API_BASE}/search?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { results: SearchResult[] } = await res.json();
  return data.results || [];
}

// ── SQL explore ─────────────────────────────────────────────────────────

export interface RawQueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export async function runSQL(query: string): Promise<{ result?: RawQueryResult; error?: string }> {
  const res = await apiFetch(`${API_BASE}/query/sql`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { error: data?.error || `Query failed (${res.status})` };
  return { result: data as RawQueryResult };
}

// ── External calls ──────────────────────────────────────────────────────

export interface ExternalCallSummary {
  host: string;
  call_count: number;
  error_count: number;
  error_rate: number;
  avg_ms: number;
  p95_ms: number;
  last_seen: string;
}

export async function fetchExternalCalls(params?: { service?: string; minutes?: number }): Promise<ExternalCallSummary[]> {
  const search = new URLSearchParams();
  if (params?.minutes) search.set("minutes", String(params.minutes));
  const base = params?.service
    ? `${API_BASE}/services/${encodeURIComponent(params.service)}/external`
    : `${API_BASE}/external`;
  const res = await apiFetch(`${base}?${search}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: ExternalCallSummary[] } = await res.json();
  return data.items || [];
}

export interface ExternalHostOverview {
  host: string;
  call_count: number;
  error_count: number;
  error_rate: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  first_seen: string;
  last_seen: string;
}
export interface ExternalCaller {
  service: string;
  call_count: number;
  error_count: number;
  error_rate: number;
  p95_ms: number;
}
export interface ExternalHostTrace {
  trace_id: string;
  service: string;
  name: string;
  duration_ms: number;
  status: string;
  timestamp: string;
}
export interface ExternalHostDetail {
  overview: ExternalHostOverview;
  callers: ExternalCaller[];
  recent: ExternalHostTrace[];
}

export async function fetchExternalHostDetail(host: string, minutes = 15): Promise<ExternalHostDetail | null> {
  const res = await apiFetch(`${API_BASE}/external/${encodeURIComponent(host)}/detail?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

// ── Logs histogram ──────────────────────────────────────────────────────

export interface LogHistogramPoint {
  timestamp: string;
  level: string;
  count: number;
}

export async function fetchLogsHistogram(params?: {
  level?: string;
  search?: string;
  service?: string;
  traceId?: string;
  start?: string;
  end?: string;
  interval?: number;
}): Promise<LogHistogramPoint[]> {
  const q = new URLSearchParams();
  if (params?.level) q.set("level", params.level);
  if (params?.search) q.set("search", params.search);
  if (params?.service) q.set("service", params.service);
  if (params?.traceId) q.set("trace_id", params.traceId);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);
  if (params?.interval) q.set("interval", String(params.interval));
  const res = await apiFetch(`${API_BASE}/logs/histogram?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { points: LogHistogramPoint[] } = await res.json();
  return data.points || [];
}

// ── Services timeseries ─────────────────────────────────────────────────

export async function fetchServicesTimeseries(minutes = 15, interval = 1, top = 12, environment = ""): Promise<TraceAnalyticsPoint[]> {
  const q = new URLSearchParams({ minutes: String(minutes), interval: String(interval), top: String(top) });
  if (environment) q.set("environment", environment);
  const res = await apiFetch(`${API_BASE}/services/timeseries?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { points: TraceAnalyticsPoint[] } = await res.json();
  return data.points || [];
}

// ── Service dependencies (service map) ──────────────────────────────────

export interface ServiceDependency {
  from_service: string;
  to_service: string;
  calls: number;
  error_count: number;
  error_rate: number;
  avg_ms: number;
  p95_ms: number;
}

export async function fetchServiceDependencies(minutes = 15, environment = ""): Promise<ServiceDependency[]> {
  const q = new URLSearchParams({ minutes: String(minutes) });
  if (environment) q.set("environment", environment);
  const res = await apiFetch(`${API_BASE}/services/dependencies?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: ServiceDependency[] } = await res.json();
  return data.items || [];
}

export interface MetricAttribute {
  key: string;
  value: string;
  count: number;
}

export async function fetchMetricAttributes(name: string, minutes = 60): Promise<MetricAttribute[]> {
  const res = await apiFetch(
    `${API_BASE}/metrics/${encodeURIComponent(name)}/attributes?minutes=${minutes}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return [];
  const data: { items: MetricAttribute[] } = await res.json();
  return data.items || [];
}

// ── Environments ────────────────────────────────────────────────────────

export async function fetchEnvironments(minutes = 1440): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/environments?minutes=${minutes}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data: { items: string[] } = await res.json();
  return data.items || [];
}
