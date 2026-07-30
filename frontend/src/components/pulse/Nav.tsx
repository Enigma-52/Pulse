import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#deploy", label: "Deploy" },
  { href: "#integrations", label: "Integrations" },
];

const Nav = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/60 border-b border-border/60">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 group">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
            <span className="relative rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="font-display text-2xl tracking-tight">Pulse</span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border border-border px-1.5 py-0.5 ml-1">v0.1 · oss</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="https://github.com/Enigma-52/Pulse" target="_blank" rel="noopener" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">GitHub ↗</a>
          <a href="#cta" className="hidden sm:inline text-sm bg-primary text-primary-foreground px-4 py-2 rounded-sm font-medium hover:bg-primary-glow transition-colors">
            Get started
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-sm border border-border text-foreground hover:bg-surface-2 transition-colors"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-6 py-4 flex flex-col gap-4 text-sm">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://github.com/Enigma-52/Pulse"
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub ↗
          </a>
          <a
            href="#cta"
            onClick={() => setOpen(false)}
            className="text-center bg-primary text-primary-foreground px-4 py-2.5 rounded-sm font-medium hover:bg-primary-glow transition-colors"
          >
            Get started
          </a>
        </nav>
      )}
    </header>
  );
};

export default Nav;
