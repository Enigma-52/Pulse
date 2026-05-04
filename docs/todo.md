# Pulse TODO (Project-Wide)

Updated: 2026-05-02

## P0 - Core backend correctness

- [ ] Implement API key validation in ingestion.
- [ ] Add project/service binding and reject unauthorized telemetry.
- [ ] Define envelope schema versioning and strict validation rules.
- [ ] Standardize error response model across services.
- [ ] Update Landing Page from Lovable with doc upgrade

## P1 - Query/API capabilities

- [ ] Add `/traces` filters (service, route, status, duration, time range).
- [ ] Add pagination/cursor support for large result sets.
- [ ] Add trace detail endpoint (`/traces/{trace_id}` with spans).
- [ ] Add service-level aggregates (p95 latency, error rate, throughput).

## P1 - Data model expansion

- [ ] Persist logs to ClickHouse (`logs` table) via worker.
- [ ] Add logs query endpoints in query-api.
- [ ] Implement metrics ingestion + storage + query endpoints.

## P1 - Reliability and operations

- [ ] Add DLQ topic and poison-message handling strategy.
- [ ] Add worker retry/backoff policy with observability.
- [ ] Add internal service metrics and structured logs.
- [ ] Add readiness checks for kafka/clickhouse dependencies.

## P2 - Product integration

- [ ] Replace mock data usage in `future-web` with live query-api calls.
- [ ] Align app roles between `frontend`, `future-web`, and `ui/web`.
- [ ] Decommission or repurpose `ui/web` after frontend decision.

## P2 - Developer experience

- [ ] Refresh docs to match current runtime wiring.
- [ ] Add end-to-end smoke test script (ingest -> query assertion).
- [ ] Add CI checks for Go services and frontend builds.
