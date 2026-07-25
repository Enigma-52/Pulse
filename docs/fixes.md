# Pulse — Fixes & Polish Plan (no new features)

Incremental correctness and UX fixes across backend (`pulse/`), dashboard (`dashboard/`), and landing (`frontend/`). Same conventions as the roadmap: **one shippable commit per fix, one-liner message, compile-verified** (`go build ./...` / `npm run build`), no services started. Ordered by impact.

---

## Phase A — Correctness bugs (backend)

### A1. `fix: resolve alerts when a rule or service instance disappears`
`pulse/internal/alerting/evaluator.go`
- Bug: when a rule is deleted/disabled or a `group_by_service` instance stops producing results, `tick()` silently deletes the in-memory state **without inserting a resolved row** — the alert stays "firing" in `pulse_alerts` forever.
- Fix: on stale key, insert a resolved row (same alert id, `resolved_at = now`, message "no longer evaluated") and notify if the rule still exists; then delete state. Requires keeping the last-known rule/service per instance in `instanceState`.

### A2. `fix: order exception linked traces by recency`
`pulse/internal/query/store/exceptions.go`
- Bug: `GetExceptionGroup` selects linked traces with `ORDER BY trace_id` (alphabetical), so the "Recent traces" panel is not recent.
- Fix: `SELECT trace_id FROM exceptions WHERE ... GROUP BY trace_id ORDER BY max(timestamp) DESC LIMIT 20`.

### A3. `fix: propagate request context to store queries`
All handlers in `pulse/internal/query/handler/*.go`
- Bug: handlers call stores with `context.Background()`, so a client disconnect/timeout never cancels the ClickHouse query (wasted load, slow shutdown).
- Fix: mechanical replace with `r.Context()` across handlers (auth ones already do).

### A4. `fix: warn loudly when running with the default jwt secret`
`pulse/internal/query/handler/auth.go`
- Bug: falling back to `pulse-default-secret-change-me` is silent — production deployments won't notice.
- Fix: `log.Printf("WARNING: PULSE_JWT_SECRET not set, using insecure default — do not run this in production")` when the fallback is hit.

### A5. `fix: validate service and environment param lengths and reject absurd limits`
`pulse/internal/query/handler/` (small shared helper)
- Minor hardening: trim + cap string filter params (e.g. 256 chars), reject `minutes > 43200` (30 days) with 400 instead of running unbounded scans. One helper, applied in `ParseTraceFilters`, `parseLogFilters`, `parseMinutes`.

## Phase B — Broken/fragile dashboard functionality

### B1. `fix: log detail page loses the log on refresh`
`dashboard/src/pages/LogDetail.tsx`, `dashboard/src/lib/api.ts`, `Logs.tsx`
- Bug: LogDetail re-fetches 200 logs and searches for a **synthetic client-side id** — after refresh or new data the id no longer matches → "log not found"; also wrong when the log is older than the latest 200.
- Fix: make the log link self-describing — route to `/app/logs/:id` where id = `timestamp|span_id` (or pass the log via `location.state` with a timestamp+trace_id backend lookup fallback: reuse `GET /logs?trace_id=&start=&end=&limit=1`). No backend change needed.

### B2. `fix: redirect to login when the api returns 401`
`dashboard/src/lib/api.ts`, `dashboard/src/lib/auth.tsx`
- Bug: expired/invalid JWT (7-day expiry) makes every fetch return `[]` — the app quietly shows empty dashboards instead of re-authenticating.
- Fix: central `apiFetch()` wrapper used by all fetchers; on 401 it clears `pulse_token` and redirects to `/login` (guard against redirect loops on the login page). Mechanical adoption across fetch* functions.

### B3. `fix: header time range selector cannot show 7d selected`
`dashboard/src/components/AppLayout.tsx`
- Bug: the header uses `SHORT_RANGES` (no `7d`), but MetricDetail uses `TIME_RANGES` and can set the global range to `7d` — header then renders with nothing selected.
- Fix: header uses `TIME_RANGES` (or clamp: if global range isn't in the rendered set, show it appended). Simplest: use `TIME_RANGES` in the header.

### B4. `fix: traces page stats mislabel page-local numbers`
`dashboard/src/pages/Traces.tsx`
- Bug: "p50 duration" and "Errors" stat cards are computed from the current 50-row page but read as global; also the error card hardcodes `#EF5350` (style-guide violation).
- Fix: label cards "p50 (page)" / "errors (page)" or better, derive from `/traces/analytics` for the window; replace hardcoded hex with `status.error` from `colors.ts`.

### B5. `fix: search dropdown log results with no trace go nowhere useful`
`dashboard/src/components/GlobalSearch.tsx`
- Minor: log hits without a trace id land on `/app/logs` unfiltered. Route to `/app/logs?search=<title>` and have Logs.tsx read `search` from URL params on mount (it already has the input state).

### B6. `fix: alert rule form numeric fields accept NaN`
`dashboard/src/pages/AlertRuleForm.tsx`
- Bug: clearing the threshold input yields `Number("") = 0` silently; typing `e` can produce NaN sent to the API (400 with no field hint).
- Fix: keep threshold as string state, validate on save (`Number.isFinite`), show inline error under the field.

### B7. `fix: remove dead chrome in app shell`
`dashboard/src/components/AppLayout.tsx`
- The sidebar "Workspace / production ⌘K" button does nothing and advertises a shortcut that doesn't exist; the "All systems nominal" dot is static; the avatar is hardcoded "EM".
- Fix: remove the fake workspace button; derive avatar initials from the login email (store email in localStorage at login); wire the status dot to `/readyz` (poll every 60s) so "All systems nominal" is real — or drop it.

## Phase C — UI consistency & polish (dashboard)

### C1. `fix: adopt empty states across remaining pages`
`Logs.tsx`, `Metrics.tsx`, `Services.tsx`, `Dashboard.tsx`
- Swap bare "No logs found" / "No services found" text for the `EmptyState` component with per-signal onboarding hints (OTLP endpoint paths), matching Traces.

### C2. `fix: unify tooltip and axis styling via shared chart component`
`Dashboard.tsx`, `MetricDetail.tsx`, `DatabaseDetail.tsx`, `TraceAnalytics.tsx`
- The shared `TimeSeriesChart` exists but older charts still hand-roll slightly different tooltip borders/radii/font sizes. Migrate the straightforward single-series charts to it; leave the gradient area chart in MetricDetail if migration would regress visuals.

### C3. `fix: breadcrumb shows raw ids and ugly segments`
`dashboard/src/components/AppLayout.tsx`
- Trace/exception fingerprints render as 32–40 char hex in the breadcrumb. Truncate long segments (`abc123…`, max ~12 chars, mono font) and title-case known section names.

### C4. `fix: split vendor chunks to silence 800kb bundle warning`
`dashboard/vite.config.ts`
- Add `build.rollupOptions.output.manualChunks` separating `recharts`, `react`+`react-dom`+router, and radix/shadcn. Faster first load; removes the persistent build warning.

### C5. `fix: consistent loading skeletons instead of text`
Small shared `Skeleton` rows for tables (Traces/Logs/Services/Exceptions/Alerts) replacing "Loading X..." strings — keeps layout stable during refresh. (Optional last; purely cosmetic.)

## Phase D — Landing page fixes (`frontend/`)

### D1. `fix: remove lovable template og image and dead links`
`frontend/index.html`, `frontend/src/components/pulse/CTA.tsx`, `Footer.tsx`
- `og:image` / `twitter:image` still point at `lovable.dev` — replace with a real (or removed) image tag; `@pulsedev` twitter handle is fictional — drop it.
- CTA buttons are `href="#"` — point primary to the GitHub repo (`https://github.com/Enigma-52/Pulse`) and secondary to `#deploy`; Footer link lists are all `href="#"` — link to real anchors/GitHub or prune the columns.

### D2. `fix: align landing claims with reality`
`Hero.tsx`, `Deploy.tsx`, `Integrations.tsx` copy pass
- Verify port numbers (4321/3301), container count, and feature claims match the current README/compose; fix any stale "coming soon" or invented numbers in Stats/Marquee/Quote (the testimonial quote should not read as a real attributed person — mark as illustrative or remove attribution).

## Phase E — Deploy/docs correctness

### E1. `fix: local dev clickhouse password mismatch`
`docs/local-dev.md`
- Compose starts ClickHouse with password `pulse`, but `go run ./cmd/pulse` defaults `PULSE_CLICKHOUSE_PASSWORD=""` — the documented local loop fails at connect. Document `export PULSE_CLICKHOUSE_PASSWORD=pulse` (and the other env vars) in step 2.

### E2. `fix: pin healthcheck and document dashboard-only nginx route for new endpoints`
`deploy/docker-compose.yml`, `deploy/nginx/default.conf`
- Sanity pass: confirm `/api/` proxy covers new POST endpoints (`/query/sql`, alerts CRUD) with correct methods (nginx passes all methods — verify no `limit_except`), and add `client_max_body_size` note for OTLP payloads if defaulting to 1m (ingest bypasses nginx, but document it).

---

## Status (2026-07-16)
Delivered: A1–A5, B1–B7, C1, C3, C4, D1, D2, E1. E2 audited — nginx passes all methods, no change needed. Deferred: C2 (chart migration to TimeSeriesChart — visual-regression risk without runtime verification) and C5 (loading skeletons, cosmetic).

## Execution order
A1 → B1 → B2 (highest user-facing impact), then A2–A5, B3–B7, C1–C4, D1–D2, E1–E2, C5 last (optional).

## Verification
Compile-only per increment as before. B2/B1 additionally sanity-checked by reading the rendered route logic (no runtime available this session). Behavior fixes (A1, B1, B2) get a short note in `docs/todo.md` "Previously Tracked Items" if follow-up runtime verification is needed.

---

# Round 2 (2026-07-16) — plus deferred C2/C5

### R2-1. `fix: cap otlp request body size`
`pulse/internal/ingest/handler.go`
- Bug: `readAndNormalize` uses `io.ReadAll` with no limit — a single oversized POST can exhaust memory.
- Fix: wrap with `http.MaxBytesReader(w, r.Body, 32<<20)` (32 MB, generous for OTLP batches); return 413 on overflow.

### R2-2. `fix: overview request volume chart plots latency metric`
`dashboard/src/pages/Dashboard.tsx`
- Bug: the "request volume" area chart fetches the `http.server.duration` **metric** (latency, and only if the app happens to emit that exact name), and `if (s.length > 0)` keeps stale data when the range has none.
- Fix: derive request volume from traces via the existing `/services/timeseries` endpoint (sum across services per bucket); always set the series (clearing stale data).

### R2-3. `fix: support trace and fatal log levels in the ui`
`dashboard/src/lib/mockData.ts`, `dashboard/src/pages/Logs.tsx`, `LogDetail.tsx`
- Bug: `LogLevel` union is `info|warn|error|debug`, but the backend emits `trace` and `fatal` too — `levelStyle[l.level]` yields `undefined` className and the fatal chip filter doesn't exist.
- Fix: extend the union, add fatal (error-styled) and trace (muted) styles with a safe fallback, include fatal in the level chips.

### R2-4 (deferred C2). `fix: migrate database detail and logs charts to shared timeseries chart`
`dashboard/src/pages/DatabaseDetail.tsx`, `Logs.tsx`
- Unify the two DatabaseDetail charts and the logs level histogram onto `TimeSeriesChart` so tooltip/axis/grid styling stops drifting per page. MetricDetail's gradient area chart stays custom (intentional visual).

### R2-5 (deferred C5). `fix: add loading skeletons to table views`
new `dashboard/src/components/TableSkeleton.tsx`; `Traces.tsx`, `Logs.tsx`, `Exceptions.tsx`, `Databases.tsx`, `Alerts.tsx`
- Replace "Loading X..." text rows with shimmering skeleton rows so layout doesn't jump during refresh.

## Round 2 status
Delivered: R2-1 through R2-5 (including deferred C2 and C5). Bonus fix found during R2-2: `rangeToInterval` returns seconds, but the minute-based bucket endpoints (services/analytics/exceptions timeseries, logs histogram) were receiving it as minutes — added `rangeToIntervalMinutes` and fixed all callers.

---

# Round 3 — plan

### R3-1. `fix: dashboard summary returns nan on an empty window`
`pulse/internal/query/store/store.go` (`GetDashboardSummary`)
- **Confirmed bug:** `error_rate` is `countIf(...) * 100.0 / count()` with **no zero guard** — on an empty window ClickHouse yields `nan` (0/0), and `p99_latency` (`quantile` over zero rows) is also `nan`. `encoding/json` cannot marshal NaN, so `writeJSON` fails after already writing the 200 header → the Overview page gets a broken/empty body on a fresh install (exactly when a first impression matters).
- Fix: guard both like every other query already does — `if(count() = 0, 0, ...)` for error_rate and `if(count() = 0, 0, quantile(0.99)(duration_ms))` for p99. (Services/databases queries already have `if(trace_count = 0, ...)` guards — only this one was missed.)

### R3-2. `fix: metrics list ignores the selected time range`
`pulse/internal/query/store/store.go` (`GetMetricsList`), `handler/metrics.go`, `dashboard/src/lib/api.ts`, `Metrics.tsx`, `MetricDetail.tsx`
- **Confirmed bug:** the metrics list is hardcoded to `now() - INTERVAL 5 MINUTE` (delta vs the 5m before that). With the range selector on 24h, a metric that stopped emitting 10 minutes ago vanishes from the list — and MetricDetail (which resolves metadata via the same list) shows "No metrics data".
- Fix: `GetMetricsList(ctx, minutes)` — current window = `minutes`, delta compares the first vs second half of the window; handler reads `minutes` param (default 15); `fetchMetrics(minutes)` passes `rangeToMinutes(range)` from both pages.

### R3-3. `fix: normalize log severity text to canonical levels`
`pulse/internal/writer/writer.go` (`severityToLevel`)
- **Confirmed bug:** the writer stores `strings.ToLower(SeverityText)` verbatim — SDKs commonly send `WARNING`, `ERR`, `CRITICAL`, `Information` etc., which the UI has no styles/filters for (they render unstyled and are invisible to `level=error,warn` filters and the `error_count` alert aggregation which only matches `error|fatal`).
- Fix: map synonyms (`warning→warn`, `err→error`, `critical|emergency|alert→fatal`, `informational|information→info`, `verbose→debug`); anything unrecognized falls back to the severity-number mapping instead of raw text.

### R3-4. `fix: list timestamps ambiguous beyond 24h ranges`
`dashboard/src/lib/api.ts` (`formatTimestamp`)
- Bug: traces/logs lists show time-of-day only (`14:33:02.120`) — on a 7d range, rows from different days are indistinguishable.
- Fix: `formatTimestamp` prefixes `MMM dd` when the timestamp is not from today (e.g. `Jul 12 14:33:02`). One helper, all list views inherit it.

### R3-5. `fix: not found page matches app styling and links back`
`dashboard/src/pages/NotFound.tsx`
- Minor: template 404 uses `bg-muted` (off-theme) and links to `/` (marketing gate) with a full page reload.
- Fix: dark app styling (`bg-background` + `panel`), router `<Link>` to `/app`, keep it minimal.

### R3-6. `docs: reflect rounds in readme troubleshooting note`
`README.md`
- Add a short "Troubleshooting" line: empty dashboard right after install is expected until telemetry arrives; link `/readyz` and the local-dev env vars. Keeps first-run users from assuming R3-1-style breakage.

## Round 3 status
Delivered: R3-1 through R3-6.

---

# Round 4 — UX-focused small fixes

- **U1 `fix: add copy buttons for ids and stack traces`** — shared `CopyButton`; trace id on TraceDetail, fingerprint + stacktrace on ExceptionDetail, trace id on LogDetail. Ops workflows constantly copy these.
- **U2 `fix: persist auto-refresh interval across pages and sessions`** — `useAutoRefresh` reads/writes localStorage so the chosen cadence sticks.
- **U3 `fix: whole-row click navigation on traces and exceptions tables`** — rows navigate on click (inner links keep working); pointer cursor signals it.
- **U4 `fix: overview stat cards link to their pages`** — requests→traces, p99→analytics, error rate→traces?status=error, active traces→traces.
- **U5 `fix: reset scroll and set document titles on route change`** — SPA keeps scroll position across pages and the tab always says "Pulse"; add scroll-to-top + "Traces · Pulse"-style titles.
- **U6 `fix: pulse-branded svg favicon on both apps`** — replace template favicon with an inline SVG data-URI matching the primary-color activity mark.
- **U7 `fix: explore page remembers the last query`** — persist the SQL textarea to localStorage.

## Round 4 status
Delivered: U1–U7. Note: TraceDetail kept its existing icon-only copy button (dense UI); the shared labeled CopyButton is used on ExceptionDetail and LogDetail.
