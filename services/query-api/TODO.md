# Query API TODO

Updated: 2026-05-02

## Current

- Exposes `GET /healthz`.
- Exposes `GET /traces` (latest 100 records from ClickHouse).

## Next

- [ ] Add query filters: service, route, status, duration, time range.
- [ ] Add pagination/cursor support.
- [ ] Add trace detail endpoint by `trace_id`.
- [ ] Add aggregate endpoints (p95, error-rate, throughput).
- [ ] Add logs and metrics query endpoints once tables exist.
- [ ] Add request validation and consistent error payload contracts.
- [ ] Add response shape/versioning policy for UI compatibility.
