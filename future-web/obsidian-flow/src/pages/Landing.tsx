import { Link } from "react-router-dom";
import { Activity, ArrowRight, GitBranch, BarChart3, ScrollText, Check } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="container max-w-6xl flex items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight">Pulse</span>
            <span className="ml-1 text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">v0.1</span>
          </Link>
          <nav className="ml-10 hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#why" className="hover:text-foreground">Why Pulse</a>
            <a href="#docs" className="hover:text-foreground">Docs</a>
            <a href="#changelog" className="hover:text-foreground">Changelog</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Sign in</a>
            <Link to="/app" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded font-medium hover:bg-primary/90 inline-flex items-center gap-1.5">
              Open dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="container max-w-6xl py-24">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse-dot" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">v0.1 — early access</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-medium tracking-tight max-w-4xl leading-[1.05]">
            Observability <br />
            <span className="text-muted-foreground">for engineers who care about signal.</span>
          </h1>
          <p className="mt-6 text-base text-muted-foreground max-w-xl leading-relaxed">
            Traces, logs and metrics in a single, focused workspace. No dashboards-as-billboards. No noise. Just the data you need to ship.
          </p>
          <div className="mt-10 flex items-center gap-3">
            <Link to="/app" className="bg-primary text-primary-foreground px-5 py-2.5 rounded text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2">
              Open the demo <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#docs" className="border border-border px-5 py-2.5 rounded text-sm font-medium hover:border-ring">
              Read the docs
            </a>
            <code className="ml-2 hidden md:inline-flex items-center text-xs font-mono text-muted-foreground bg-secondary px-3 py-2 rounded border border-border">
              $ pulse install --otlp
            </code>
          </div>
        </div>

        {/* Hero preview */}
        <div className="container max-w-6xl pb-24">
          <div className="panel overflow-hidden">
            <div className="border-b border-border bg-secondary/40 px-4 h-9 flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-3">pulse / production / overview</span>
            </div>
            <div className="grid grid-cols-12 gap-px bg-border">
              <div className="col-span-3 bg-card p-5">
                <div className="data-label mb-2">RPS</div>
                <div className="text-2xl font-mono">1,240</div>
                <div className="text-xs text-status-ok font-mono mt-1">+4.2%</div>
              </div>
              <div className="col-span-3 bg-card p-5">
                <div className="data-label mb-2">p99 latency</div>
                <div className="text-2xl font-mono">312ms</div>
                <div className="text-xs text-status-ok font-mono mt-1">-2.1%</div>
              </div>
              <div className="col-span-3 bg-card p-5">
                <div className="data-label mb-2">Error rate</div>
                <div className="text-2xl font-mono">0.68%</div>
                <div className="text-xs text-status-error font-mono mt-1">+12.0%</div>
              </div>
              <div className="col-span-3 bg-card p-5">
                <div className="data-label mb-2">Services</div>
                <div className="text-2xl font-mono">10</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">all reporting</div>
              </div>

              <div className="col-span-12 bg-card p-6 h-64 bg-grid relative">
                <svg viewBox="0 0 900 240" className="w-full h-full">
                  {[
                    [80, 120, 280, 60], [80, 120, 280, 120], [80, 120, 280, 180],
                    [280, 60, 520, 60], [280, 120, 520, 120], [280, 180, 520, 180],
                    [520, 60, 760, 60], [520, 120, 760, 120], [520, 180, 760, 180],
                  ].map(([x1, y1, x2, y2], i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(0 0% 22%)" strokeWidth="1" />
                  ))}
                  {[[80, 120], [280, 60], [280, 120], [280, 180], [520, 60], [520, 120], [520, 180], [760, 60], [760, 120], [760, 180]].map(([x, y], i) => (
                    <g key={i} transform={`translate(${x},${y})`}>
                      <rect x={-44} y={-14} width={88} height={28} rx={3} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
                      <circle cx={-34} cy={0} r={2.5} fill="hsl(var(--status-ok))" />
                      <text x={-26} y={3} fill="hsl(var(--foreground))" fontSize="9" fontFamily="Inter">service-{i + 1}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section id="product" className="border-b border-border">
        <div className="container max-w-6xl py-24">
          <div className="data-label mb-3">The three pillars</div>
          <h2 className="text-3xl font-medium tracking-tight mb-12 max-w-2xl">
            One workspace. Every signal correlated.
          </h2>
          <div className="grid md:grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden">
            {[
              { icon: GitBranch, title: "Traces", desc: "Distributed traces with a service map that tells you where time is spent.", points: ["OpenTelemetry native", "Service dependency graph", "Tail-based sampling"] },
              { icon: ScrollText, title: "Logs", desc: "Structured logs joined to the traces and metrics they came from.", points: ["Trace ID correlation", "Log-to-metric rules", "Live tail"] },
              { icon: BarChart3, title: "Metrics", desc: "High-cardinality time-series with PromQL and dashboards that aren't ugly.", points: ["PromQL compatible", "Recording rules", "Alerting"] },
            ].map(({ icon: Icon, title, desc, points }) => (
              <div key={title} className="bg-card p-8">
                <Icon className="w-5 h-5 mb-4 text-foreground" strokeWidth={1.5} />
                <h3 className="text-lg font-medium mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{desc}</p>
                <ul className="space-y-2">
                  {points.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-foreground/60" strokeWidth={2} /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="border-b border-border">
        <div className="container max-w-6xl py-24 grid md:grid-cols-2 gap-16">
          <div>
            <div className="data-label mb-3">Why Pulse</div>
            <h2 className="text-3xl font-medium tracking-tight leading-tight">
              Built for the engineer on call at 3am, not the executive who wants a slide.
            </h2>
          </div>
          <div className="space-y-6">
            {[
              ["Open standards", "OpenTelemetry in. Prometheus out. No proprietary agents."],
              ["Predictable cost", "Pay per ingested GB, not per host, seat, or anxiety."],
              ["Self-hostable", "Run it on your infrastructure or use our cloud."],
              ["Boring on purpose", "No animations on metric numbers. No fake gradients."],
            ].map(([t, d]) => (
              <div key={t} className="border-l border-border pl-6">
                <div className="text-sm font-medium mb-1">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border">
        <div className="container max-w-6xl py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight max-w-2xl mx-auto">
            Start instrumenting in under five minutes.
          </h2>
          <div className="mt-8 inline-flex items-center gap-3">
            <Link to="/app" className="bg-primary text-primary-foreground px-5 py-2.5 rounded text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2">
              Open the demo <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#docs" className="border border-border px-5 py-2.5 rounded text-sm font-medium hover:border-ring">
              View documentation
            </a>
          </div>
        </div>
      </section>

      <footer className="container max-w-6xl py-10 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3" /> Pulse · © 2026
        </div>
        <div className="flex items-center gap-6 font-mono">
          <a href="#" className="hover:text-foreground">github</a>
          <a href="#" className="hover:text-foreground">discord</a>
          <a href="#" className="hover:text-foreground">status</a>
        </div>
      </footer>
    </div>
  );
}
