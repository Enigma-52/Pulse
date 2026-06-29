const cols = [
  { h: "Product", items: ["Traces", "Logs", "Metrics", "Alerts", "Dashboards"] },
  { h: "Platform", items: ["SDKs", "Ingestion API", "Query API", "ClickHouse", "Self-host"] },
  { h: "Resources", items: ["Docs", "Quickstart", "Changelog", "Roadmap", "Blog"] },
  { h: "Community", items: ["GitHub", "Discord", "Contributors", "Security", "Brand"] },
];

const Footer = () => (
  <footer className="border-t border-border bg-surface-1">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20">
      <div className="grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="font-display text-3xl">Pulse</span>
          </div>
          <p className="mt-5 text-sm text-muted-foreground max-w-xs">
            Open-source, developer-first observability. Built so engineers can ship — and sleep.
          </p>
          <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            MIT licensed · v0.4.2
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.h} className="lg:col-span-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-5">{c.h}</div>
            <ul className="space-y-3 text-sm">
              {c.items.map((i) => (
                <li key={i}><a href="#" className="text-foreground/80 hover:text-primary transition-colors">{i}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-20 pt-8 border-t border-border flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground font-mono uppercase tracking-[0.18em]">
        <span>© 2026 Pulse Labs</span>
        <span>Made for engineers, in the dark</span>
      </div>
    </div>
  </footer>
);

export default Footer;
