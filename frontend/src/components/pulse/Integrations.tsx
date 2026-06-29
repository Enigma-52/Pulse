const groups = [
  { h: "Protocols", items: ["OTLP gRPC", "OTLP HTTP", "Prom remote-write", "Statsd", "Syslog", "Fluent"] },
  { h: "Languages", items: ["Node.js", "Go", "Python", "Rust", "Java", "Ruby"] },
  { h: "ChatOps", items: ["Slack", "Discord", "PagerDuty", "Opsgenie", "Email", "Webhooks"] },
  { h: "Embedding", items: ["Public dashboards", "Status pages", "Embeddable charts", "Shared traces", "Read-only links", "SAML SSO"] },
];

const Integrations = () => (
  <section id="integrations" className="relative py-28 lg:py-36 border-b border-border">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
      <div className="grid lg:grid-cols-12 gap-10 mb-16">
        <div className="lg:col-span-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <span className="h-px w-8 bg-primary" /> Ecosystem
          </div>
        </div>
        <div className="lg:col-span-8">
          <h2 className="font-display text-5xl lg:text-6xl leading-[1.0] tracking-tight text-balance">
            Plays well with the stack <span className="italic text-muted-foreground">you already trust.</span>
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
