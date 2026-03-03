## Architecture

### High-level data flow

The core Pulse data flow is:

App (SDK) → Ingestion Server → Kafka → Background Worker / Stream Processor → ClickHouse → API Layer → Web UI

At each stage, Pulse transforms and enriches telemetry so that it remains useful for both real-time debugging and historical analysis.

### SDKs (Node / Python / Go)

SDK responsibilities:

- Capture:
  - Traces (spans, durations, parent-child relationships).
  - Metrics (counters, histograms).
  - Logs (structured JSON).
- Attach context:
  - Service name.
  - Environment.
  - Version.
  - Tags.
- Transport:
  - Batch and send asynchronously.
  - Retry with backoff.
  - Authenticate via API key header.

Export format:

- Use an OpenTelemetry-compatible schema internally, even if not full OTLP, to keep interoperability options open.

Deliverables:

- `@pulse/node`
- `pulse-python`
- `pulse-go`

### API key and project model

API key requirements:

- Per-project API keys.
- Server verifies:
  - Project ID.
  - API key validity.
  - Rate limits per key.
  - Key rotation.

Core database tables:

- `projects`
- `api_keys`
- `services`

### Ingestion server

Responsibilities:

- Accept batched telemetry payloads from SDKs.
- Validate request and event schemas strictly.
- Enrich events with:
  - `server_received_at`.
  - `project_id`.
- Push events onto Kafka topics.

Operational considerations:

- Stateless and horizontally scalable.
- Strict input validation and fail-fast behavior to protect downstream systems.

### Kafka layer

Used for:

- Decoupling ingestion from storage.
- Handling backpressure and traffic spikes gracefully.
- Powering stream-based anomaly detection in later phases.

Topics:

- `traces`
- `metrics`
- `logs`

### Background worker / stream processor

Responsibilities:

- Consume messages from Kafka.
- Parse and validate messages.
- Transform events into ClickHouse table schemas.
- Write in bulk to ClickHouse.
- Handle retries and dead-letter queues for poison messages.

Optional enhancements:

- Pre-aggregation of metrics.
- Metrics rollups (for example, 1m and 5m buckets) to accelerate aggregate queries.

### Storage – ClickHouse

ClickHouse table design:

- `traces`
  - `trace_id`
  - `span_id`
  - `parent_span_id`
  - `service`
  - `route`
  - `duration_ms`
  - `status`
  - `error`
  - `tags` (JSON)
  - `timestamp`

- `metrics`
  - `service`
  - `metric_name`
  - `value`
  - `tags`
  - `timestamp`

- `logs`
  - `service`
  - `level`
  - `message`
  - `tags`
  - `timestamp`

Why ClickHouse:

- Columnar storage.
- Fast group-by and aggregations.
- Cost-effective storage for large time-series datasets.
- Well-suited to high-cardinality telemetry workloads.

### API layer and web UI

- The API layer exposes query endpoints over traces, metrics, and logs, translating high-level filters and aggregations into ClickHouse SQL.
- The web UI is the primary interface for:
  - Building and running queries.
  - Exploring traces.
  - Inspecting spans and related logs/metrics.

For a deeper product-level overview of how this architecture supports observability workflows, see [`overview.md`](overview.md). For feature-centric documentation and the MVP roadmap, see [`features.md`](features.md) and [`mvp-scope.md`](mvp-scope.md).

