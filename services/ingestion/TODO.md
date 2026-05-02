# Ingestion Service TODO

Updated: 2026-05-02

## Current

- Accepts `POST /v1/ingest`.
- Validates JSON and required `serviceName`.
- Publishes payload to Kafka topic `traces_raw`.

## Next

- [ ] Enforce API key validation and project lookup.
- [ ] Validate `environment` and envelope schema strictly.
- [ ] Enforce payload size limits and request rate limits.
- [ ] Add request ID and structured logging fields.
- [ ] Return consistent error payloads (code/message/details).
- [ ] Split traces/logs/metrics into dedicated topics.
- [ ] Add basic auth and ingestion counters/latency metrics.
