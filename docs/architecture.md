## Architecture

### High-level data flow

App (OTel SDK) → Pulse (OTLP/HTTP, port 4321) → in-process pipeline → ClickHouse → Pulse query API → Web UI

Pulse is a single Go binary that handles ingestion, processing, and querying. The only external dependency is ClickHouse.

### Instrumentation (any language via OpenTelemetry)

Pulse accepts standard OTLP/HTTP telemetry. No custom SDK is needed — use any OpenTelemetry SDK:

- Node.js: `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`
- Python: `opentelemetry-sdk` + `opentelemetry-exporter-otlp-proto-http`
- Go: `go.opentelemetry.io/otel` + `go.opentelemetry.io/otel/exporters/otlp/otlptracehttp`
- Java, Ruby, .NET, etc.: any OTel SDK with OTLP HTTP exporter

Configure the exporter URL to point at `http://<pulse-host>:4321/v1/traces` (and `/v1/logs`, `/v1/metrics`).

### Single binary internals

```
pulse/
  cmd/pulse/main.go       # starts everything
  internal/
    ingest/               # OTLP HTTP receiver (protobuf + JSON)
    writer/               # ClickHouse writer (parses OTLP proto, inserts)
    query/                # query API (handlers, store, model)
    pipeline/             # in-process channel connecting ingest → writer
    config/               # unified configuration
    server/               # unified HTTP router
```

**Pipeline**: The `pipeline` package replaces Kafka/Redpanda with a buffered Go channel:

```go
events := make(chan Batch, 10000)
```

- Ingest handler pushes OTLP protobuf batches onto the channel
- Writer goroutine drains the channel and writes to ClickHouse
- If the channel is full, ingest returns HTTP 429 (backpressure)

### Durability note

In-process channel means buffered events are lost on crash. Acceptable for v1 — add a WAL later if users raise it.

### Storage — ClickHouse

ClickHouse tables store all telemetry with full OTLP fidelity:

- `traces` — spans with resource attributes, scope info, links, events
- `logs` — log records with severity, attributes, resource attributes
- `metrics` — gauge, sum, histogram, summary data points

Each table includes `resource_attributes_json`, `scope_name`, `scope_version` for full OTLP context.

Why ClickHouse:

- Columnar storage with fast group-by and aggregations
- Cost-effective for large time-series datasets
- Well-suited to high-cardinality telemetry workloads

### Trace analytics

`GET /traces/analytics?group_by=service|route|name` aggregates spans per group (count, avg, p95, p99, error rate). `GET /traces/analytics/timeseries?metric=count|p95|error_rate&group_by=...&interval=...` returns bucketed series for the top-8 groups by volume. `GET /traces/slowest` lists top-N slowest root spans. `group_by` and `metric` are validated against whitelists — user input is never interpolated into SQL.

### Query API and web UI

- The query API (served on the same port) exposes endpoints for traces, logs, metrics, services, and dashboard summaries
- JWT auth with setup/login flow
- The dashboard UI is a separate React SPA that talks to the query API

### Exception monitoring

OTel SDKs record exceptions as span events named `exception` (attributes `exception.type`, `exception.message`, `exception.stacktrace`). The writer extracts these at write time into a dedicated `exceptions` MergeTree table (`ORDER BY (service, fingerprint, timestamp)`) so grouping never scans `events_json`.

- **Fingerprint** = `sha1(type + normalized_message + top_stack_frame)`; digits, hex addresses, and UUIDs in the message are masked so variable payloads ("timeout after 31ms" vs "88ms") group together.
- Write-time extraction means exceptions ingested before this feature are not backfilled.
- Query API: `GET /exceptions` (grouped), `GET /exceptions/{fingerprint}` (detail + recent trace ids), `GET /exceptions/{fingerprint}/timeseries`.

### Alerting

A background evaluator goroutine inside the pulse binary evaluates enabled alert rules on a fixed interval (default 30s, `PULSE_ALERT_EVAL_INTERVAL_SECONDS`, 0 disables):

```
pulse_alert_rules → evaluator (aggregation SQL per rule over trailing window)
                  → in-memory state map (ruleID|service)
                  → transitions recorded in pulse_alerts (firing / resolved)
                  → notifiers (Slack webhook, generic webhook; email stored but not delivered)
```

- Rules target one signal (`traces`, `logs`, `metrics`) with an aggregation (count, avg, p95, p99, error_rate, error_count, value_avg, value_max), operator, threshold, and window. Rules can filter to one service or evaluate per-service (`group_by_service`).
- Storage: `pulse_alert_rules`, `pulse_alerts`, and `pulse_notification_channels` are ClickHouse `ReplacingMergeTree(updated_at)` tables keyed by id — updates insert a new version row, deletes set a `deleted` flag, reads use `FINAL`.
- Transition dedup: while a rule instance stays breaching there is no re-notification; resolution re-inserts the same alert id with status `resolved`.
- Restart caveat: evaluator state is in-memory only. After a restart, a still-breaching rule re-fires as a new alert (a fresh row), which is acceptable for v1.

### Configuration

All configuration is via environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PULSE_ADDR` | `:4321` | Listen address (OTLP ingest + query API) |
| `PULSE_CLICKHOUSE_ADDR` | `localhost:9000` | ClickHouse native endpoint |
| `PULSE_CLICKHOUSE_DB` | `default` | ClickHouse database |
| `PULSE_CLICKHOUSE_USER` | `default` | ClickHouse user |
| `PULSE_CLICKHOUSE_PASSWORD` | (empty) | ClickHouse password |
| `PULSE_JWT_SECRET` | insecure built-in | Secret for dashboard auth tokens — always set in production |
| `PULSE_PIPELINE_CAP` | `10000` | In-process pipeline buffer capacity |
| `PULSE_INGEST_RPS` | `0` (unlimited) | Max OTLP ingest requests/sec (token bucket, 429 when exceeded) |
| `PULSE_ALERT_EVAL_INTERVAL_SECONDS` | `30` | Alert rule evaluation interval; `0` disables the evaluator |
| `PULSE_RETENTION_TRACES_DAYS` | `0` (forever) | TTL retention for the `traces` table, in days |
| `PULSE_RETENTION_LOGS_DAYS` | `0` (forever) | TTL retention for the `logs` table, in days |
| `PULSE_RETENTION_METRICS_DAYS` | `0` (forever) | TTL retention for the `metrics` table, in days |
| `PULSE_RETENTION_EXCEPTIONS_DAYS` | `0` (forever) | TTL retention for the `exceptions` table, in days |

### Health and readiness

- `GET /healthz` — liveness: the process is up (never touches ClickHouse)
- `GET /readyz` — readiness: pings ClickHouse; returns 503 until the database is reachable

Point orchestrator liveness probes at `/healthz` and readiness probes at `/readyz`.

### Deployment

Two containers: `pulse` + `clickhouse`. That's the entire stack.

```yaml
services:
  pulse:
    ports: ["4321:4321"]
  clickhouse:
    ports: ["9000:9000"]
```
