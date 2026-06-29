import pulseLine from "@/assets/pulse-line.jpg";

const Quote = () => (
  <section className="relative py-32 lg:py-44 border-b border-border overflow-hidden">
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 -z-10 opacity-40">
      <img src={pulseLine} alt="" loading="lazy" width={1920} height={640} className="w-full h-auto animate-pulse-line" />
    </div>
    <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
      <p className="font-display text-4xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-balance">
        “We replaced four observability tools with Pulse on a Friday.
        By Monday, our <span className="italic text-primary">MTTR was cut in half</span>.”
      </p>
      <div className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Lin Okafor · Staff SRE · A late-stage fintech
      </div>
    </div>
  </section>
);

export default Quote;
