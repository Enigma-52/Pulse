import telemetry from "@/assets/section-telemetry.jpg";

const stages = [
  { k: "SDK", d: "Node, Go, Python — spans, logs, metrics with batching and middleware." },
  { k: "Ingestion API", d: "Project-scoped, validated, rate-limited, schema-contracted." },
  { k: "Kafka", d: "Decoupled stream. Backpressure-safe. Replay on demand." },
  { k: "Workers", d: "Transform, enrich, normalize into analytics-ready records." },
  { k: "ClickHouse", d: "Columnar storage tuned for time-series and high cardinality." },
  { k: "Query API", d: "Sub-100ms aggregations. p95, error rate, throughput. Anywhere." },
];

const Pipeline = () => (
  <section id="pipeline" className="relative py-28 lg:py-40 border-b border-border overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <img src={telemetry} alt="" loading="lazy" width={1600} height={1100} className="w-full h-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-background/70" />
    </div>

    <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10">
      <div className="max-w-3xl mb-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-3 mb-6">
          <span className="h-px w-8 bg-primary" /> The pipeline
        </div>
        <h2 className="font-display text-5xl lg:text-7xl leading-[1.0] tracking-tight text-balance">
          From a span emitted in your service —
          <span className="italic text-muted-foreground"> to a chart in your dashboard</span> — in one second.
        </h2>
      </div>

      <ol className="relative space-y-px bg-border">
        {stages.map((s, i) => (
          <li key={s.k} className="bg-background/80 backdrop-blur grid grid-cols-12 gap-6 p-6 lg:p-8 items-baseline group hover:bg-surface-1 transition-colors">
            <div className="col-span-2 lg:col-span-1 font-mono text-xs text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="col-span-10 lg:col-span-3 font-display text-3xl lg:text-4xl tracking-tight">
              {s.k}
            </div>
            <div className="col-span-12 lg:col-span-7 text-muted-foreground text-sm lg:text-base">
              {s.d}
            </div>
            <div className="hidden lg:flex col-span-1 justify-end">
              <span className="font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default Pipeline;
