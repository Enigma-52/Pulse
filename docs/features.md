## Features

### Query builder UI

Pulse includes a query builder UI for quickly exploring telemetry:

- Filter by:
  - Service.
  - Route.
  - Duration thresholds (for example, `duration > X`).
  - Error status.
  - Tags.
- Time range selection for narrowing analysis windows.
- Aggregations such as:
  - Average duration.
  - p95 latency.
  - Error rate.

Internally, the query builder translates UI filters into a ClickHouse SQL query via the API layer, so queries remain flexible while the UI stays approachable.

### Trace search and visualization

Trace search is central to Pulse:

- Search by:
  - `trace_id`.
  - Route.
  - Duration range.
  - Tag.
  - Error status.
- Sort by:
  - Duration.
  - Timestamp.

Trace detail view:

- Tree visualization of the span hierarchy.
- Span breakdown with timing, status, and tags.
- Context to pivot into related logs or metrics where applicable.

### Anomaly detection (Phase 2 and beyond)

Anomaly detection begins simply and evolves over time:

- Version 1:
  - Moving average baselines over key metrics (for example, p95 latency, error rate).
  - Detection of:
    - Sudden spikes in p95.
    - Error rate spikes.
- Later iterations:
  - Z-score-based detection.
  - Seasonal models.
  - Optional techniques like isolation forests.

Alerting and surfacing:

- UI badges and indicators near affected services/routes.
- Webhooks or similar mechanisms to integrate with external alerting systems.

### Deployment options

One-step deployment is a core design goal:

- **MVP**:
  - Docker Compose stack including:
    - Ingestion.
    - API.
    - Kafka.
    - ClickHouse.
    - Background worker(s).
    - Web UI.
- **Later**:
  - Helm chart for Kubernetes.
  - Terraform modules for common infrastructures.

This lets early teams start with a Compose file and grow into more formal infrastructure as needed, without re-architecting Pulse.

### Demo backend and frontend

To make it easy to try Pulse end-to-end, the project includes demo applications:

- **Demo backend**:
  - Example Express (or similar) app.
  - A few routes with random latency and error injection.
  - Generates realistic traces and metrics for exploration.
- **Demo frontend**:
  - Triggers requests against the demo backend.
  - Visualizes resulting traces inside Pulse.

These demos double as SDK testbeds and as teaching tools for new users.

### Documentation and developer experience

Documentation is a first-class part of the product:

- Quickstart and SDK installation guides.
- Minimal examples for instrumenting a service.
- Docker deployment guide.
- API key setup instructions.
- Architecture explanations and conceptual overviews.

High-quality docs and a clean developer experience are intended to be key differentiators versus other open-source observability tools.

For a higher-level description of why these features exist and who they serve, see [`overview.md`](overview.md). For implementation-level details, see [`architecture.md`](architecture.md) and the MVP roadmap in [`mvp-scope.md`](mvp-scope.md).

