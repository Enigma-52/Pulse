# One-Command Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any user to deploy the full Pulse platform (infra + 3 Go services + React UI) with `git clone` + `./install.sh`.

**Architecture:** Each Go service and the React UI get a multi-stage Dockerfile. A single `deploy/docker-compose.yml` wires all 7 services together with health-check-based ordering. An `install.sh` script validates prerequisites, runs the compose stack, waits for the UI, and prints access URLs.

**Tech Stack:** Go 1.22/1.24, Node 20, nginx:alpine, Docker Compose v2, Confluent Kafka 7.5, ClickHouse 24.3

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `services/ingestion/Dockerfile` | Create | Multi-stage Go build → alpine runner for ingestion service |
| `services/worker/Dockerfile` | Create | Multi-stage Go build → alpine runner for worker service |
| `services/query-api/Dockerfile` | Create | Multi-stage Go build → alpine runner for query-api service |
| `ui/web/Dockerfile` | Create | Multi-stage Node build (vite) → nginx:alpine static file server |
| `deploy/nginx/default.conf` | Create | nginx: serve React SPA, proxy `/api/*` → `query-api:8082` |
| `deploy/docker-compose.yml` | Create | Full stack compose: infra + all services + UI + health checks |
| `deploy/install.sh` | Create | Prereq checks, `docker compose up -d --build`, readiness poll, success output |

---

## Task 1: Dockerfile for `ingestion` service

**Files:**
- Create: `services/ingestion/Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
# services/ingestion/Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o ingestion ./cmd/ingestion

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/ingestion .
EXPOSE 8081
CMD ["./ingestion"]
```

- [ ] **Step 2: Verify it builds**

From the repo root:
```bash
docker build -t pulse-ingestion-test services/ingestion/
```
Expected: build completes, final image is ~15-20MB. No errors.

- [ ] **Step 3: Commit**

```bash
git add services/ingestion/Dockerfile
git commit -m "feat: add Dockerfile for ingestion service"
```

---

## Task 2: Dockerfile for `worker` service

**Files:**
- Create: `services/worker/Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
# services/worker/Dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/worker .
CMD ["./worker"]
```

- [ ] **Step 2: Verify it builds**

```bash
docker build -t pulse-worker-test services/worker/
```
Expected: build completes successfully. No errors.

- [ ] **Step 3: Commit**

```bash
git add services/worker/Dockerfile
git commit -m "feat: add Dockerfile for worker service"
```

---

## Task 3: Dockerfile for `query-api` service

**Files:**
- Create: `services/query-api/Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
# services/query-api/Dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o query-api ./cmd/query-api

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/query-api .
EXPOSE 8082
CMD ["./query-api"]
```

- [ ] **Step 2: Verify it builds**

```bash
docker build -t pulse-query-api-test services/query-api/
```
Expected: build completes successfully. No errors.

- [ ] **Step 3: Commit**

```bash
git add services/query-api/Dockerfile
git commit -m "feat: add Dockerfile for query-api service"
```

---

## Task 4: nginx config and UI Dockerfile

**Files:**
- Create: `deploy/nginx/default.conf`
- Create: `ui/web/Dockerfile`

- [ ] **Step 1: Create the nginx config**

```nginx
# deploy/nginx/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # React Router — serve index.html for any unmatched path
    location / {
        try_files $uri /index.html;
    }

    # Proxy /api/* → query-api service (strips /api prefix)
    location /api/ {
        proxy_pass http://query-api:8082/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 2: Create the UI Dockerfile**

```dockerfile
# ui/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf is baked into the image at build time via docker-compose build arg
EXPOSE 80
```

Note: the nginx config is mounted/copied via the compose file (see Task 5).

- [ ] **Step 3: Verify the UI Dockerfile builds**

```bash
docker build -t pulse-ui-test ui/web/
```
Expected: build completes. The builder stage runs `vite build`, the nginx stage copies `dist/`. No errors.

- [ ] **Step 4: Commit**

```bash
git add deploy/nginx/default.conf ui/web/Dockerfile
git commit -m "feat: add nginx config and UI Dockerfile"
```

---

## Task 5: `deploy/docker-compose.yml`

**Files:**
- Create: `deploy/docker-compose.yml`

- [ ] **Step 1: Create the compose file**

```yaml
# deploy/docker-compose.yml
version: "3.8"

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - pulse-net

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      zookeeper:
        condition: service_started
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://kafka:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    healthcheck:
      test: ["CMD", "kafka-topics", "--bootstrap-server", "localhost:9092", "--list"]
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 30s
    networks:
      - pulse-net

  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8123/ping"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks:
      - pulse-net

  ingestion:
    build:
      context: ../services/ingestion
      dockerfile: Dockerfile
    ports:
      - "8081:8081"
    environment:
      PULSE_KAFKA_BROKERS: kafka:29092
    depends_on:
      kafka:
        condition: service_healthy
    networks:
      - pulse-net

  worker:
    build:
      context: ../services/worker
      dockerfile: Dockerfile
    environment:
      PULSE_KAFKA_BROKERS: kafka:29092
      PULSE_TRACES_TOPIC: traces_raw
      PULSE_WORKER_GROUP: pulse-worker
      PULSE_CLICKHOUSE_ADDR: clickhouse:9000
      PULSE_CLICKHOUSE_DB: default
      PULSE_CLICKHOUSE_USER: default
      PULSE_CLICKHOUSE_PASSWORD: ""
    depends_on:
      kafka:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    networks:
      - pulse-net

  query-api:
    build:
      context: ../services/query-api
      dockerfile: Dockerfile
    ports:
      - "8082:8082"
    environment:
      PULSE_CLICKHOUSE_ADDR: clickhouse:9000
      PULSE_CLICKHOUSE_DB: default
      PULSE_CLICKHOUSE_USER: default
      PULSE_CLICKHOUSE_PASSWORD: ""
    depends_on:
      clickhouse:
        condition: service_healthy
    networks:
      - pulse-net

  ui:
    build:
      context: ../ui/web
      dockerfile: Dockerfile
    ports:
      - "3301:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - query-api
    networks:
      - pulse-net

networks:
  pulse-net:
    driver: bridge

volumes:
  clickhouse_data:
    driver: local
```

- [ ] **Step 2: Verify the compose file parses correctly**

```bash
cd deploy
docker compose -f docker-compose.yml config
```
Expected: compose prints the resolved config with no errors. All 7 services appear.

- [ ] **Step 3: Commit**

```bash
git add deploy/docker-compose.yml
git commit -m "feat: add deploy/docker-compose.yml with full platform stack"
```

---

## Task 6: `deploy/install.sh`

**Files:**
- Create: `deploy/install.sh`

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "  ██████╗ ██╗   ██╗██╗     ███████╗███████╗"
echo "  ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝"
echo "  ██████╔╝██║   ██║██║     ███████╗█████╗  "
echo "  ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  "
echo "  ██║     ╚██████╔╝███████╗███████║███████╗"
echo "  ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝"
echo ""
echo "  Pulse Observability — Installing..."
echo ""

# ── Prereq: docker ────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "ERROR: 'docker' is not installed or not in PATH."
  echo "       Install Docker Desktop: https://docs.docker.com/get-docker/"
  exit 1
fi

# ── Prereq: docker compose (v2 plugin) ───────────────────────────────────────
if ! docker compose version &>/dev/null; then
  echo "ERROR: 'docker compose' (v2 plugin) is not available."
  echo "       Update Docker Desktop or install the Compose plugin:"
  echo "       https://docs.docker.com/compose/install/"
  exit 1
fi

echo "  Docker:         $(docker --version)"
echo "  Docker Compose: $(docker compose version)"
echo ""

# ── Start the stack ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "  Starting Pulse stack (this may take a few minutes on first run)..."
echo ""

docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build

# ── Wait for UI ───────────────────────────────────────────────────────────────
echo ""
echo "  Waiting for Pulse UI to be ready..."

UI_URL="http://localhost:3301"
MAX_WAIT=60
ELAPSED=0

until curl -sf "$UI_URL" >/dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo ""
    echo "  WARNING: UI did not respond within ${MAX_WAIT}s."
    echo "  The stack may still be starting. Check logs with:"
    echo "    docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
    exit 0
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

# ── Success ───────────────────────────────────────────────────────────────────
echo ""
echo "  ✓ Pulse is running"
echo ""
echo "  UI:           http://localhost:3301"
echo "  Ingest API:   http://localhost:8081/v1/ingest"
echo "  Query API:    http://localhost:8082/traces"
echo ""
echo "  To stop:  docker compose -f $SCRIPT_DIR/docker-compose.yml down"
echo "  Logs:     docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f"
echo ""
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x deploy/install.sh
```

- [ ] **Step 3: Smoke-test prerequisite checks (dry run)**

Temporarily rename `docker` to verify the check fires:
```bash
# Just check the script syntax — no need to break your docker install
bash -n deploy/install.sh
```
Expected: `bash -n` exits 0 (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add deploy/install.sh
git commit -m "feat: add install.sh with prereq checks and readiness polling"
```

---

## Task 7: End-to-end smoke test

This validates the entire flow works before calling the feature done.

- [ ] **Step 1: Run the installer**

```bash
cd deploy
./install.sh
```
Expected: all 7 containers start, UI becomes reachable at `http://localhost:3301`, success message is printed with all 3 URLs.

- [ ] **Step 2: Verify ingestion is accepting data**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8081/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"serviceName":"smoke-test","environment":"test","spans":[{"traceId":"abc123","spanId":"span1","parentSpanId":"","name":"test.op","startTime":1700000000000,"endTime":1700000001000,"durationMs":1000,"status":"ok","error":"","attributes":{}}]}'
```
Expected: `202`

- [ ] **Step 3: Verify query-api returns data**

Wait ~5 seconds for the worker to consume and write, then:
```bash
curl -s http://localhost:8082/traces | head -c 200
```
Expected: JSON array containing at least one trace with `"service":"smoke-test"`.

- [ ] **Step 4: Verify UI loads in browser**

Open `http://localhost:3301` in a browser.
Expected: Pulse header renders, no blank page, no console errors for missing assets.

- [ ] **Step 5: Tear down**

```bash
docker compose -f deploy/docker-compose.yml down -v
```
Expected: all containers stop and remove cleanly. `clickhouse_data` volume is removed (due to `-v`).

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: one-command deploy with install.sh, Dockerfiles, and full compose stack"
```

---

## Self-Review

**Spec coverage:**
- [x] `deploy/` directory structure with `install.sh`, `docker-compose.yml`, `nginx/default.conf`
- [x] Dockerfiles for all 3 Go services and UI
- [x] Multi-stage builds (Go: golang:alpine → alpine; UI: node → nginx)
- [x] 7 services in compose with correct `depends_on` + health checks
- [x] kafka and clickhouse health checks defined
- [x] All env vars wired (`PULSE_KAFKA_BROKERS`, `PULSE_CLICKHOUSE_ADDR`, etc.)
- [x] Internal ports (2181, 9092, 8123, 9000) NOT exposed to host
- [x] Host ports 3301, 8081, 8082 exposed
- [x] install.sh: banner, docker check, docker compose check, `up -d --build`, poll, success message
- [x] nginx: SPA fallback + `/api/` proxy to query-api

**Placeholder scan:** None found.

**Type consistency:** No shared types across tasks — each task is isolated file creation.
