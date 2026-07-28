# Pulse → SigNoz-Level: Incremental Build Roadmap

## Context
Pulse is a self-hosted observability platform: single Go binary (`pulse/`, gorilla/mux, OTLP/HTTP ingest + query API on :4321) + ClickHouse + React dashboard (`dashboard/`) + marketing landing (`frontend/`). The ingest→store→query→visualize core works; `docs/todo.md` lists the gaps vs SigNoz. Goal: close those gaps incrementally — **each increment = one shippable commit**. Every increment leaves `go build ./...` (in `pulse/`) and `npm run build` (in `dashboard/`/`frontend/` when touched) green. Tick items off as they land.

## Key codebase facts (reuse these patterns)
- Routes: `pulse/internal/server/server.go` — public OTLP + auth routes; protected subrouter with `handler.AuthMiddleware` (JWT HS256, `PULSE_JWT_SECRET`). New endpoints = handler method on `handler.Handler` + store method on `store.Store` + route line.
- DDL: `pulse/internal/writer/store.go` `EnsureTables` — idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS`, errors logged not fatal. No TTL anywhere yet.
- Query style: manual SQL with `?` args (`pulse/internal/query/store/store.go`, `databases.go`); time filter `now() - INTERVAL ? MINUTE` or `ParseTimeParam`; envelope `{items,limit,offset}` via `handler/response.go` `writeJSON/writeJSONError`; models in `query/model/model.go`.
- OTel exception data already arrives as span events (`events_json`, event name `exception` with `exception.type/message/stacktrace`) in `writer/writer.go`.
- Dashboard: pages use `useState/useCallback/useEffect` + hand-written `fetch*` in `dashboard/src/lib/api.ts` (API_BASE `/api`, `authHeaders()`); shared `TimeRangeSelector` (`rangeToMinutes`), `useAutoRefresh` + `AutoRefreshPicker`, `StatCard`, `src/lib/colors.ts` (`chartPalette`, `serviceColor`, `fmtMs/fmtPct` — never hardcode hex, see `dashboard/STYLE_GUIDE.md`). Routes in `src/App.tsx` under `/app`; nav array in `src/components/AppLayout.tsx`. recharts for charts.
- Landing: `frontend/src/pages/Index.tsx` composes `frontend/src/components/pulse/` sections (Nav→Hero→Marquee→Stats→Features→Pipeline→Deploy→Quote→Integrations→CTA→Footer).
- Deploy: `deploy/docker-compose.yml` (PULSE_JWT_SECRET defaults to `change-me-in-production`, override before real use); nginx proxies `/api/` → pulse:4321.

## Key design decisions
1. **Alert/channel storage in ClickHouse** — `ReplacingMergeTree(updated_at) ORDER BY (id)`, soft-delete `deleted` flag, reads use `FINAL WHERE deleted = 0`. Tiny row counts; avoids adding SQLite/Postgres.
2. **Alert rule schema**: `id, name, signal(traces|logs|metrics), metric_name, service (optional filter), group_by_service UInt8, aggregation(count|avg|p95|p99|error_rate|error_count|value_avg|value_max), operator(gt|gte|lt|lte), threshold Float64, window_minutes UInt32, channel_ids Array(String), enabled, deleted, created_at, updated_at`. Each (rule, service) pair is a distinct alert instance.
3. **Evaluator**: single goroutine, ticker (env `PULSE_ALERT_EVAL_INTERVAL_SECONDS`, default 30, 0 disables). Loads enabled rules per tick, one aggregation query per rule over trailing window. In-memory state map keyed `ruleID|service`; normal→firing inserts `pulse_alerts` row + notifies; firing→normal re-inserts same id with status resolved + notifies. No re-notify while continuously firing. State lost on restart → still-breaching rule re-fires (documented, acceptable v1).
4. **Notification channels** in `pulse_notification_channels` table (UI-CRUDable): types webhook (POST alert JSON to url), slack (`{"text": ...}` to webhook url), email (config stored, delivery logs "not implemented" placeholder).
5. **Exceptions: dedicated `exceptions` table written at ingest time** (writer already parses span events — ~50-line change; query-time JSON extraction would force full trace-table scans). No backfill of old data (documented). Fingerprint = `sha1(type + "\x00" + normalizedMessage + "\x00" + topFrame)` hex, computed in Go; normalizedMessage strips digits/hex/UUIDs.
6. **Retention** via env `PULSE_RETENTION_{TRACES,LOGS,METRICS,EXCEPTIONS}_DAYS` (0 = forever), applied in `EnsureTables` as idempotent `ALTER TABLE ... MODIFY TTL`.
7. **SQL passthrough: yes, hard-guarded** — auth-protected POST, SELECT/WITH only after comment-stripping, single statement, ClickHouse settings `readonly=1`, `max_result_rows=1000`, `max_execution_time=10`.
8. **OTLP/gRPC receiver: deferred** — grpc-go dependency + second port not justified while OTLP/HTTP covers all SDKs and the Collector; recorded in todo.md.
9. **Keep existing patterns**: no react-query migration; group_by/column inputs always whitelist-validated, never interpolated.

---

## Status (2026-07-16)
Phases 0–8 delivered: ops hardening, alerting end-to-end, exception monitoring, retention/usage, trace analytics, unified search + SQL explore, external calls, global time range/env selectors, logs histogram, traces pagination/search, service sparklines, metric attribute filters, landing refresh, CI. Deferred: OTLP/gRPC receiver, email delivery, alert silencing/routing, duration histogram brush.

## Increments (one commit each, in order)

### Phase 0 — Ops/security quick wins
0. **`docs: add signoz-parity build roadmap`** — copy this plan into the repo as `docs/roadmap.md` (first commit, so the roadmap lives with the code; tick items off as increments land).
1. **`chore: set jwt secret in compose and make pipeline capacity configurable`** — `deploy/docker-compose.yml` (add `PULSE_JWT_SECRET: ${PULSE_JWT_SECRET:-change-me-in-production}`), `pulse/internal/config/config.go` (add `PipelineCap` from `PULSE_PIPELINE_CAP`, default 10000), `pulse/cmd/pulse/main.go` (use `cfg.PipelineCap`).
2. **`feat: add readyz endpoint that pings clickhouse`** — `store.Ping(ctx)` wrapping `conn.Ping`; handler returns 200/503; register public `GET /readyz` in server.go.
3. **`feat: add rate limiting to otlp ingest endpoints`** — in-process token bucket (no new deps), env `PULSE_INGEST_RPS` (0 = disabled), wraps only `/v1/*`, 429 + `Retry-After: 1`.
4. **`docs: document ops env vars and readiness probe`** — env var table + `/readyz` vs `/healthz` in `docs/architecture.md`, README.

### Phase 1 — Alerting end-to-end
5. **`feat: add alert rules, alerts, and notification channels tables`** — DDL in `writer/store.go` EnsureTables (`pulse_alert_rules`, `pulse_alerts` (id, rule_id, rule_name, service, status firing|resolved, value, threshold, fired_at, resolved_at, message, updated_at), `pulse_notification_channels` (id, name, type, config_json, deleted, timestamps)); Go structs in `query/model/model.go`.
6. **`feat: add alert rule crud store and api`** — new `query/store/alerts.go` (List/Get/Insert/Delete via versioned inserts + FINAL reads), new `query/handler/alerts.go` (GET/POST `/alerts/rules`, GET/PUT/DELETE `/alerts/rules/{id}`; validate enums, window 1–1440; ids via crypto/rand hex), routes in server.go.
7. **`feat: add notification channel crud and alert history endpoints`** — channels CRUD (`/alerts/channels`...; validate type + config_json url), `GET /alerts` history (status/rule_id/time filters, envelope) + `GET /alerts/{id}`.
8. **`feat: add threshold aggregation queries for alert evaluation`** — `EvaluateRule(ctx, rule) ([]RuleResult{Service, Value}, error)` in `store/alerts.go`: per-signal SQL (traces count/avg/p95/p99/error_rate; logs count/error_count via `level IN ('error','fatal')`; metrics avg/max filtered by name), optional service filter, `GROUP BY service` when group_by_service.
9. **`feat: add background alert evaluator with firing and resolved states`** — new `pulse/internal/alerting/evaluator.go` per decision 3; config `PULSE_ALERT_EVAL_INTERVAL_SECONDS`; `go evaluator.Run(ctx)` in main.go; `Notify` hook nil-safe.
10. **`feat: add webhook and slack notifiers`** — new `alerting/notify.go` (http.Client 5s timeout; webhook = full alert JSON; slack = text payload with FIRING/RESOLVED formatting; email = logged placeholder); failures logged, never block eval; wired in main.go.
11. **`feat: add alerts page with rule crud ui`** — api.ts fetchers/types; new `dashboard/src/pages/Alerts.tsx` (tabs Rules | History | Channels, rules table with enable toggle/edit/delete) + `AlertRuleForm.tsx` (`/app/alerts/rules/new`, `/:id/edit`; selects for signal/aggregation/operator, threshold/window inputs, channel multiselect); routes in App.tsx; nav entry (Bell icon) in AppLayout.tsx.
12. **`feat: add alert history and channel management ui`** — History tab (status pills, value vs threshold, timestamps, TimeRangeSelector + useAutoRefresh, row → new `AlertDetail.tsx` with links to rule + offending signal); Channels tab (list + inline create/edit form, delete with confirm).
13. **`docs: document alerting and update todo`** — architecture (evaluator loop, restart caveat, schemas); check todo boxes; README.

### Phase 2 — Exception monitoring
14. **`feat: extract exception events into exceptions table at write time`** — DDL `exceptions` MergeTree ORDER BY (service, fingerprint, timestamp) with type/message/stacktrace/fingerprint FixedString(40)/trace_id/span_id/route/attrs; writer detects `event.Name == "exception"` in span-event loop, computes fingerprint (sha1 helper + message normalization regex), batch-inserts alongside traces. Files: `writer/store.go`, `writer/writer.go`, `writer/model.go`.
15. **`feat: add exceptions query store with fingerprint grouping`** — new `query/store/exceptions.go`: `ListExceptionGroups` (GROUP BY fingerprint: any(type/message/service), count, min/max timestamp), `GetExceptionGroup` (summary + latest stacktrace + ≤20 recent trace_ids), `ExceptionFrequency` (`toStartOfInterval` buckets); models.
16. **`feat: add exceptions api endpoints`** — new `query/handler/exceptions.go`: `GET /exceptions` (time/service/q/limit), `GET /exceptions/{fingerprint}`, `GET /exceptions/{fingerprint}/timeseries`; routes.
17. **`feat: add exceptions list page`** — api.ts fetchers; new `pages/Exceptions.tsx` (type/message/service badge/occurrences/first-last seen, search + filters + auto-refresh); route + nav entry (Bug icon).
18. **`feat: add exception detail page with stacktrace and linked traces`** — new `pages/ExceptionDetail.tsx`: StatCards, recharts frequency chart (chartPalette), scrollable mono stacktrace panel, linked traces → `/app/traces/:id`.
19. **`docs: document exception pipeline and update todo`** — rationale, fingerprint formula, no-backfill caveat.

### Phase 3 — Retention & data usage
20. **`feat: add env-configurable ttl retention for signal tables`** — config `Retention{TracesDays,LogsDays,MetricsDays,ExceptionsDays}` from `PULSE_RETENTION_*_DAYS`; `EnsureTables` applies `ALTER TABLE ... MODIFY TTL` when >0; commented examples in compose.
21. **`feat: add data usage stats endpoint`** — new `store/usage.go` + `handler/usage.go`: `GET /usage` from `system.parts` (rows, bytes_on_disk, min/max time per table) + configured retention days per signal.
22. **`feat: add settings page with data usage and retention`** — new `pages/Settings.tsx` (per-signal panels: rows, human bytes, oldest/newest, retention badge or env-var hint); nav entry; check todo boxes.

### Phase 4 — Trace analytics
23. **`feat: add trace aggregation and analytics endpoints`** — new `store/analytics.go` + `handler/analytics.go`: `GET /traces/analytics?group_by=service|route|name` (count/avg/p95/p99/error_rate per group, whitelist-validated group_by), `GET /traces/analytics/timeseries?metric=&group_by=service&interval=` (toStartOfInterval, top-8 groups), `GET /traces/slowest?limit=` (root spans by duration).
24. **`feat: add analytics tab to traces page`** — Traces.tsx List|Analytics toggle (`?view=analytics`); new `components/TraceAnalytics.tsx` (group-by selector, sortable aggregate table with fmtMs/fmtPct, error-rate-over-time lines via serviceColor, slowest-traces panel).
25. **`docs: record trace analytics endpoints and todo progress`**.

### Phase 5 — Query & exploration
26. **`feat: add unified cross-signal search endpoint`** — new `store/search.go` + `handler/search.go`: `GET /search?q=&minutes=` — exact trace_id, service prefix, route/name ILIKE, log message ILIKE, metric name ILIKE, exception type/message ILIKE (LIMIT 5 each); flat ranked `{results:[{type,id,title,subtitle,timestamp}]}`.
27. **`feat: wire global search into dashboard header`** — new `components/GlobalSearch.tsx` (250ms debounce, grouped dropdown, arrow/enter/escape keys, `/` shortcut), replaces placeholder in AppLayout.tsx; routes per result type.
28. **`feat: add guarded sql passthrough endpoint`** — new `store/rawsql.go` + `handler/rawsql.go`: `POST /query/sql` per decision 7; response `{columns, rows, rowCount}` via `rows.Columns()` + generic scan.
29. **`feat: add explore page for ad hoc sql queries`** — new `pages/Explore.tsx` (mono textarea, Cmd+Enter run, dense results table, error panel, canned example queries, read-only caption); nav entry (Terminal icon); todo boxes.

### Phase 6 — APM polish
30. **`feat: add external api calls endpoint from client spans`** — new `store/external.go` + `handler/external.go`: spans `kind='client'` without `db.system`, group by host (`server.address` → `net.peer.name` → url host); count/avg/p95/error rate; `GET /external` + `GET /services/{service}/external`. Mirrors `databases.go` pattern.
31. **`feat: add external calls page and service endpoint breakdown`** — new `pages/External.tsx` (host table, Globe nav icon); ServiceDetail.tsx gains "Endpoints" panel (reuses `/traces/analytics?group_by=route&service=X`) + "External calls" panel.

### Phase 7 — UX, landing, docs, CI
32. **`feat: add empty states and functional header time range`** — new `components/EmptyState.tsx` (icon/title/hint/action, e.g. "point your OTel exporter at /v1/traces"); new `lib/timeRange.tsx` TimeRangeProvider context; header button becomes live TimeRangeSelector; pages default from context; mechanical EmptyState swap across pages.
33. **`feat: update landing page with alerting and exceptions`** — `frontend/src/components/pulse/Features.tsx` (add Alerting/Exceptions/Retention cards), new `Alerting.tsx` section between Features and Pipeline in Index.tsx, refresh Stats.tsx claims.
34. **`docs: sweep todo, record grpc deferral, refresh readme`** — check all delivered boxes; explicit gRPC-deferred note; README feature list + architecture diagram + local-dev env vars.
35. **`chore: add ci workflow building backend and frontends`** — `.github/workflows/build.yml`: `go build ./...` + `go vet ./...` in pulse/; `npm ci && npm run build` in dashboard/ and frontend/.

### Phase 8 — Enhancements to existing pages and API layer (search, charts, filters)
36. **`feat: add logs histogram endpoint and level filters`** — `store/store.go`/new `store/loganalytics.go` + `handler/logs.go`: `GET /logs/histogram?interval=` returning `toStartOfInterval` buckets with per-level counts (`countIf(level='error')` etc.); extend `GET /logs` filters: multi-level (`level=error,warn`), `trace_id`, `environment`, `q` searches message + attributes_json.
37. **`feat: add stacked level histogram and filter chips to logs page`** — `pages/Logs.tsx`: recharts stacked bar chart above the stream (colors from `logLevelStyle`/colors.ts), clickable bars set time window; level filter chips (multi-select), service select, trace-id input; active-filter chip bar with clear-all.
38. **`feat: add environment and kind filters to traces api and total counts`** — `handler/traces.go` ParseTraceFilters + `store/store.go` buildTraceQuery: `environment`, `kind`, `name` params; list responses gain `total` (COUNT() over same WHERE) for real pagination; same `total` added to logs list.
39. **`feat: add duration histogram brush and sortable columns to traces page`** — `pages/Traces.tsx`: duration histogram (existing endpoint or new buckets from `/traces/analytics`) with click-drag min/max duration selection feeding `min_duration_ms/max_duration_ms`; sortable table headers (duration, start time, service); pagination controls using `total`; filters synced to URL searchParams (shareable links).
40. **`feat: add per-service sparkline series endpoint`** — new store/handler method: `GET /services/timeseries?interval=` returning request-count buckets per service (top N) in one query; reuse for Services page and Dashboard.
41. **`feat: add sparklines and sorting to services page`** — `pages/Services.tsx`: inline request-rate sparkline per row (recharts, `serviceColor`), sortable columns (reqs, p95, error rate), error-rate threshold coloring; Dashboard.tsx top-services panel uses same series.
42. **`feat: add shared timeseries chart component and fix statcard palette`** — new `components/TimeSeriesChart.tsx` (recharts wrapper: area/line/stacked-bar modes, chartPalette colors, shared tooltip/axis styling per STYLE_GUIDE); refactor Dashboard/MetricDetail/DatabaseDetail/Logs charts to use it; fix `StatCard.tsx` hardcoded `hsl(var(--chart-1))` → colors.ts value (style-guide violation).
43. **`feat: add attribute filtering to metrics api and label breakdown ui`** — `handler/metrics.go` + store: `GET /metrics/{name}/series` accepts `attr_key/attr_value` filter and `GET /metrics/{name}/attributes` returns top attribute keys/values (JSONExtract + GROUP BY); `pages/MetricDetail.tsx`: label filter selects + per-label series overlay (multi-line via chartPalette).
44. **`feat: add environment selector across dashboard`** — backend: `environment` param accepted on services/dashboard-summary/databases endpoints (traces/logs done in #38); new `GET /environments` (distinct from traces); UI: environment dropdown in AppLayout header (context alongside TimeRangeProvider), pages pass it through fetchers.
45. **`feat: add text search inputs to traces and services pages`** — traces: search box filtering by route/name (`q` param added to `/traces` matching route/name ILIKE); services: client-side name filter input; both debounced 250ms, URL-synced.

## Verification
- After every increment: `cd pulse && go build ./...` (and `go vet ./...`); `cd dashboard && npm run build` when dashboard touched; `cd frontend && npm run build` when landing touched. Commit only when green.
- No services started; no runtime testing this session (deferred per user). SQL correctness relies on mirroring existing proven query patterns; runtime verification later via `docker compose up` + OTel sample app.
- Commits: one-liner messages as listed, no co-author trailer.
