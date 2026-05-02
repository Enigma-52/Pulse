# Pulse Current Status (Latest)

Last updated: 2026-05-02

## Snapshot

Pulse currently has a working trace pipeline from SDK to storage to read API, plus a deployable container stack. The product dashboard UI exists in `future-web/`, while `ui/web/` remains a minimal shell.

## What Is Implemented

### Backend data path (working)

1. Node SDK (`sdk/node`) batches spans/logs and sends envelopes to ingestion.
2. Ingestion service (`services/ingestion`) accepts `POST /v1/ingest` and publishes raw payloads to Kafka topic `traces_raw`.
3. Worker service (`services/worker`) consumes `traces_raw`, creates/uses ClickHouse `traces` table, and inserts span rows.
4. Query API (`services/query-api`) serves:
   - `GET /healthz`
   - `GET /traces` (latest 100 traces from ClickHouse)

### Deploy/runtime

- `deploy/docker-compose.yml` runs full stack: zookeeper, kafka, clickhouse, ingestion, worker, query-api, and UI (`future-web`).
- `deploy/install.sh` provides one-command deployment.
- `infra/docker-compose.yml` provides infra-only local stack.

### SDK/demo

- `@pulse/node` supports span lifecycle, log events, periodic batching, and express middleware correlation.
- `demo/backend-node` emits useful traffic patterns through `/ok`, `/slow`, and `/error` routes.

## What Is Partial or Pending

1. Multi-tenant auth model is not enforced end-to-end.
   - API key header is accepted by SDK transport but ingestion does not validate key/project binding.
2. Query API is basic.
   - Only list endpoint exists (`/traces`), no filters, no pagination, no trace detail endpoint.
3. Telemetry coverage is trace-first.
   - Logs are accepted in envelope but not persisted/queryable as first-class backend tables/API.
   - Metrics ingestion/storage/query layers are not implemented.
4. Reliability architecture is minimal.
   - No DLQ path, limited retry semantics, and no explicit poison-message strategy.
5. UI integration to live backend is incomplete across apps.
   - `future-web` contains rich product UI with mock data.
   - `ui/web` remains a placeholder shell.

## Active App Layout (as of now)

- `frontend/`: public-facing frontend/docs entry shell.
- `future-web/`: product dashboard app used by deploy compose.
- `ui/web/`: older minimal shell, not used by current deploy compose.

## Recommended Next Milestones

1. Lock ingestion auth and tenant/project model.
2. Expand query-api to support filters, time range, pagination, and trace detail endpoints.
3. Add logs and metrics persistence/query paths.
4. Add resilience controls: retries, DLQ, operational telemetry.
5. Wire dashboard to live query-api endpoints and remove mock data dependency incrementally.
