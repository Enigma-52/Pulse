## Demo Node backend

The demo backend is a small Express app that uses `@pulse/node` to emit spans and logs. It provides a quick way to generate realistic telemetry for exploration.

### Prerequisites

- Node.js 18+ (for built-in `fetch` and modern syntax).
- `npm` installed.
- The Pulse ingestion server running locally (see `docs/local-dev.md`).

### Install dependencies

From the repo root:

```bash
npm install
```

This installs dependencies for the workspace, including the demo backend and SDK.

### Running the ingestion server

In one terminal, start the Go ingestion service:

```bash
cd services/ingestion
go run ./cmd/ingestion
```

By default it listens on `http://localhost:8081/v1/ingest`.

### Running the demo backend

In another terminal:

```bash
cd demo/backend-node
npm run dev
```

The backend listens on `http://localhost:4000`.

### Routes

- `GET /ok` – fast 200 response.
- `GET /slow` – responds after a random 100–800ms delay.
- `GET /error` – sometimes throws an error to generate failing traces and error logs.

Each route uses the Pulse client to:

- Create spans around handler work.
- Log structured events for errors with `pulseClient.log("error", ...)`.

### Environment variables

The demo backend respects:

- `PULSE_INGEST_URL` – URL for the ingestion server (default: `http://localhost:8081/v1/ingest`).
- `PULSE_API_KEY` – project API key (default: `dev-api-key`).
- `PORT` – server port (default: `4000`).

With the ingestion server and backend running, you should see telemetry logged by the ingestion service for each request you make to the demo routes.

