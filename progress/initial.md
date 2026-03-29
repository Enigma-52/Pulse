# Pulse — Initial Progress Snapshot
*Captured: 2026-03-30*

## Project Summary

Pulse is a lightweight, developer-first observability platform for early-stage teams. It provides production-grade traces, metrics, and logs without operational complexity. Built as a monorepo with Go microservices, a TypeScript SDK, a React UI, and a Kafka + ClickHouse data pipeline.

---

## Architecture Overview

```
Application Code (with @pulse/node SDK)
    ↓
PulseClient batches spans/logs in memory
    ↓
HTTP POST → Ingestion Service (port 8081) /v1/ingest
    ↓
Kafka topic: traces_raw
    ↓
Worker Service (consumer) → ClickHouse traces table
    ↓
Query API (port 8082) /traces
    ↓
React Web UI (port 5173) [placeholder shell]
```

**Infrastructure**: Docker Compose — Zookeeper, Kafka, ClickHouse

---

## What Has Been Built

### ✅ Ingestion Service (`/services/ingestion`)
- Go HTTP server on port 8081
- `POST /v1/ingest` — accepts batched telemetry envelopes (spans + logs as JSON)
- Validates required fields: `serviceName`, `environment`
- Publishes raw payloads to Kafka topic `traces_raw`
- Returns HTTP 202 on success
- Deps: `gorilla/mux`, `segmentio/kafka-go`

### ✅ Worker Service (`/services/worker`)
- Go Kafka consumer
- Auto-creates `traces` ClickHouse table on startup
- Table schema: `trace_id`, `span_id`, `parent_span_id`, `service`, `environment`, `route`, `name`, `duration_ms`, `status`, `error`, `start_time`, `end_time`, `attributes_json`
- Parses JSON envelopes from Kafka and batch inserts into ClickHouse
- Deps: `clickhouse-go/v2`, `segmentio/kafka-go`

### ✅ Query API (`/services/query-api`)
- Go HTTP server on port 8082
- `GET /healthz` — health check
- `GET /traces` — returns last 100 traces ordered by recency
- Queries ClickHouse, returns JSON: `trace_id`, `service`, `route`, `duration_ms`, `status`, `timestamp`
- Deps: `clickhouse-go/v2`, `gorilla/mux`

### ✅ Node.js SDK (`/sdk/node`)
- TypeScript 5.6, Node 18+, compiled to `/dist`
- `PulseClient` class: configurable `ingestUrl`, `apiKey`, `serviceName`, `environment`
- Auto-batching: 2s flush interval, batch size 100, max queue 1000
- `startSpan()` / `withSpan()` for manual and async tracing
- Span tracking: IDs, parent-child hierarchy, timing, status (`ok`/`error`), custom attributes
- `log(level, message, fields, context)` — structured logging with trace correlation
- `flush()` / `shutdown()` for lifecycle management
- Express middleware: auto-wraps requests in spans, attaches `req.pulseTraceId`/`req.pulseSpanId`
- Transport: batched HTTP POST with `x-pulse-api-key` header, `keepalive: true`

### ✅ Demo Backend (`/demo/backend-node`)
- Express app wired with Pulse SDK
- `GET /ok` — fast 200 (success traces)
- `GET /slow` — 100–800ms random delay (latency traces)
- `GET /error` — 50% error rate (error traces + logs)
- Uses Express middleware + manual `withSpan()` and `log()` calls

### 🟡 Web UI (`/ui/web`)
- React 18 + Vite 5 + TypeScript — skeleton only
- Header with "Pulse" branding
- Static placeholder text — no real trace data rendered
- No querying, filtering, or trace detail views yet

### ✅ Infrastructure (`/infra/docker-compose.yml`)
- **Zookeeper** (cp-zookeeper:7.5.0) — port 2181
- **Kafka** (cp-kafka:7.5.0) — ports 9092/29092, auto topic creation on
- **ClickHouse** (clickhouse-server:24.3) — ports 8123/9000, persistent volume

---

## Documentation (`/docs`)

| File | Contents |
|------|----------|
| `overview.md` | High-level positioning, value props, architecture overview |
| `architecture.md` | Component breakdown, data flow, ClickHouse schema, design rationale |
| `features.md` | Query builder, trace search, anomaly detection roadmap |
| `mvp-scope.md` | Phase 1–3 roadmap |
| `local-dev.md` | Step-by-step local setup and pipeline verification |
| `sdk-node.md` | Node SDK quickstart: init, middleware, spans, logging |
| `demo-backend-node.md` | Demo backend setup, routes, env vars |

---

## Phase Status

### Phase 1 — Core Tracing ✅ Complete
- [x] Node SDK (`@pulse/node`)
- [x] Ingestion server (Kafka publish)
- [x] Kafka pipeline
- [x] ClickHouse storage (table + inserts)
- [x] Basic query API (last 100 traces)
- [x] Demo backend with realistic traces
- [x] Docker Compose local stack
- [x] Full documentation

### Phase 2 — Metrics + Query Builder + Anomaly Detection ⏳ Not started
- [ ] Metrics ingestion pipeline
- [ ] Query builder UI (filter by service, route, duration, status, tags)
- [ ] Trace detail view + span hierarchy visualization
- [ ] Spike/anomaly detection

### Phase 3 — Multi-language SDKs + Alerting ⏳ Not started
- [ ] Python SDK
- [ ] Go SDK
- [ ] Webhook alerting
- [ ] Hosted/cloud option

---

## Known Gaps

| Area | Gap |
|------|-----|
| UI | Placeholder only — no functional trace querying |
| Query API | No filtering, aggregation, or pagination beyond last 100 |
| Auth | API key model exists but no real validation |
| Metrics | No metrics ingestion or storage |
| Error resilience | SDK silently swallows network errors; no dead-letter queue |
| SDKs | Python and Go SDKs not yet built |
| Alerting | No anomaly detection or notifications |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend services | Go 1.22–1.24 |
| Message queue | Apache Kafka 7.5 + Zookeeper |
| Database | ClickHouse 24.3 (OLAP, time-series) |
| HTTP router | Gorilla Mux |
| SDK | TypeScript 5.6, Node 18+ |
| UI | React 18.3, Vite 5, TypeScript |
| Package management | npm workspaces (monorepo) |
| Local infra | Docker Compose |
