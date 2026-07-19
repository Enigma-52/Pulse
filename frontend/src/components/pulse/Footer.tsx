const cols = [
  {
    h: "Product",
    items: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Deploy", href: "#deploy" },
      { label: "Integrations", href: "#integrations" },
    ],
  },
  {
    h: "Resources",
    items: [
      { label: "Docs", href: "https://github.com/Enigma-52/Pulse/tree/main/docs" },
      { label: "Roadmap", href: "https://github.com/Enigma-52/Pulse/blob/main/docs/roadmap.md" },
      { label: "Architecture", href: "https://github.com/Enigma-52/Pulse/blob/main/docs/architecture.md" },
    ],
  },
  {
    h: "Community",
    items: [
      { label: "GitHub", href: "https://github.com/Enigma-52/Pulse" },
      { label: "Issues", href: "https://github.com/Enigma-52/Pulse/issues" },
      { label: "Contributing", href: "https://github.com/Enigma-52/Pulse/pulls" },
    ],
  },
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
            MIT licensed · open source
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.h} className="lg:col-span-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-5">{c.h}</div>
            <ul className="space-y-3 text-sm">
              {c.items.map((i) => (
                <li key={i.label}>
                  <a
                    href={i.href}
                    {...(i.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
                    className="text-foreground/80 hover:text-primary transition-colors"
                  >
                    {i.label}
                  </a>
                </li>
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
