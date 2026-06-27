# Pulse


██████╗ ██╗   ██╗██╗     ███████╗███████╗
██╔══██╗██║   ██║██║     ██╔════╝██╔════╝
██████╔╝██║   ██║██║     ███████╗█████╗
██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝
██║     ╚██████╔╝███████╗███████║███████╗
╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝


Pulse is an open-source observability platform for traces, metrics, and logs.
It is built to be easy to run and quick to understand.

## What Pulse gives you

- A single dashboard to inspect service health and request flow
- Trace, log, and metric visibility in one place
- A deploy flow that brings up the full stack in one command
- A clean local setup for product and backend development

## What runs in Pulse

Two containers: `pulse` + `clickhouse`. That's it.

### Backend

- **`pulse`** — single Go binary handling OTLP ingestion, ClickHouse writing, and query API on port **4321**
- **ClickHouse** — columnar storage for all telemetry data

### Frontend apps

1. `frontend/` — public-facing site (landing/docs entry points)
2. `dashboard/` — product dashboard used by Pulse users after deployment

## Quick start (one-command deploy)

```bash
cd deploy
./install.sh
```

After install:

- Product UI: `http://localhost:3301`
- Pulse API: `http://localhost:4321` (OTLP ingest + query API)

### Send telemetry from any language

Point any OpenTelemetry SDK at `http://localhost:4321/v1/traces` (also `/v1/logs`, `/v1/metrics`).

Example (Node.js):

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:4321/v1/traces",
  }),
});
sdk.start();
```

## Run frontend apps locally

```bash
# Public app
cd frontend
npm install
npm run dev

# Product dashboard app
cd ../dashboard
npm install
npm run dev
```

## Documentation

- Project-wide TODO: `docs/todo.md`
- Architecture: `docs/architecture.md`
- Local development: `docs/local-dev.md`
