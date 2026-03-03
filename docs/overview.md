## Pulse observability platform overview

Pulse is a lightweight, developer-first observability platform that unifies traces, metrics, and logs into a single, focused experience. It is designed for teams who want production-grade visibility without the operational burden of running and tuning a sprawling observability stack.

Instead of stitching together separate tracing, metrics, and logging systems, Pulse gives you a coherent pipeline and UI out of the box. You instrument your services with simple SDKs, send telemetry to a streamlined ingestion layer, and query it through a ClickHouse-backed API and web UI that are optimized for day-to-day debugging and performance work.

### Problems Pulse is built to solve

- **Slow, noisy incident debugging**: Traditional tools often scatter information across logs, metrics dashboards, and tracing UIs. Pulse pulls these signals together around requests, services, and routes so you can answer “what went wrong?” and “where is this slow?” quickly.
- **Heavy infra overhead**: Complex observability stacks require specialized infra teams, long tuning cycles, and significant resource spend. Pulse aims for a Compose-first, local-first deployment model that keeps the moving parts to a minimum.
- **High activation energy**: Many observability platforms feel powerful but overwhelming. Pulse focuses on a small, sharp feature set and a query & trace UI that developers can understand in minutes.

Primary personas:

- Founding or early engineers who need real observability but don’t want to become observability vendors.
- Infra/platform engineers at small teams who want a standard way to instrument services and centralize telemetry.
- Full-stack developers who are on the hook for uptime and performance but don’t have time to run bespoke observability infra.

### Core value propositions

- **Unified telemetry model**: Traces, metrics, and logs are captured via consistent SDKs and stored in schemas designed to work together. You can move from a high-level metric spike down to specific traces and spans without leaving the platform.
- **Fast local and on-prem deployment**: A standard Docker Compose setup brings up ingestion, processing, storage, API, and UI in one step, making it easy to run Pulse on your laptop or inside your own infrastructure boundary.
- **Opinionated, minimal feature set**: Pulse focuses on the workflows that matter most early on: understanding latency, error rates, and request flows, plus building a clean foundation for anomaly detection and alerting.
- **Developer-first UX**: The UI is designed for people who live in code — fast search, intuitive filters, and views that map closely to services, routes, and spans rather than abstract dashboards.

### How the observability pipeline works

At a high level, Pulse’s data flow looks like this:

- Your application code uses Pulse SDKs (Node, Python, Go) to capture spans, metrics, and structured logs.
- The SDKs batch data and send it asynchronously to the ingestion server with per-project API keys.
- The ingestion server validates and enriches payloads, then publishes them onto Kafka topics for traces, metrics, and logs.
- Background workers consume these topics, transform events into ClickHouse schemas, and write in bulk with retries and dead-letter handling.
- The API layer exposes query endpoints used by the web UI and (optionally) programmatic clients.

This architecture lets Pulse handle bursts of telemetry gracefully, decouple ingestion from storage, and keep query latencies low even as data volume grows.

### Technical architecture (high level)

- **SDKs (Node / Python / Go)**: Capture traces (spans, parent-child relationships, durations), metrics (counters, histograms), and structured JSON logs. Attach service name, environment, version, and arbitrary tags, and export using an OpenTelemetry-compatible schema internally.
- **Ingestion server**: Stateless HTTP service that accepts batched payloads, validates schemas, enriches them with `server_received_at` and `project_id`, and pushes events to Kafka. Horizontally scalable behind a load balancer.
- **Kafka + stream processing**: Kafka topics (`traces`, `metrics`, `logs`) decouple ingestion from storage, absorb backpressure, and provide the foundation for streaming anomaly detection.
- **Background workers**: Kafka consumers that parse messages, transform them into ClickHouse row formats, and write in bulk. They handle retries, dead letters, and optional pre-aggregation/rollups (for example 1m/5m metric buckets).
- **ClickHouse storage**: Columnar, time-series-friendly database with dedicated tables for traces, metrics, and logs. This enables fast group-bys and aggregations across large telemetry windows.
- **API layer & web UI**: A query API that translates filters and aggregations into ClickHouse SQL, and a web UI that presents query builder, trace search, and span visualizations for day-to-day debugging and performance analysis.

### Why this architecture matters for observability

- **End-to-end request understanding**: Trace spans let you see how a single request fans out across services and where it slows down. Metrics and logs enrich that view with aggregate behavior and contextual details.
- **Low-latency analytics**: ClickHouse plus bulk writes from workers provide fast, cost-effective analytics over time-series telemetry, making high-cardinality queries (by service, route, tag, error status) practical.
- **Resilient ingestion**: Kafka decouples producers from consumers so telemetry is not lost during short outages or downstream slowdowns, which is critical when observability is itself a critical dependency.

### Differentiation and positioning

Pulse is intentionally narrower than full-blown observability suites:

- Compared to tools like Better Stack, Pulse emphasizes a **Compose-first, local-first** story and a tighter coupling between traces, metrics, and logs.
- Compared to open-source options like SigNoz, Pulse leans into a more **opinionated, simplified** deployment and configuration model optimized for small teams.

The result is an observability platform that is:

- Easier to stand up on a laptop or a single VM.
- Focused on the 80% of workflows early-stage teams actually use.
- Ready to grow into more advanced capabilities (anomaly detection, alerting, hosted offerings) without requiring a re-architecture.

For detailed component-level architecture, see [`architecture.md`](architecture.md). For specific feature descriptions and the MVP roadmap, see [`features.md`](features.md) and [`mvp-scope.md`](mvp-scope.md).

