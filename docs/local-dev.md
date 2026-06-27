## Local development environment

This guide shows how to run the core Pulse infrastructure and services locally using Docker and Go/Node processes.

### 1. Start Redpanda and ClickHouse with Docker

From the repo root:

```bash
docker compose -f deploy/docker-compose.yml up -d redpanda clickhouse
```

This starts:

- `redpanda` – Kafka-compatible broker (auto topic creation enabled for dev).
- `clickhouse` – ClickHouse server with a local volume.

Service endpoints:

- Redpanda broker from other containers: `redpanda:29092`.
- Redpanda broker from the host: `localhost:9092`.
- ClickHouse HTTP: `http://localhost:8123`.
- ClickHouse native: `localhost:9000`.

To stop the stack:

```bash
docker compose down
```

### 2. Run the ingestion server (Go)

In a new terminal:

```bash
cd services/ingestion
go run ./cmd/ingestion
```

The ingestion server listens on `http://localhost:8081` and accepts OTLP/HTTP at `/v1/traces`, `/v1/logs`, and `/v1/metrics`. Any OpenTelemetry SDK can send data here.

### 3. Run the worker (Go)

```bash
cd services/worker
go run ./cmd/worker
```

The worker consumes Redpanda topics and writes to ClickHouse.

### 4. Run the query API (Go)

```bash
cd services/query-api
go run ./cmd/query-api
```

The query API listens on `http://localhost:8082` and exposes:

- `GET /healthz` – health check.
- Query endpoints for traces, logs, and metrics.

### 5. Run the product dashboard frontend (`dashboard`)

```bash
cd dashboard
npm install
npm run dev
```

The dashboard app runs on `http://localhost:8080` by default.

### 6. Run the public frontend (`frontend`)

```bash
cd frontend
npm install
npm run dev
```

The public app runs on `http://localhost:5174`.

With these pieces running, you have a full local loop:

OTel SDK (any language) → your app → ingestion (Go, OTLP/HTTP) → Redpanda → worker → ClickHouse → query API (Go) → dashboard UI (`dashboard/`).
