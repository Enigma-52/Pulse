## `@pulse/node` SDK quickstart

This guide shows how to add the Pulse Node SDK to a service, emit basic traces and logs, and send them to the Pulse ingestion server.

### Installation

If you are working inside the Pulse repo:

```bash
npm install
```

This installs the `@pulse/node` workspace package for the demo backend. To use `@pulse/node` from another project, publish the package or link it locally and then:

```bash
npm install @pulse/node
```

### Initializing the client

Create a Pulse client at process startup:

```ts
import { createClient } from "@pulse/node";

const pulseClient = createClient({
  ingestUrl: process.env.PULSE_INGEST_URL ?? "http://localhost:8081/v1/engest",
  apiKey: process.env.PULSE_API_KEY ?? "dev-api-key",
  serviceName: "demo-backend-node",
  environment: process.env.NODE_ENV ?? "development"
});
```

Configuration fields:

- `ingestUrl`: HTTP endpoint of the Pulse ingestion server (`/v1/ingest`).
- `apiKey`: project API key (validated by the ingestion server).
- `serviceName`: logical name of the service emitting telemetry.
- `environment`: environment label (`development`, `staging`, `production`, etc.).
- `flushIntervalMs` (optional): how often to flush batched telemetry.
- `batchSize` (optional): max number of events per HTTP batch.
- `maxQueueSize` (optional): in-memory buffer size before old events are dropped.

### Express middleware

Use the built-in Express middleware to create a root span for each incoming request:

```ts
import express from "express";
import { createClient, createExpressMiddleware } from "@pulse/node";

const app = express();
const pulseClient = createClient({
  ingestUrl: "http://localhost:8081/v1/ingest",
  apiKey: "dev-api-key",
  serviceName: "demo-backend-node",
  environment: "development"
});

app.use(createExpressMiddleware(pulseClient));
```

The middleware:

- Starts a span named `http_request` for each request.
- Attaches `req.pulseTraceId` and `req.pulseSpanId` for downstream handlers.
- Ends the span when the response finishes and records the status code.

### Manual spans

Use `withSpan` to time arbitrary units of work:

```ts
app.get("/slow", async (_req, res) => {
  await pulseClient.withSpan("slow_handler", {}, async () => {
    const delay = 100 + Math.random() * 700;
    await new Promise((resolve) => setTimeout(resolve, delay));
    res.status(200).json({ status: "slow", delay: Math.round(delay) });
  });
});
```

You can also use `startSpan` / `end` directly for finer control:

```ts
const span = pulseClient.startSpan("custom_operation");
// ... do work ...
span.end();
```

### Structured logs

Use `log` to emit structured JSON logs, optionally associated with a trace/span:

```ts
pulseClient.log("error", "Request failed", {
  error: "Simulated error",
  route: "/error"
});
```

If you have access to a trace/span context (for example from `req.pulseTraceId`), pass it explicitly:

```ts
pulseClient.log(
  "info",
  "Handling request",
  { route: "/ok" },
  { traceId: req.pulseTraceId, spanId: req.pulseSpanId }
);
```

The SDK batches spans and logs in memory and periodically POSTs them to the ingestion server as a JSON envelope.

