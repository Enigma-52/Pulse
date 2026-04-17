// Mock data for the observability platform

export type Service = {
  id: string;
  name: string;
  language: string;
  rps: number;
  errorRate: number;
  p99: number;
  p50?: number;
  p95?: number;
  apdex?: number;
  instances?: number;
  version?: string;
  owner?: string;
};

export const services: Service[] = [
  { id: "gateway", name: "api-gateway", language: "Go", rps: 1240, errorRate: 0.4, p99: 142, p50: 18, p95: 88, apdex: 0.96, instances: 6, version: "2.14.1", owner: "platform" },
  { id: "auth", name: "auth-service", language: "Node", rps: 820, errorRate: 0.1, p99: 88, p50: 12, p95: 54, apdex: 0.98, instances: 4, version: "1.8.0", owner: "identity" },
  { id: "users", name: "users-service", language: "Go", rps: 612, errorRate: 0.2, p99: 64, p50: 9, p95: 42, apdex: 0.97, instances: 3, version: "3.2.7", owner: "identity" },
  { id: "orders", name: "orders-service", language: "Java", rps: 480, errorRate: 1.8, p99: 312, p50: 42, p95: 184, apdex: 0.84, instances: 5, version: "4.0.2", owner: "commerce" },
  { id: "payments", name: "payments-service", language: "Rust", rps: 318, errorRate: 0.6, p99: 198, p50: 28, p95: 124, apdex: 0.91, instances: 4, version: "2.1.4", owner: "commerce" },
  { id: "inventory", name: "inventory-service", language: "Python", rps: 254, errorRate: 0.3, p99: 124, p50: 22, p95: 78, apdex: 0.94, instances: 3, version: "1.5.0", owner: "commerce" },
  { id: "notifications", name: "notifications", language: "Node", rps: 188, errorRate: 0.0, p99: 56, p50: 8, p95: 32, apdex: 0.99, instances: 2, version: "1.2.1", owner: "growth" },
  { id: "postgres", name: "postgres", language: "DB", rps: 920, errorRate: 0.0, p99: 22, p50: 2, p95: 12, apdex: 0.99, instances: 3, version: "15.4", owner: "platform" },
  { id: "redis", name: "redis", language: "Cache", rps: 1480, errorRate: 0.0, p99: 4, p50: 0.4, p95: 2, apdex: 1.0, instances: 6, version: "7.2", owner: "platform" },
  { id: "kafka", name: "kafka", language: "Stream", rps: 720, errorRate: 0.0, p99: 12, p50: 1, p95: 6, apdex: 0.99, instances: 5, version: "3.6", owner: "platform" },
];

// Edges: source depends on target
export const edges: { from: string; to: string; calls: number; latency: number; errorRate: number }[] = [
  { from: "gateway", to: "auth", calls: 820, latency: 18, errorRate: 0.1 },
  { from: "gateway", to: "users", calls: 612, latency: 22, errorRate: 0.2 },
  { from: "gateway", to: "orders", calls: 480, latency: 64, errorRate: 1.8 },
  { from: "auth", to: "redis", calls: 720, latency: 2, errorRate: 0 },
  { from: "auth", to: "postgres", calls: 280, latency: 12, errorRate: 0 },
  { from: "users", to: "postgres", calls: 580, latency: 14, errorRate: 0 },
  { from: "orders", to: "payments", calls: 312, latency: 84, errorRate: 0.6 },
  { from: "orders", to: "inventory", calls: 254, latency: 36, errorRate: 0.3 },
  { from: "orders", to: "kafka", calls: 480, latency: 6, errorRate: 0 },
  { from: "payments", to: "postgres", calls: 318, latency: 18, errorRate: 0 },
  { from: "inventory", to: "postgres", calls: 254, latency: 16, errorRate: 0 },
  { from: "kafka", to: "notifications", calls: 188, latency: 8, errorRate: 0 },
];

// Node positions for the dependency graph (logical coords 0-1000 x 0-600)
export const nodePositions: Record<string, { x: number; y: number }> = {
  gateway:        { x: 80,  y: 300 },
  auth:           { x: 280, y: 140 },
  users:          { x: 280, y: 300 },
  orders:         { x: 280, y: 460 },
  payments:       { x: 520, y: 380 },
  inventory:      { x: 520, y: 520 },
  kafka:          { x: 520, y: 240 },
  notifications:  { x: 760, y: 180 },
  redis:          { x: 760, y: 60  },
  postgres:       { x: 760, y: 420 },
};

export type Trace = {
  id: string;
  name: string;
  service: string;
  duration: number;
  spans: number;
  status: "ok" | "error";
  timestamp: string;
};

export const traces: Trace[] = [
  { id: "7a3f2c1e9b", name: "POST /api/orders", service: "orders-service", duration: 312, spans: 14, status: "ok", timestamp: "12:42:18.402" },
  { id: "9c1d8e4a2f", name: "GET /api/users/:id", service: "users-service", duration: 68, spans: 6, status: "ok", timestamp: "12:42:18.388" },
  { id: "3e7b9f1c0d", name: "POST /api/payments/charge", service: "payments-service", duration: 1842, spans: 22, status: "error", timestamp: "12:42:17.991" },
  { id: "5f2a8c4b1e", name: "GET /api/inventory", service: "inventory-service", duration: 124, spans: 8, status: "ok", timestamp: "12:42:17.842" },
  { id: "1b6d3e9f7a", name: "POST /api/auth/login", service: "auth-service", duration: 88, spans: 5, status: "ok", timestamp: "12:42:17.621" },
  { id: "8d4c2e1f9b", name: "GET /api/orders/:id", service: "orders-service", duration: 198, spans: 12, status: "ok", timestamp: "12:42:17.402" },
  { id: "2a9e7c5b3d", name: "DELETE /api/users/:id", service: "users-service", duration: 42, spans: 4, status: "ok", timestamp: "12:42:16.998" },
  { id: "6f1b8d3a4e", name: "POST /api/orders", service: "orders-service", duration: 2104, spans: 18, status: "error", timestamp: "12:42:16.612" },
];

export type LogLevel = "info" | "warn" | "error" | "debug";
export type Log = {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  attributes: Record<string, string | number>;
};

export const logs: Log[] = [
  { id: "l1", timestamp: "12:42:18.402", level: "info", service: "orders-service", message: "Order created", trace_id: "7a3f2c1e9b", span_id: "s4", attributes: { order_id: "ord_8821", user_id: "u_4421", total: 89.40 } },
  { id: "l2", timestamp: "12:42:18.398", level: "info", service: "payments-service", message: "Charge initiated", trace_id: "7a3f2c1e9b", span_id: "s7", attributes: { amount: 89.40, currency: "USD" } },
  { id: "l3", timestamp: "12:42:17.991", level: "error", service: "payments-service", message: "Stripe API timeout after 1800ms", trace_id: "3e7b9f1c0d", attributes: { provider: "stripe", retries: 2, status_code: 504 } },
  { id: "l4", timestamp: "12:42:17.842", level: "warn", service: "inventory-service", message: "Stock level below threshold", attributes: { sku: "SKU-21084", remaining: 4, threshold: 10 } },
  { id: "l5", timestamp: "12:42:17.621", level: "info", service: "auth-service", message: "User authenticated", trace_id: "1b6d3e9f7a", attributes: { user_id: "u_4421", method: "password" } },
  { id: "l6", timestamp: "12:42:17.402", level: "debug", service: "users-service", message: "Cache hit for user profile", attributes: { user_id: "u_4421", ttl: 280 } },
  { id: "l7", timestamp: "12:42:16.998", level: "info", service: "users-service", message: "User deleted", attributes: { user_id: "u_9912" } },
  { id: "l8", timestamp: "12:42:16.612", level: "error", service: "orders-service", message: "Database deadlock detected, retrying", trace_id: "6f1b8d3a4e", attributes: { table: "orders", attempt: 3 } },
  { id: "l9", timestamp: "12:42:16.402", level: "info", service: "api-gateway", message: "Rate limit applied", attributes: { client: "203.0.113.42", limit: 1000 } },
  { id: "l10", timestamp: "12:42:16.121", level: "warn", service: "kafka", message: "Consumer lag increasing", attributes: { topic: "orders.events", lag: 1842 } },
];

export type Metric = {
  id: string;
  name: string;
  unit: string;
  value: number;
  delta: number;
  description: string;
};

export const metrics: Metric[] = [
  { id: "http_requests_total", name: "http.requests.total", unit: "req/s", value: 1240, delta: 4.2, description: "Total HTTP requests across all services" },
  { id: "http_request_duration_p99", name: "http.request.duration.p99", unit: "ms", value: 312, delta: -2.1, description: "99th percentile request duration" },
  { id: "http_request_errors", name: "http.request.errors", unit: "err/s", value: 8.4, delta: 12.0, description: "Failed HTTP requests per second" },
  { id: "cpu_utilization", name: "system.cpu.utilization", unit: "%", value: 64, delta: 1.4, description: "Average CPU utilization across nodes" },
  { id: "memory_usage", name: "system.memory.usage", unit: "%", value: 71, delta: 0.8, description: "Memory usage across the cluster" },
  { id: "db_connections", name: "db.connections.active", unit: "conn", value: 142, delta: -5.2, description: "Active database connections" },
  { id: "queue_depth", name: "kafka.consumer.lag", unit: "msg", value: 1842, delta: 22.4, description: "Kafka consumer group lag" },
  { id: "disk_io", name: "system.disk.io", unit: "MB/s", value: 184, delta: -1.1, description: "Disk throughput across nodes" },
];

// Time-series helper
export function genSeries(points = 60, base = 100, variance = 30, seed = 1) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: points }, (_, i) => ({
    t: i,
    value: Math.max(0, base + (rand() - 0.5) * variance + Math.sin(i / 6) * variance * 0.3),
  }));
}

// Spans for trace detail — richer data
export type SpanKind = "server" | "client" | "internal" | "producer" | "consumer";
export type Span = {
  id: string;
  parentId: string | null;
  name: string;
  service: string;
  kind: SpanKind;
  start: number; // ms from trace start
  duration: number;
  status: "ok" | "error";
  depth: number;
  attributes: Record<string, string | number | boolean>;
  events?: { time: number; name: string; attrs?: Record<string, string | number> }[];
};

export const traceSpans: Span[] = [
  {
    id: "s1", parentId: null, name: "POST /api/orders", service: "api-gateway", kind: "server",
    start: 0, duration: 312, status: "ok", depth: 0,
    attributes: { "http.method": "POST", "http.route": "/api/orders", "http.status_code": 200, "http.user_agent": "curl/8.4.0", "net.peer.ip": "203.0.113.42" },
    events: [{ time: 0, name: "request.received" }, { time: 310, name: "response.sent" }],
  },
  {
    id: "s2", parentId: "s1", name: "auth.verify_token", service: "auth-service", kind: "client",
    start: 4, duration: 18, status: "ok", depth: 1,
    attributes: { "rpc.system": "grpc", "rpc.method": "VerifyToken", "user.id": "u_4421" },
  },
  {
    id: "s3", parentId: "s2", name: "redis.get", service: "redis", kind: "client",
    start: 6, duration: 2, status: "ok", depth: 2,
    attributes: { "db.system": "redis", "db.operation": "GET", "db.statement": "GET session:u_4421" },
  },
  {
    id: "s4", parentId: "s1", name: "orders.create", service: "orders-service", kind: "internal",
    start: 24, duration: 280, status: "ok", depth: 1,
    attributes: { "order.id": "ord_8821", "order.total": 89.40, "order.items": 3 },
    events: [{ time: 28, name: "validation.passed" }, { time: 300, name: "order.persisted" }],
  },
  {
    id: "s5", parentId: "s4", name: "inventory.reserve", service: "inventory-service", kind: "client",
    start: 32, duration: 36, status: "ok", depth: 2,
    attributes: { "inventory.sku": "SKU-21084", "inventory.qty": 3 },
  },
  {
    id: "s6", parentId: "s5", name: "postgres.update", service: "postgres", kind: "client",
    start: 40, duration: 16, status: "ok", depth: 3,
    attributes: { "db.system": "postgresql", "db.name": "inventory", "db.statement": "UPDATE stock SET qty = qty - $1 WHERE sku = $2" },
  },
  {
    id: "s7", parentId: "s4", name: "payments.charge", service: "payments-service", kind: "client",
    start: 72, duration: 184, status: "ok", depth: 2,
    attributes: { "payment.provider": "stripe", "payment.amount": 89.40, "payment.currency": "USD" },
  },
  {
    id: "s8", parentId: "s7", name: "stripe.api.call", service: "payments-service", kind: "client",
    start: 80, duration: 162, status: "ok", depth: 3,
    attributes: { "http.method": "POST", "http.url": "https://api.stripe.com/v1/charges", "http.status_code": 200 },
    events: [{ time: 80, name: "request.start" }, { time: 240, name: "response.received" }],
  },
  {
    id: "s9", parentId: "s4", name: "postgres.insert", service: "postgres", kind: "client",
    start: 258, duration: 18, status: "ok", depth: 2,
    attributes: { "db.system": "postgresql", "db.name": "orders", "db.statement": "INSERT INTO orders (...) VALUES (...)" },
  },
  {
    id: "s10", parentId: "s4", name: "kafka.publish", service: "kafka", kind: "producer",
    start: 282, duration: 6, status: "ok", depth: 2,
    attributes: { "messaging.system": "kafka", "messaging.destination": "orders.events", "messaging.message_id": "msg_4821" },
  },
  {
    id: "s11", parentId: "s10", name: "notifications.send", service: "notifications", kind: "consumer",
    start: 290, duration: 8, status: "ok", depth: 3,
    attributes: { "messaging.system": "kafka", "notification.channel": "email", "notification.template": "order_confirmation" },
  },
];
