# Pulse TODO (Project-Wide)

Updated: 2026-06-25

## What Pulse Has Today

### Backend
- Single `pulse` binary on port 4321: OTLP ingest + in-process pipeline + ClickHouse writer + query API
- OTLP/HTTP endpoints: /v1/traces, /v1/logs, /v1/metrics (protobuf + JSON)
- In-process buffered channel replaces Kafka/Redpanda (backpressure via 429)
- ClickHouse storage with full OTLP fidelity (resource attrs, scope, links)
- Query API with endpoints: traces, trace detail, logs, metrics, metric series, metrics query, services list, service overview, dashboard summary
- JWT auth with setup/login flow
- Time-range filtering across all query endpoints

### Frontend (dashboard)
- Dashboard with live stats, request volume chart, recent traces
- Traces page with service graph, duration histogram, service/status filters
- Trace detail with flamegraph, waterfall, service breakdown, linked logs
- Logs page with stream/grouped views, expandable rows, level filters, search
- Log detail page with attributes and linked traces
- Metrics page with queryable metrics input and metric cards
- Metric detail with time-series chart
- Services list page with per-service stats table
- Time range selector on all pages (5m/15m/1h/6h/24h/7d)
- Auto-refresh toggle on dashboard, traces, logs, services

### Instrumentation
- OTLP/HTTP ingestion (protobuf + JSON) — works with any OpenTelemetry SDK (Node, Python, Go, Java, etc.)
- No custom SDK needed — standard OTel exporters point at Pulse

---

## Missing Features vs SigNoz

Organized by priority. Each section lists what SigNoz has that Pulse does not.

### P0 — Core Gaps (blocks production use)

#### Alerting System
- [x] Alert rule engine (threshold-based on metrics, logs, traces)
- [ ] Multi-condition alert rules
- [x] Alert evaluation loop (background worker, 30s ticker, in-process)
- [x] Alert history and status tracking (firing/resolved in pulse_alerts)
- [ ] Alert silencing and grouping
- [x] Notification integrations: Slack webhook, generic webhook (email config stored, delivery not implemented; PagerDuty open)
- [ ] Alert routing / notification policies
- [x] UI: alert rule CRUD, alert list, alert detail (test rule open)

#### Exception Monitoring
SigNoz auto-captures and groups exceptions. Pulse does not track exceptions as a concept.
- [ ] Exception capture in SDK (catch + report with stack trace)
- [ ] Exception grouping by fingerprint (message + stack frame)
- [ ] Exceptions table in ClickHouse
- [ ] Exceptions query API endpoints
- [ ] Exceptions UI: list, detail, frequency chart, linked traces/logs
- [ ] SDK support: JavaScript, Python, Java, Ruby

#### Data Retention and Management
- [ ] Configurable retention policies per signal (traces, logs, metrics)
- [ ] TTL-based ClickHouse table cleanup
- [ ] Data volume / usage dashboard

### P1 — Important Gaps (needed for serious adoption)

#### Custom Dashboards
Pulse has fixed pages. SigNoz lets users build custom dashboards.
- [ ] Dashboard builder with drag-and-drop panels
- [ ] Panel types: time-series, bar, pie, table, single stat, heatmap
- [ ] Multiple queries per panel
- [ ] Dashboard variables / template variables
- [ ] Dashboard save, share, import/export
- [ ] Pre-built dashboards (host metrics, Kubernetes, database)

#### Infrastructure Monitoring
Pulse monitors applications only. SigNoz also monitors infrastructure.
- [ ] Host metrics collection (CPU, memory, disk, network)
- [ ] Host metrics agent or collector
- [ ] Kubernetes metrics (pod, node, deployment, namespace)
- [ ] Container metrics (Docker stats)
- [ ] Infrastructure dashboards
- [ ] Host map / topology view

#### OpenTelemetry Collector Compatibility
- [x] OTLP/HTTP receiver endpoint on ingestion service
- [x] Accept standard OTel resource attributes
- [ ] OTLP/gRPC receiver endpoint on ingestion service
- [ ] Support OTel Collector as a data forwarder
- [ ] Semantic convention mapping for attributes

#### Trace Aggregation and Analytics
SigNoz has trace analytics beyond listing.
- [ ] Trace aggregation queries (group by service, operation; aggregate by count, avg, p99)
- [ ] Trace analytics charts (e.g. error rate by service over time)
- [ ] Slow trace identification / top-N slowest
- [ ] Cross-service latency breakdown visualization

#### Database Monitoring
SigNoz monitors database performance directly. Pulse has no database-specific observability.
Supported databases in SigNoz: PostgreSQL, MySQL, MongoDB, Redis, ClickHouse.
- [x] Database span detection and categorization (identify db calls from trace attributes)
- [x] Database query latency tracking and slow query highlighting
- [x] Query throughput and error rate dashboards
- [ ] Connection count monitoring
- [x] Slow query list with linked traces
- [x] Per-database breakdown (latency, throughput, errors)
- [ ] SDK helpers for annotating database spans (db.system, db.statement, db.name)

#### Querying and Analytics
SigNoz has a powerful flexible query engine. Pulse has basic text search and fixed metric queries.
- [ ] Visual query builder with aggregation, group-by, filters
- [ ] PromQL support for metric queries
- [ ] ClickHouse SQL pass-through for advanced users
- [ ] Formula-based derived metrics (rate, ratio, arithmetic between queries)
- [ ] Time comparisons (compare current window to previous period)
- [ ] Multi-query panels (overlay multiple series)
- [ ] Ad hoc analysis mode (explore without saving)
- [ ] High-cardinality querying (efficient filtering on high-unique-value fields)
- [ ] Saved queries and query history

#### Correlated Observability
SigNoz's strongest capability — seamless navigation between all signals. Pulse has basic trace-log linking only.
- [ ] Trace → Logs (view logs emitted during a trace, already partial)
- [ ] Trace → Metrics (jump from a slow trace to related metric charts)
- [ ] Exception → Trace (click from exception to originating trace)
- [ ] Log → Trace (click from log entry to parent trace, already partial)
- [ ] Service → Traces (view all traces for a service, already partial)
- [ ] Endpoint → Metrics (view latency/error metrics for a specific route)
- [ ] Metric → Trace exemplars (click a metric data point to see example traces)
- [ ] Unified cross-signal search (single search bar across traces, logs, metrics)

#### LLM / AI Observability
SigNoz has dedicated AI/LLM monitoring. Pulse has no AI-specific features.
- [ ] LLM request tracing (instrument calls to OpenAI, Anthropic, etc.)
- [ ] Prompt and response tracking with content capture
- [ ] Token usage monitoring (input/output/total tokens per request)
- [ ] LLM call latency monitoring
- [ ] Cost tracking (estimate cost per request based on model + token count)
- [ ] AI workflow tracing (chain of LLM calls, tool use, retrieval steps)
- [ ] AI error monitoring (rate limits, timeouts, content filter blocks)
- [ ] Model performance insights (latency/cost/error comparison across models)
- [ ] SDK helpers for instrumenting LLM calls (auto-wrap popular SDKs)

### P2 — Nice to Have (polish and completeness)

#### Log Management Enhancements
- [ ] Log parsing rules (grok, regex, JSON auto-parse)
- [ ] Field extraction and indexing
- [ ] Log-to-metric conversion (e.g. count errors matching pattern)
- [ ] Log analytics / aggregation charts
- [ ] Saved log queries / views
- [ ] High-cardinality field indexing

#### Metrics Enhancements
- [ ] Prometheus remote write receiver
- [ ] PromQL-compatible query language
- [ ] Histogram visualization (heatmaps)
- [ ] Label-based filtering in UI
- [ ] Multi-dimensional metric exploration
- [ ] Metric-to-trace exemplar linking

#### APM Enhancements
- [ ] External API call monitoring (outbound HTTP latency/errors)
- [ ] Deployment comparison (before/after release markers)
- [ ] Release markers on charts
- [ ] Performance regression detection (baseline comparison)
- [ ] Apdex score calculation from real data
- [ ] Historical trend analysis

#### Multi-Language Support
Pulse accepts OTLP/HTTP — all languages with an OTel SDK work out of the box.
- [x] Accept OTel SDK data via OTLP endpoints (covers all languages)
- [ ] Browser/frontend SDK (RUM)

#### Deployment and Operations
- [ ] Helm chart for Kubernetes deployment
- [ ] Terraform modules
- [ ] Horizontal scaling guide (multi-replica ingestion/worker)
- [ ] Backup and restore procedures
- [ ] Upgrade migration scripts

#### Team and Access
- [ ] Multi-user with roles (admin, editor, viewer)
- [ ] Team/org model
- [ ] SSO / OIDC integration
- [ ] API key management UI (create, revoke, scope)

---

## Previously Tracked Items

### P0 - Core backend correctness
- [ ] Implement API key validation in ingestion
- [ ] Add project/service binding and reject unauthorized telemetry
- [ ] Define envelope schema versioning and strict validation rules
- [ ] Standardize error response model across services

### P1 - Reliability and operations
- [ ] Add DLQ topic and poison-message handling strategy
- [ ] Add worker retry/backoff policy with observability
- [ ] Add internal service metrics and structured logs
- [ ] Add readiness checks for redpanda/clickhouse dependencies

### P2 - Developer experience
- [ ] Refresh docs to match current runtime wiring
- [ ] Add end-to-end smoke test script (ingest -> query assertion)
- [ ] Add CI checks for Go services and frontend builds
