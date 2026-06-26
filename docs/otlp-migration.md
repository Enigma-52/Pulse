# Migrate to OTLP — remove custom SDK

## What changes

### Remove
- `sdk/` directory entirely
- `docs/sdk-node.md`
- SDK references in `README.md` and `docs/local-dev.md`

### Rework: ingestion service
The main work. Replace the custom envelope parser with an OTLP/HTTP receiver.

- Add endpoint `POST /v1/traces` (OTLP HTTP/JSON)
- Add endpoint `POST /v1/logs` (OTLP HTTP/JSON)
- Add endpoint `POST /v1/metrics` (OTLP HTTP/JSON)
- Map OTLP structs → internal structs → Kafka (same pipeline, untouched after this point)
- Use `go.opentelemetry.io/proto/otlp` to parse — no hand-rolling the format
- Keep `POST /v1/ingest` alive temporarily if needed, remove once OTLP is confirmed working

### Rework: worker
Likely minor. Internal structs may need field adjustments to match what OTLP provides (e.g. `TraceId` is 16-byte hex in OTLP vs whatever the SDK used). ClickHouse schema probably stays the same.

### No change
- Kafka pipeline
- ClickHouse schema (verify field names match after ingestion rework)
- Query API
- Dashboard UI

## What users get instead of the SDK

A config snippet per language — e.g. for Node:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:8081/v1/traces",
    headers: { "x-pulse-api-key": "your-api-key" },
  }),
});
sdk.start();
```

Same for Python, Go, etc. — just the exporter URL changes.

## Order of work

1. Rework ingestion to accept OTLP
2. Verify worker + ClickHouse fields align
3. Test with an OTel-instrumented app end-to-end
4. Remove `sdk/` and update docs
