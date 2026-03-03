## MVP scope and roadmap

If you narrow Pulse to a strict MVP, the work breaks down into clear phases.

### Phase 1 – Core tracing and storage

- Node SDK only to start (`@pulse/node`).
- Ingestion server.
- Kafka.
- ClickHouse.
- Basic trace search UI.
- API keys and project model.

This phase delivers an end-to-end tracing pipeline and a minimal UI for exploring traces, suitable for early adopters and internal testing.

### Phase 2 – Metrics, query builder, and anomaly detection

- Metrics ingestion and storage.
- Query builder UI on top of ClickHouse.
- Initial anomaly detection:
  - Moving average baselines.
  - Spike detection on p95 latency and error rates.

This phase turns Pulse into a more complete observability platform, connecting traces with aggregate metrics and early anomaly signals.

### Phase 3 – Multi-language SDKs, alerting, and hosted option

- Additional SDKs:
  - Python (`pulse-python`).
  - Go (`pulse-go`).
- Alerting:
  - Surfacing anomalies via UI badges.
  - Webhook-based notifications (and other channels over time).
- Hosted/managed offering:
  - Foundations for a hosted Pulse deployment for teams that prefer not to run it themselves.

Phases build on each other: Phase 1 establishes the core pipeline, Phase 2 layers on richer analysis and detection, and Phase 3 expands language support and operational reach. For more context on platform positioning, see [`overview.md`](overview.md). For technical details on the pipeline and components, see [`architecture.md`](architecture.md), and for current feature behavior see [`features.md`](features.md).

