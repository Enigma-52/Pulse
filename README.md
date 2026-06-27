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

Pulse includes both backend and frontend components.

### Backend platform

- Ingestion service (accepts OTLP/HTTP telemetry from any OpenTelemetry SDK)
- Worker service (processes telemetry data)
- Query API service (serves data to the UI)
- Redpanda (stream pipeline)
- ClickHouse (observability data storage)

### Frontend apps

1. `frontend/`
Public-facing site (landing/docs entry points)

2. `dashboard/`
Product dashboard used by Pulse users after deployment

## Quick start (one-command deploy)

```bash
cd deploy
./install.sh
```

After install:

- Product UI: `http://localhost:3301`
- Ingestion API: `http://localhost:8081/v1/traces` (also `/v1/logs`, `/v1/metrics`)
- Query API: `http://localhost:8082`

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
