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

The ingestion server listens on `http://localhost:8081/v1/ingest` and accepts batched telemetry from SDKs.

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

### 5. Run the product dashboard frontend (`future-web`)

```bash
cd future-web
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

### 7. Run the demo Node backend (optional)

From the repo root:

```bash
cd demo/backend-node
npm install
npm run dev
```

The backend listens on `http://localhost:4000` and emits spans/logs to the ingestion server using `@pulse/node`.

Relevant environment variables:

- `PULSE_INGEST_URL` – defaults to `http://localhost:8081/v1/ingest`.
- `PULSE_API_KEY` – defaults to `dev-api-key`.

With these pieces running, you have a full local loop:

SDK (`@pulse/node`) → demo backend → ingestion (Go) → Redpanda/ClickHouse → query API (Go) → dashboard UI (`future-web`).
