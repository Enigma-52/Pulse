const items = [
  "p95 482ms", "checkout-svc", "trace 7f2a…91", "throughput 12.4k/s", "error rate 0.04%",
  "kafka lag 0", "clickhouse OK", "spans/min 218k", "logs ingested 4.1M", "anomaly cleared",
  "deploy v2.18.3", "region us-east-1", "saturation 31%",
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
