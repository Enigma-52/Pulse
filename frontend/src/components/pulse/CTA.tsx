const CTA = () => (
  <section id="cta" className="relative py-32 lg:py-48 overflow-hidden">
    <div className="absolute inset-0 -z-10 grid-lines opacity-[0.06]" />
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[140px]" />

    <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary mb-8">
        Ready when you are
      </div>
      <h2 className="font-display text-6xl md:text-8xl lg:text-9xl leading-[0.95] tracking-tighter text-balance">
        Find the <span className="italic text-primary">pulse</span>
        <br /> of your system.
      </h2>
      <p className="mt-8 text-lg text-muted-foreground max-w-xl mx-auto">
        Open source. Self-hosted. Built for the engineers who carry the pager.
      </p>
      <div className="mt-12 flex flex-col sm:flex-row justify-center gap-3">
        <a href="https://github.com/Enigma-52/Pulse" target="_blank" rel="noopener" className="bg-primary text-primary-foreground px-8 py-4 rounded-sm font-medium hover:bg-primary-glow transition-colors">
          Deploy Pulse free →
        </a>
        <a href="https://github.com/Enigma-52/Pulse" target="_blank" rel="noopener" className="border border-border px-8 py-4 rounded-sm font-medium hover:bg-surface-2 transition-colors">
          Star on GitHub ★
        </a>
      </div>
    </div>
  </section>
);

export default CTA;
