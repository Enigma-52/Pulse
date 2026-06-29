const groups = [
  { h: "Languages", items: ["Node.js", "Go", "Python", "Java", ".NET", "Ruby", "Rust", "PHP"] },
  { h: "Protocols", items: ["OTLP/HTTP", "Protobuf", "JSON"] },
  { h: "Databases", items: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "ClickHouse", "SQLite"] },
  { h: "Frameworks", items: ["Express", "Gin", "Django", "Spring", "FastAPI", "Next.js"] },
];

const Integrations = () => (
  <section id="integrations" className="relative py-28 lg:py-36 border-b border-border">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
      <div className="grid lg:grid-cols-12 gap-10 mb-16">
        <div className="lg:col-span-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <span className="h-px w-8 bg-primary" /> Works with your stack
          </div>
        </div>
        <div className="lg:col-span-8">
          <h2 className="font-display text-5xl lg:text-6xl leading-[1.0] tracking-tight text-balance">
            Any language. Any framework. <span className="italic text-muted-foreground">If it has an OTel SDK, it works.</span>
          </h2>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {groups.map((g) => (
          <div key={g.h} className="bg-background p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-6">{g.h}</div>
            <ul className="space-y-3">
              {g.items.map((i) => (
                <li key={i} className="flex items-center justify-between text-foreground/90 hover:text-primary transition-colors group cursor-default">
                  <span>{i}</span>
                  <span className="font-mono text-xs text-muted-foreground group-hover:text-primary transition-colors">→</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Integrations;
