# Pulse demo — real instrumented microservices

A dockerized, **fully real** microservice environment used to seed Pulse with
authentic telemetry and to test the ingest → store → query path end-to-end.
Unlike `pulse/cmd/loadgen` (which *synthesizes* OTLP payloads), everything here
is genuine: real HTTP servers, real Postgres/Redis queries, real outbound API
calls — all auto-instrumented with OpenTelemetry SDKs that export OTLP to Pulse.

> Use `loadgen` for fast, high-volume synthetic data; use this `demo/` when you
> need to trust that Pulse's derivations (DB calls, external calls, service map,
> exceptions, exemplars) match what real SDKs actually emit.

## Architecture

```
                       ┌─────────────────────────────┐
   traffic-gen  ─────► │  order-service (Node/Express)│ ──► Postgres
   (random HTTP)       │  OTel auto-instrumentation   │ ──► Redis
        │              └─────────────┬───────────────┘ ──► httpbin (external API)
        │                            │ HTTP
        └─────────────►┌─────────────▼───────────────┐
                       │ catalog-service (Py/FastAPI) │ ──► Postgres
                       │  OTel auto-instrumentation   │ ──► Redis
                       └──────────────────────────────┘
                            │  OTLP/HTTP (traces, logs, metrics)
                            ▼
                     Pulse  :4321   ──►  ClickHouse
```

All containers share a docker network and export to
`OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4321` (or the Pulse
service name when run on the same compose network).

## Services

| Service | Stack | Talks to | Emits |
|---|---|---|---|
| `order-service` | Node 20 / Express | Postgres, Redis, httpbin | HTTP server + client spans, PG/Redis db spans, exceptions |
| `catalog-service` | Python 3.12 / FastAPI | Postgres, Redis | HTTP server spans, PG/Redis db spans |
| `postgres` | Postgres 16 | — | (target of db.system=postgresql spans) |
| `redis` | Redis 7 | — | (target of db.system=redis spans) |
| `traffic-gen` | Node | both services | drives randomized, realistic traffic |

## Run

```bash
# 1. Pulse + ClickHouse must be running (deploy/docker-compose.yml)
# 2. Then bring up the demo:
cd demo
docker compose up --build
```

Traffic starts immediately; within a minute the dashboard's Services, Traces,
Databases, External APIs, Errors, and Metrics screens populate from real spans.

## What it exercises today

- **Traces** spanning traffic-gen → order-service → catalog-service (multi-service).
- **Real DB spans** — `db.system=postgresql` / `redis` from the actual PG/Redis
  instrumentation, so the Databases page reflects genuine queries/latency.
- **Real external calls** — outbound to `httpbin.org`, surfaced on External APIs.
- **Exceptions** — injected failure paths (bad input, missing rows) raise real
  exceptions captured as span events.
- **Logs & metrics** — SDK logs correlated by trace_id; runtime/host metrics.

## What we can add incrementally

The point of `demo/` is to grow it as we add features to verify. Candidates:

- **More DB engines** — MongoDB, MySQL to validate those `db.system` derivations.
- **Message queue** — Kafka/RabbitMQ producer+consumer to test producer/consumer
  span kinds and async trace linking.
- **gRPC service** — validate `rpc.*` semconv extraction.
- **Error/latency injection knobs** — env-tunable error rate, slow-query rate,
  N+1 query patterns, retry storms, timeouts, circuit-breaker trips.
- **High-cardinality attributes** — user IDs / request IDs to stress attribute
  storage and the tag filters.
- **Histograms & exemplars** — real `http.server.duration` histograms to test the
  metrics→trace exemplar path once we build it.
- **Auth flows** — login/session services to exercise multi-hop auth traces.
- **Multiple environments** — run the stack twice with `deployment.environment`
  = production/staging to test the env selector against real data.

## Stress testing — finding prod limits for the current architecture

The current Pulse architecture is a **single Go binary** (in-process bounded
pipeline channel → drops on backpressure) in front of a **single ClickHouse
node**. Use this demo (or `loadgen -interval 0`-style bursts) to find where that
arch tops out, then decide what to shard/scale first.

### Knobs to ramp

- **Ingest rate** — number of `traffic-gen` workers × request rate; or point
  `loadgen` at Pulse with a tight interval and high batch counts.
- **Spans per trace** — deeper service chains multiply span writes per request.
- **Attribute cardinality** — unique tag values per span (stresses ClickHouse
  and JSON extraction in queries).
- **Concurrent dashboard queries** — simulate N analysts hitting query endpoints.

### Signals to watch (this is the actual test)

| Signal | Where | Limit indicator |
|---|---|---|
| Dropped batches | Pulse logs: `pipeline full, dropping … batch` | **Ingest ceiling** — the channel can't drain fast enough |
| Ingest throughput | requests/s at which drops begin | Max sustainable spans/s for one binary |
| ClickHouse memory | `docker stats` on clickhouse | Approaching `max_server_memory_usage_ratio` (0.8) |
| ClickHouse CPU | `docker stats` | Insert/merge saturation |
| Disk growth rate | `SELECT sum(bytes) FROM system.parts` | Retention/scaling planning |
| Query p99 | time the `/traces`, `/services`, `/exceptions` endpoints under load | Read-path degradation |
| Write latency | ClickHouse insert duration in Pulse writer logs | Merge/backpressure |

### Method

1. Start at a modest rate; record the baseline for every signal above.
2. Ramp ingest in steps (e.g. ×2 each stage), holding 2–3 min per step.
3. The **first** signal to breach its SLO (drops > 0, query p99 > target,
   ClickHouse memory near cap) is the current bottleneck.
4. That number is the single-node limit; scaling it (batch inserts, async insert,
   a dedicated writer pool, a ClickHouse cluster) is the next architecture step.

Record findings back here as we run them so the limits are documented per change.

### Quick load without the full demo

```bash
# Burst synthetic load to find the ingest ceiling fast:
cd pulse && go run ./cmd/loadgen -backfill 0 -interval 1     # then lower interval / raise counts
# Watch for drops:
#   tail -f <pulse log> | grep dropping
# Watch ClickHouse:
docker stats deploy-clickhouse-1
```
