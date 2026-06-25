# Node SDK TODO

Updated: 2026-05-02

## Current

- Supports span creation (`startSpan`, `withSpan`).
- Supports log buffering.
- Periodic batch flush to ingestion endpoint.
- Express middleware adds request trace context.

## Next

- [x] Add retry with backoff for failed flushes.
- [x] Add flush failure callback/hooks for host apps.
- [x] Add graceful shutdown flush guarantee and timeout controls.
- [ ] Add configurable sampling strategy.
- [ ] Add optional OTLP compatibility export mode.
- [ ] Add stronger typing/validation for attribute and log field payloads.
- [ ] Add tests for queue limits, flush timing, and middleware lifecycle.

yo
