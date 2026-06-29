const features = [
  {
    n: "01",
    t: "Unified Telemetry",
    d: "Traces, logs and metrics live in one shared model. Pivot from a service-level trend down to a single failing request without leaving context.",
    tags: ["traces", "logs", "metrics", "tags"],
    accent: "trace",
  },
  {
    n: "02",
    t: "Request Flow Tracing",
    d: "End-to-end spans across services. Find bottlenecks in a hierarchy, search by route, duration, status — drill into the failing edge.",
    tags: ["spans", "p95", "errors"],
    accent: "trace",
  },
  {
    n: "03",
    t: "Query & Analytics",
    d: "Filter, aggregate, and explore observability data backed by ClickHouse. p95, error rate, throughput — answered in milliseconds.",
    tags: ["clickhouse", "p95", "rps"],
    accent: "metric",
  },
  {
    n: "04",
    t: "Logs & Metrics",
    d: "Structured ingestion, fast search, and time-range analysis. Combined trace/log/metric context for incident triage.",
    tags: ["structured", "search"],
    accent: "log",
  },
  {
    n: "05",
    t: "Streaming Pipeline",
    d: "SDK → Ingestion API → Kafka → Workers → ClickHouse. Decoupled by design. Replayable, observable, hardened against backpressure.",
    tags: ["kafka", "workers", "batch"],
    accent: "metric",
  },
  {
    n: "06",
    t: "ClickHouse Storage",
    d: "Time-series and high-cardinality workloads done right. Bulk writes, analytical reads, schema evolution for traces, metrics, logs.",
    tags: ["columnar", "ttl"],
    accent: "metric",
  },
  {
    n: "07",
    t: "Operator Dashboard",
    d: "Service-centric, incident-first surfaces. Trace exploration, query workflows, and observability built around time-to-answer.",
    tags: ["ui", "service-view"],
    accent: "trace",
  },
  {
    n: "08",
    t: "One-Command Deploy",
    d: "Bundled Docker Compose: ingestion, processing, storage, API, UI. Local-first dev loop. From clone to first span in under a minute.",
    tags: ["docker", "self-hosted"],
    accent: "metric",
  },
  {
    n: "09",
    t: "Frictionless SDKs",
    d: "Node SDK with spans, logs, batching and middleware tracing. Multi-language coverage on the way, with a consistent telemetry envelope.",
    tags: ["node", "go", "python"],
    accent: "log",
  },
  {
    n: "10",
    t: "Reliable by Default",
    d: "Project-scoped API keys, validation, rate limits, retries and dead-letter queues. Operational metrics for the platform itself.",
    tags: ["dlq", "rate-limits"],
    accent: "error",
  },
  {
    n: "11",
    t: "Alerts & Anomalies",
    d: "Baseline detection on latency and error spikes. Threshold rules, notification channels, and AI-assisted summarisation.",
    tags: ["alerts", "ai-summary"],
    accent: "error",
  },
  {
    n: "12",
    t: "Open Ecosystem",
    d: "OTLP-compatible direction, ChatOps for Slack and Discord, embeddable status surfaces, and a roadmap toward synthetics and cost.",
    tags: ["otlp", "slack", "embed"],
    accent: "log",
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
            <span className="h-px w-8 bg-primary" /> Killer features
          </div>
        </div>
        <div className="lg:col-span-8">
          <h2 className="font-display text-5xl lg:text-7xl leading-[1.0] tracking-tight text-balance">
            Twelve surfaces.
            <br />
            <span className="italic text-muted-foreground">One operational truth.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Everything an on-call engineer needs at 03:00 — without the tab graveyard,
            the licensing math, or the vendor lock-in.
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
