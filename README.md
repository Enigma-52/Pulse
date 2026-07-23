<div align="center">

# Pulse

### See everything. Fix anything. Ship faster.

Open-source observability platform for traces, logs, metrics, and database monitoring.

Two containers. One binary. Zero complexity.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

</div>

---

## Why Pulse?

Most observability tools are either expensive SaaS or painfully complex to self-host. Pulse gives you production-grade observability with a single Go binary and a ClickHouse database. No agents, no collectors, no YAML pipelines — just point your app at Pulse and see everything.

## What You Get

- **Alerting** — threshold rules on traces, logs, and metrics with Slack and webhook notifications
- **Exception Monitoring** — auto-captured from OTel exception events, grouped by fingerprint with stack traces and linked traces
- **Distributed Tracing** — flamegraph, waterfall view, service breakdown, span attributes
- **Log Management** — stream and grouped views, level filters, search, trace correlation
- **Metrics** — time-series charts, per-service breakdown, queryable explorer
- **Trace Analytics** — group-by breakdowns (service/route/operation), error-rate charts, top-N slowest traces
- **Database Monitoring** — auto-detects PostgreSQL, MySQL, MongoDB, Redis queries from traces with slow query tracking
- **External Call Monitoring** — outbound HTTP latency and error rates per remote host, derived from client spans
- **Service Overview** — all instrumented services with latency percentiles, error rates, request counts
- **Unified Search** — one search bar across traces, logs, metrics, services, and exceptions
- **SQL Explore** — guarded read-only ClickHouse SQL over all your telemetry
- **Retention** — per-signal TTL cleanup with a live data-usage view
- **Works With Any Language** — accepts standard OpenTelemetry data from Node.js, Python, Go, Java, .NET, and more

## Get Started

Run from the `deploy/` directory:

```
docker compose up -d
```

Then open **localhost:3301** for the dashboard. Point any OpenTelemetry SDK at **localhost:4321** to start sending data.

| | URL |
|---|---|
| Dashboard | localhost:3301 |
| OTLP Ingest | localhost:4321 |

For production, set a real auth secret before starting: `export PULSE_JWT_SECRET=$(openssl rand -hex 32)`. See [Architecture → Configuration](docs/architecture.md#configuration) for all environment variables and the `/healthz` / `/readyz` probes.

## How It Works

Your app sends traces, logs, and metrics to Pulse over OTLP/HTTP. Pulse stores everything in ClickHouse and serves it through a query API. The dashboard gives you a single place to see service health, dig into traces, search logs, and monitor database queries.

```
Your App  →  Pulse (:4321)  →  ClickHouse  →  Dashboard (:3301)
```

That's the whole stack.

## Troubleshooting

- An empty dashboard right after install is normal — pages fill in as soon as your app sends its first OTLP batch to `:4321`.
- `GET localhost:4321/readyz` tells you whether Pulse can reach ClickHouse; `/healthz` only says the process is up.
- Running the binary outside Docker against the compose ClickHouse? Set `PULSE_CLICKHOUSE_PASSWORD=pulse` (see [Local Development](docs/local-dev.md)).

## Documentation

- [Architecture](docs/architecture.md)
- [Local Development](docs/local-dev.md)
- [Roadmap](docs/todo.md)

## License

MIT
