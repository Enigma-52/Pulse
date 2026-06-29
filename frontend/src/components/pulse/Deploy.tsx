const Deploy = () => (
  <section id="deploy" className="relative py-28 lg:py-40 border-b border-border">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-3 mb-6">
          <span className="h-px w-8 bg-primary" /> Deploy
        </div>
        <h2 className="font-display text-5xl lg:text-6xl leading-[1.0] tracking-tight text-balance">
          Self-hosted in <span className="italic">one command</span>. Yours, forever.
        </h2>
        <p className="mt-6 text-muted-foreground text-lg max-w-md">
          A bundled Docker Compose stack — ingestion, processing, storage, API and UI.
          Run it on a laptop. Run it on a fleet. Run it anywhere your data is allowed to live.
        </p>

        <ul className="mt-10 space-y-4 text-sm">
          {[
            "MIT-licensed core. No telemetry phone-home.",
            "Deploys to a single VM, k8s, or your laptop in dev.",
            "ClickHouse, Kafka, API and UI — bundled, versioned, hardened.",
            "Project-scoped API keys. Built-in rate limits and DLQ.",
          ].map((t) => (
            <li key={t} className="flex gap-3 text-muted-foreground">
              <span className="text-primary font-mono">✓</span>
              <span className="text-foreground/90">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-7">
        <div className="rounded-md border border-border bg-surface-1 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">docker-compose.yml · pulse-stack</span>
          </div>
          <pre className="p-6 font-mono text-[13px] leading-relaxed overflow-x-auto">
<span className="text-muted-foreground"># 1. Clone</span>{"\n"}
<span className="text-foreground">$ git clone github.com/pulse-dev/pulse</span>{"\n"}
<span className="text-foreground">$ cd pulse {"&&"} ./bin/up</span>{"\n\n"}
<span className="text-muted-foreground"># 2. Watch the stack come alive</span>{"\n"}
<span className="text-signal-metric">✓</span> clickhouse        <span className="text-muted-foreground">ready in 8.4s</span>{"\n"}
<span className="text-signal-metric">✓</span> kafka             <span className="text-muted-foreground">ready in 12.1s</span>{"\n"}
<span className="text-signal-metric">✓</span> ingestion-api     <span className="text-muted-foreground">listening :4317</span>{"\n"}
<span className="text-signal-metric">✓</span> worker-pipeline   <span className="text-muted-foreground">consuming spans</span>{"\n"}
<span className="text-signal-metric">✓</span> dashboard         <span className="text-muted-foreground">http://localhost:3000</span>{"\n\n"}
<span className="text-muted-foreground"># 3. Send your first trace</span>{"\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">import {"{"} Pulse {"}"} from "@pulse/node";</span>{"\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">Pulse.init({"{"} apiKey, service: "checkout" {"}"});</span>{"\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">Pulse.span("charge", async () ={">"} charge(order));</span>{"\n\n"}
<span className="text-muted-foreground"># Trace landed in 312ms.</span><span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-blink" />
          </pre>
        </div>
      </div>
    </div>
  </section>
);

export default Deploy;
