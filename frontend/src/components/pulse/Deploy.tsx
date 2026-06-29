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
          Two Docker containers — Pulse and ClickHouse. That's the entire stack.
          Run it on a laptop, a VM, or Kubernetes. Your data never leaves your infrastructure.
        </p>

        <ul className="mt-10 space-y-4 text-sm">
          {[
            "MIT licensed. No telemetry phone-home.",
            "Single binary — no agents, collectors, or sidecars.",
            "Works with any OpenTelemetry SDK out of the box.",
            "Port 4321 for all signals — traces, logs, and metrics.",
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
            <span className="font-mono text-[11px] text-muted-foreground">terminal</span>
          </div>
          <pre className="p-6 font-mono text-[13px] leading-relaxed overflow-x-auto">
<span className="text-muted-foreground"># Clone and deploy</span>{"\n"}
<span className="text-foreground">$ git clone github.com/Enigma-52/Pulse</span>{"\n"}
<span className="text-foreground">$ cd Pulse/deploy {"&&"} docker compose up -d</span>{"\n\n"}
<span className="text-signal-metric">✓</span> clickhouse        <span className="text-muted-foreground">ready</span>{"\n"}
<span className="text-signal-metric">✓</span> pulse             <span className="text-muted-foreground">listening :4321</span>{"\n"}
<span className="text-signal-metric">✓</span> dashboard         <span className="text-muted-foreground">http://localhost:3301</span>{"\n\n"}
<span className="text-muted-foreground"># Instrument your app (Node.js example)</span>{"\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">{"import { NodeSDK } from '@opentelemetry/sdk-node';"}</span>{"\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">{"import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';"}</span>{"\n\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">{"new NodeSDK({ traceExporter: new OTLPTraceExporter({"}</span>{"\n"}
<span className="text-foreground">{"    "}</span><span className="text-primary">{"url: 'http://localhost:4321/v1/traces'"}</span>{"\n"}
<span className="text-foreground">{"> "}</span><span className="text-primary">{"}) }).start();"}</span>{"\n\n"}
<span className="text-muted-foreground"># Traces flowing.</span><span className="inline-block w-2 h-4 bg-primary align-middle ml-1 animate-blink" />
          </pre>
        </div>
      </div>
    </div>
  </section>
);

export default Deploy;
