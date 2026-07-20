const items = [
  "OTLP native", "single binary", "port 4321", "traces", "logs", "metrics",
  "exceptions", "alerting", "database monitoring", "ClickHouse", "flamegraph",
  "service map", "slow queries", "open source", "self-hosted", "MIT licensed",
];

const Marquee = () => (
  <section className="relative border-y border-border bg-surface-1/60 overflow-hidden py-4">
    <div className="flex whitespace-nowrap animate-ticker">
      {[...items, ...items].map((it, i) => (
        <span key={i} className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mx-8 flex items-center gap-3">
          <span className="h-1 w-1 rounded-full bg-primary" /> {it}
        </span>
      ))}
    </div>
  </section>
);

export default Marquee;
