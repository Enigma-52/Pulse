const stats = [
  { k: "47s", l: "First trace, from zero" },
  { k: "1B+", l: "Spans / day per node" },
  { k: "<80ms", l: "Median query latency" },
  { k: "100%", l: "Open source, self-hosted" },
];

const Stats = () => (
  <section className="relative py-24 lg:py-32 border-b border-border">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {stats.map((s) => (
          <div key={s.k} className="bg-background p-8 lg:p-10">
            <div className="font-display text-5xl lg:text-7xl tracking-tighter">{s.k}</div>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Stats;
