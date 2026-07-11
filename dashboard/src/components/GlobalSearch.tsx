import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, GitBranch, Server, ScrollText, BarChart3, Bug } from "lucide-react";
import { searchAll, type SearchResult } from "@/lib/api";

const TYPE_ICONS = {
  trace: GitBranch,
  service: Server,
  log: ScrollText,
  metric: BarChart3,
  exception: Bug,
} as const;

function resultPath(r: SearchResult): string {
  switch (r.type) {
    case "trace":
      return `/app/traces/${r.id}`;
    case "service":
      return `/app/services/${encodeURIComponent(r.id)}`;
    case "log":
      // Log results carry their trace id; fall back to the logs page.
      return r.id ? `/app/traces/${r.id}` : "/app/logs";
    case "metric":
      return `/app/metrics/${encodeURIComponent(r.id)}`;
    case "exception":
      return `/app/exceptions/${r.id}`;
  }
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  // Debounced search.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchAll(query.trim()).then((r) => {
        setResults(r);
        setActive(0);
        setOpen(true);
        setSearching(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // "/" focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const go = useCallback(
    (r: SearchResult) => {
      setOpen(false);
      setQuery("");
      navigate(resultPath(r));
    },
    [navigate],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === "Escape") (e.target as HTMLInputElement).blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search traces, logs, metrics…"
        className="h-8 w-72 pl-8 pr-12 text-sm rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
      />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground border border-border px-1 rounded">/</kbd>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 w-[420px] max-h-96 overflow-y-auto rounded border border-border bg-popover shadow-lg z-50">
          {searching ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">No results for “{query}” in the last hour.</div>
          ) : (
            results.map((r, i) => {
              const Icon = TYPE_ICONS[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-border last:border-0 ${
                    i === active ? "bg-secondary" : ""
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs truncate">{r.title || r.id}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">{r.subtitle}</span>
                  </span>
                  <span className="text-[9px] font-mono uppercase text-muted-foreground border border-border px-1 py-0.5 rounded shrink-0">
                    {r.type}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
