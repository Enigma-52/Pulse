const Nav = () => (
  <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/60 border-b border-border/60">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
      <a href="#" className="flex items-center gap-2.5 group">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
          <span className="relative rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <span className="font-display text-2xl tracking-tight">Pulse</span>
        <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border border-border px-1.5 py-0.5 ml-1">v0.4 · oss</span>
      </a>
      <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#features" className="hover:text-foreground transition-colors">Platform</a>
        <a href="#pipeline" className="hover:text-foreground transition-colors">Pipeline</a>
        <a href="#deploy" className="hover:text-foreground transition-colors">Deploy</a>
        <a href="#integrations" className="hover:text-foreground transition-colors">Integrations</a>
        <a href="#" className="hover:text-foreground transition-colors">Docs</a>
      </nav>
      <div className="flex items-center gap-3">
        <a href="#" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">GitHub ↗</a>
        <a href="#cta" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-sm font-medium hover:bg-primary-glow transition-colors">
          Start free
        </a>
      </div>
    </div>
  </header>
);

export default Nav;
