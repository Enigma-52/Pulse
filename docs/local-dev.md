## Local development environment

This guide shows how to run the core Pulse infrastructure and services locally using Docker and Go/Node processes.

### 1. Start Kafka and ClickHouse with Docker

From the repo root:

```bash
cd infra
docker compose up -d
```

This starts:

- `kafka` – Kafka broker (with auto topic creation enabled for dev).
- `clickhouse` – ClickHouse server with a local volume.

Service endpoints:

- Kafka broker from other containers: `kafka:29092`.
- Kafka broker from the host: `localhost:9092`.
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

### 3. Run the worker stub (Go, optional for Phase 1)

```bash
cd services/worker
go run ./cmd/worker
```

For now this is a stub that logs startup; later it will consume Kafka topics and write to ClickHouse.

### 4. Run the query API stub (Go)

```bash
cd services/query-api
go run ./cmd/query-api
```

The query API listens on `http://localhost:8082` and exposes:

- `GET /healthz` – health check.
- `GET /traces` – mock trace list, to be wired to ClickHouse in a later phase.

### 5. Run the demo Node backend

From the repo root:

```bash
npm install
cd demo/backend-node
npm run dev
```

The backend listens on `http://localhost:4000` and emits spans/logs to the ingestion server using `@pulse/node`.

Relevant environment variables:

- `PULSE_INGEST_URL` – defaults to `http://localhost:8081/v1/ingest`.
- `PULSE_API_KEY` – defaults to `dev-api-key`.

### 6. Run the React UI shell

From the repo root:

```bash
cd ui/web
npm install
npm run dev
```

The UI shell runs on `http://localhost:5173` and will eventually use the Query API to show trace lists and details.

With these pieces running, you have a full local Phase 1 loop:

SDK (`@pulse/node`) → demo backend → ingestion (Go) → Kafka/ClickHouse (infra) → query API stub (Go) → React UI shell.

