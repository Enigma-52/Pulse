import hero from "@/assets/hero-pulse.jpg";

const Hero = () => (
  <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <img src={hero} alt="" width={1920} height={1080} className="w-full h-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background" />
      <div className="absolute inset-0 vignette" />
    </div>
    <div className="absolute inset-0 -z-10 grid-lines opacity-[0.08]" />

    <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10">
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-10 animate-rise">
        <span className="h-px w-8 bg-primary" />
        <span>Open-source observability · Two containers · Zero complexity</span>
      </div>

      <h1 className="font-display text-[14vw] sm:text-[10vw] lg:text-[8.5rem] xl:text-[10rem] leading-[0.95] tracking-tighter text-balance animate-rise">
        See everything.
        <br />
        <span className="italic text-primary">Fix anything.</span>
        <br />
        Ship faster.
      </h1>

      <div className="mt-12 grid lg:grid-cols-12 gap-8 items-end animate-rise" style={{ animationDelay: '0.15s' }}>
        <p className="lg:col-span-6 text-lg lg:text-xl text-muted-foreground max-w-xl text-pretty">
          Pulse unifies traces, logs, metrics, and database monitoring into a single platform.
          One Go binary. ClickHouse storage. Works with any OpenTelemetry SDK.
        </p>
        <div className="lg:col-span-6 flex flex-col sm:flex-row lg:justify-end gap-3">
          <a href="#deploy" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 rounded-sm font-medium hover:bg-primary-glow transition-colors">
            Deploy in one command <span className="font-mono">→</span>
          </a>
          <a href="#features" className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3.5 rounded-sm font-medium hover:bg-surface-2 transition-colors">
            Explore features
          </a>
        </div>
      </div>

      <div className="mt-20 max-w-3xl mx-auto animate-rise" style={{ animationDelay: '0.3s' }}>
        <div className="rounded-md border border-border bg-surface-1/80 backdrop-blur shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2/60">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="ml-3 font-mono text-[11px] text-muted-foreground">~/pulse/deploy</span>
          </div>
          <pre className="p-5 font-mono text-sm leading-relaxed text-foreground/90">
<span className="text-muted-foreground">$</span> docker compose up -d{"\n"}
<span className="text-signal-metric">✓</span> <span className="text-muted-foreground">clickhouse        ready</span>{"\n"}
<span className="text-signal-metric">✓</span> <span className="text-muted-foreground">pulse             listening :4321</span>{"\n"}
<span className="text-signal-metric">✓</span> <span className="text-muted-foreground">dashboard         http://localhost:3301</span>{"\n\n"}
<span className="text-muted-foreground"># Point any OTel SDK at localhost:4321 — done.</span><span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-blink" />
          </pre>
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
