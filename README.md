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

- **Distributed Tracing** — flamegraph, waterfall view, service breakdown, span attributes
- **Log Management** — stream and grouped views, level filters, search, trace correlation
- **Metrics** — time-series charts, per-service breakdown, queryable explorer
- **Database Monitoring** — auto-detects PostgreSQL, MySQL, MongoDB, Redis queries from traces with slow query tracking
- **Service Overview** — all instrumented services with latency percentiles, error rates, request counts
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

## Documentation

- [Architecture](docs/architecture.md)
- [Local Development](docs/local-dev.md)
- [Roadmap](docs/todo.md)

## License

MIT
