# Worker Service TODO

Updated: 2026-05-02

## Current

- Consumes Kafka topic `traces_raw`.
- Creates ClickHouse `traces` table if missing.
- Inserts span batches into ClickHouse.

## Next

- [ ] Add DLQ handling for malformed/poison messages.
- [ ] Add bounded retry/backoff strategy with visibility.
- [ ] Introduce idempotency/dedup strategy for replay safety.
- [ ] Add metrics/logs table write paths (in addition to traces).
- [ ] Add batching controls and flush thresholds via env config.
- [ ] Add worker operational metrics (consume lag, write latency, failures).
- [ ] Improve schema evolution strategy for attributes/tags.
