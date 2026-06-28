## Local development environment

This guide shows how to run Pulse locally for development.

### 1. Start ClickHouse with Docker

From the repo root:

```bash
docker compose -f deploy/docker-compose.yml up -d clickhouse
```

ClickHouse endpoints:

- HTTP: `http://localhost:8123`
- Native: `localhost:9000`

To stop:

```bash
docker compose down
```

### 2. Run the Pulse server (Go)

In a new terminal:

```bash
cd pulse
go run ./cmd/pulse
```

Pulse listens on `http://localhost:4321` and serves:

- **OTLP ingest**: `POST /v1/traces`, `/v1/logs`, `/v1/metrics` (protobuf + JSON)
- **Query API**: `GET /traces`, `/logs`, `/metrics`, `/services`, `/dashboard/summary`
- **Auth**: `/auth/setup`, `/auth/login`
- **Health**: `GET /healthz`

### 3. Run the product dashboard frontend (`dashboard`)

```bash
cd dashboard
npm install
npm run dev
```

The dashboard app runs on `http://localhost:8080` by default.

### 4. Run the public frontend (`frontend`)

```bash
cd frontend
npm install
npm run dev
```

The public app runs on `http://localhost:5174`.

### Full local loop

OTel SDK (any language) → your app → Pulse (Go, OTLP/HTTP on :4321) → ClickHouse → Pulse query API → dashboard UI (`dashboard/`).

### Durability note

The in-process pipeline (replacing Kafka/Redpanda) uses a buffered Go channel. Buffered events are lost on crash. This is acceptable for v1 — a WAL can be added later if needed.
