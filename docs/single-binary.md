# Single binary — done

## Result

The stack is now two containers: `pulse` + `clickhouse`.

- `services/ingestion/`, `services/worker/`, `services/query-api/` → merged into `pulse/`
- Redpanda removed from `deploy/docker-compose.yml`
- Single port: **4321** (OTLP ingest + query API)

## What `pulse` looks like internally

```
pulse/
  cmd/pulse/main.go       # starts everything
  internal/
    ingest/               # OTLP HTTP receiver (protobuf + JSON)
    writer/               # ClickHouse writer (parses OTLP proto, inserts)
    query/                # query API (handlers, store, model)
    pipeline/             # in-process channel connecting ingest → writer
    config/               # unified configuration
    server/               # unified HTTP router
```

`pipeline/` is the Redpanda replacement:

```go
events := make(chan Batch, 10000)  // buffered — handles traffic spikes
```

Ingest handler pushes batches onto the channel. Writer goroutine drains it into ClickHouse. If the channel is full, return 429.

## What stayed the same

- ClickHouse schema — enhanced with resource_attributes, scope, links
- Query API logic — moved, not changed
- Dashboard UI — no changes

## Compose file

```yaml
services:
  pulse:
    ports: ["4321:4321"]
    environment:
      PULSE_CLICKHOUSE_ADDR: clickhouse:9000
  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    volumes:
      - clickhouse_data:/var/lib/clickhouse
```

## Durability note

In-process channel means buffered events are lost on crash. Acceptable for v1 — document it. Add a WAL later if users raise it.
