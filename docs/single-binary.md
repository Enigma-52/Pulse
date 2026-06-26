# Single binary — merge services, drop Redpanda

## Goal

Reduce the stack to two containers: `pulse` + `clickhouse`.

## What gets removed

- `services/ingestion/` — merged into `pulse`
- `services/worker/` — merged into `pulse`
- Redpanda from `deploy/docker-compose.yml`

## What `pulse` looks like internally

```
pulse/
  cmd/pulse/main.go       # starts everything
  internal/
    ingest/               # OTLP HTTP receiver (from ingestion service)
    writer/               # ClickHouse writer (from worker service)
    query/                # query API (from query-api service, unchanged)
    pipeline/             # in-process channel connecting ingest → writer
```

`pipeline/` is the Redpanda replacement:

```go
events := make(chan Batch, 10000)  // buffered — handles traffic spikes
```

Ingest handler pushes batches onto the channel. Writer goroutine drains it into ClickHouse. If the channel is full, return 429.

## What stays the same

- ClickHouse schema — untouched
- Query API logic — just moved into the same binary
- Dashboard UI — no changes

## Updated compose file

```yaml
services:
  pulse:
    image: pulse
    ports:
      - "4318:4318"   # OTLP HTTP receiver
      - "8082:8082"   # query API
    environment:
      PULSE_CLICKHOUSE_ADDR: clickhouse:9000

  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    volumes:
      - clickhouse_data:/var/lib/clickhouse
```

## Order of work

1. Merge ingestion + worker + query-api into single `pulse` binary
2. Replace Kafka consumer/producer with in-process channel
3. Do the OTLP migration (see `otlp-migration.md`) — ingestion rework happens here
4. Update compose file, remove Redpanda
5. Update `docs/local-dev.md` and `README.md`

## Durability note

In-process channel means buffered events are lost on crash. Acceptable for v1 — document it. Add a WAL later if users raise it.
