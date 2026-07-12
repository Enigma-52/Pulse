const features = [
  {
    n: "01",
    t: "Distributed Tracing",
    d: "End-to-end request tracing across services. Flamegraph, waterfall view, span attributes, and service breakdown. Filter by route, duration, or status.",
    tags: ["flamegraph", "spans", "waterfall"],
    accent: "trace",
  },
  {
    n: "02",
    t: "Log Management",
    d: "Structured log ingestion with full-text search. Stream and grouped views, level filters, and automatic trace-log correlation.",
    tags: ["search", "levels", "trace-link"],
    accent: "log",
  },
  {
    n: "03",
    t: "Metrics Explorer",
    d: "Time-series charts, queryable metric explorer, and per-service breakdown. Track counters, gauges, and histograms from any OTel SDK.",
    tags: ["time-series", "gauges", "counters"],
    accent: "metric",
  },
  {
    n: "04",
    t: "Database Monitoring",
    d: "Auto-detects database calls from trace attributes. Tracks query latency, throughput, and errors for PostgreSQL, MySQL, MongoDB, Redis, and more.",
    tags: ["postgresql", "slow-queries", "throughput"],
    accent: "metric",
  },
  {
    n: "05",
    t: "Alerting",
    d: "Threshold rules on traces, logs, and metrics evaluated continuously. Firing and resolved states with Slack and webhook notifications built in.",
    tags: ["thresholds", "slack", "webhooks"],
    accent: "error",
  },
  {
    n: "06",
    t: "Exception Monitoring",
    d: "Auto-captured from OTel exception events and grouped by fingerprint. Stack traces, frequency charts, and one-click jumps to the originating trace.",
    tags: ["fingerprints", "stacktraces", "grouping"],
    accent: "error",
  },
  {
    n: "07",
    t: "Service Map",
    d: "All instrumented services at a glance. Latency percentiles (p50/p95/p99), error rates, request counts, and last-seen timestamps.",
    tags: ["p99", "error-rate", "services"],
    accent: "trace",
  },
  {
    n: "08",
    t: "OTLP Native",
    d: "Accepts OTLP/HTTP with protobuf and JSON. No custom SDK needed — point any standard OpenTelemetry exporter at Pulse and go.",
    tags: ["otlp", "protobuf", "json"],
    accent: "log",
  },
  {
    n: "09",
    t: "Single Binary",
    d: "One Go process handles OTLP ingestion, in-process pipeline, ClickHouse writing, and the query API. All on port 4321.",
    tags: ["go", "port-4321", "pipeline"],
    accent: "metric",
  },
  {
    n: "10",
    t: "ClickHouse Storage",
    d: "Columnar storage built for observability workloads. Full OTLP fidelity — resource attributes, scope, links, events all preserved.",
    tags: ["columnar", "full-fidelity"],
    accent: "metric",
  },
  {
    n: "11",
    t: "Retention & Analytics",
    d: "Per-signal TTL retention with a live data-usage view. Trace analytics with group-by breakdowns, error-rate charts, and ad hoc SQL exploring.",
    tags: ["ttl", "sql-explore", "analytics"],
    accent: "log",
  },
  {
    n: "12",
    t: "One-Command Deploy",
    d: "Two containers: Pulse and ClickHouse. Docker Compose up and you're running. From clone to first trace in under a minute.",
    tags: ["docker", "self-hosted"],
    accent: "trace",
  },
];

const accentMap: Record<string, string> = {
  trace: "bg-signal-trace",
  log: "bg-signal-log",
  metric: "bg-signal-metric",
  error: "bg-signal-error",
};

const Features = () => (
  <section id="features" className="relative py-28 lg:py-40 border-b border-border">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
      <div className="grid lg:grid-cols-12 gap-10 mb-20">
        <div className="lg:col-span-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <span className="h-px w-8 bg-primary" /> What you get
          </div>
        </div>
        <div className="lg:col-span-8">
          <h2 className="font-display text-5xl lg:text-7xl leading-[1.0] tracking-tight text-balance">
            Everything you need.
            <br />
            <span className="italic text-muted-foreground">Nothing you don't.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Traces, logs, metrics, exceptions, alerting, and database monitoring in one platform —
            without the operational overhead, the licensing math, or the vendor lock-in.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
        {features.map((f) => (
          <article
            key={f.n}
            className="group relative bg-background p-8 lg:p-10 hover:bg-surface-1 transition-colors duration-500 min-h-[280px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <span className="font-mono text-xs text-muted-foreground">{f.n}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${accentMap[f.accent]} opacity-70 group-hover:opacity-100 transition-opacity`} />
            </div>
            <h3 className="font-display text-3xl tracking-tight mb-4">{f.t}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">{f.d}</p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {f.tags.map((t) => (
                <span key={t} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
            <div className="absolute left-0 bottom-0 h-px w-0 bg-primary group-hover:w-full transition-all duration-700" />
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
