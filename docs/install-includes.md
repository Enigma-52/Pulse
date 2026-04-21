## Pulse install inventory

This document lists what gets installed when a user runs the one-command Pulse deploy:

```bash
cd deploy
./install.sh
```

The install is based on `deploy/docker-compose.yml`.

## Installed runtime components

### Infrastructure

- `zookeeper` (Confluent image)
- `kafka` (Confluent image)
- `clickhouse` (ClickHouse server)

### Pulse services

- `ingestion` (Go service)
- `worker` (Go service)
- `query-api` (Go service)

### Frontend (product UI)

- `ui` service, built from `future-web/` and served via nginx
- Exposed at `http://localhost:3301`

## Exposed endpoints

- Product UI: `http://localhost:3301`
- Ingestion API: `http://localhost:8081/v1/ingest`
- Query API: `http://localhost:8082`
- ClickHouse HTTP: `http://localhost:8123`
- ClickHouse native: `localhost:9000`

## Data persistence

- Docker volume: `clickhouse_data`
- Purpose: persist ClickHouse telemetry data across container restarts

## Included by repository but not installed by default

These are available in the repo but are not started by `deploy/install.sh`:

- `frontend/` public web app (landing/docs entry)
- `demo/backend-node` demo backend app
- `sdk/node` development SDK package
- `infra/docker-compose.yml` infra-only local stack (manual)

## Comparison note (SigNoz-style package thinking)

Like SigNoz shipping a pre-bundled observability package, Pulse ships a pre-bundled runtime package made of:

- telemetry ingestion
- stream processing
- ClickHouse storage
- query API
- prebuilt dashboard UI

So users get an integrated observability stack after install, not just a single binary.
