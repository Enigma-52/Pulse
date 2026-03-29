# One-Command Deployment — Design Spec
*Date: 2026-03-30*

## Goal

Allow a new user to deploy the full Pulse platform with two commands:

```bash
git clone https://github.com/your-org/pulse.git && cd pulse/deploy
./install.sh
```

Modelled on SigNoz's install flow. Platform only — no demo app bundled.

---

## Directory Structure

```
deploy/
├── docker-compose.yml       # full stack: infra + all services + UI
├── install.sh               # prereq check + docker compose up + success message
└── nginx/
    └── default.conf         # serves UI static files, proxies /api/* → query-api:8082

services/
├── ingestion/Dockerfile
├── worker/Dockerfile
└── query-api/Dockerfile

ui/
└── web/Dockerfile
```

The existing `infra/docker-compose.yml` is unchanged — it remains useful for local dev (infra only, no app images).

---

## Dockerfiles

### Go Services (ingestion, worker, query-api)
Two-stage build:
1. **Build stage**: `golang:1.22-alpine` — compiles a static binary via `go build`
2. **Run stage**: `alpine:3.19` — copies binary, runs it

Each service has its own `go.mod`, so each Dockerfile builds from its own service directory context.

### UI (`ui/web/Dockerfile`)
Two-stage build:
1. **Build stage**: `node:20-alpine` — runs `npm install && npm run build`, outputs `dist/`
2. **Run stage**: `nginx:alpine` — copies `dist/` and `deploy/nginx/default.conf`

### nginx config (`deploy/nginx/default.conf`)
- Serves React static files from `/usr/share/nginx/html` on port 80
- Proxies `location /api/` → `http://query-api:8082/` (strips `/api` prefix)
- Handles React Router: `try_files $uri /index.html`

---

## `deploy/docker-compose.yml` — Service Graph

| Service | Image | Port (host) | Depends on |
|---------|-------|-------------|------------|
| `zookeeper` | `confluentinc/cp-zookeeper:7.5.0` | — | — |
| `kafka` | `confluentinc/cp-kafka:7.5.0` | — | zookeeper healthy |
| `clickhouse` | `clickhouse/clickhouse-server:24.3` | — | — |
| `ingestion` | built from `services/ingestion` | `8081` | kafka healthy |
| `worker` | built from `services/worker` | — | kafka healthy, clickhouse healthy |
| `query-api` | built from `services/query-api` | `8082` | clickhouse healthy |
| `ui` | built from `ui/web` | `3301` | query-api started |

**Network**: single `pulse-net` bridge network for all services.

**Volumes**: `clickhouse_data` persistent volume for ClickHouse data.

### Health Checks
- `kafka`: polls `kafka-topics.sh --bootstrap-server localhost:9092 --list` every 10s, 10 retries
- `clickhouse`: `curl -sf http://localhost:8123/ping` every 10s, 10 retries
- `ingestion`, `query-api`: no health check endpoint yet — worker/ui use `condition: service_started`

### Environment Variables (no `.env` required)
```
PULSE_KAFKA_BROKERS=kafka:29092
PULSE_CLICKHOUSE_ADDR=clickhouse:9000
PULSE_CLICKHOUSE_USER=default
PULSE_CLICKHOUSE_PASSWORD=
```

---

## `deploy/install.sh` — Script Flow

1. Print banner: `Pulse Observability — Installing...`
2. Check `docker` is installed — exit with message if missing
3. Check `docker compose` (v2 plugin) is available — exit with message if missing
4. Run `docker compose -f docker-compose.yml up -d --build`
5. Poll `http://localhost:3301` every 3s, up to 60s, until reachable
6. Print success:
   ```
   ✓ Pulse is running

   UI:           http://localhost:3301
   Ingest API:   http://localhost:8081/v1/ingest
   Query API:    http://localhost:8082/traces
   ```

Script is `chmod +x` and uses `#!/usr/bin/env bash`.

---

## Ports Summary

| Port | Service | Purpose |
|------|---------|---------|
| `3301` | UI (nginx) | Web dashboard |
| `8081` | ingestion | SDK/app sends traces here |
| `8082` | query-api | Direct API access |

Ports 2181, 9092, 8123, 9000 (Kafka/ClickHouse internals) are **not** exposed to host in the deploy compose — only needed by app services internally.

---

## Out of Scope

- TLS / HTTPS
- Auth / API key validation
- Multi-node / production HA setup
- Demo app / sample data
