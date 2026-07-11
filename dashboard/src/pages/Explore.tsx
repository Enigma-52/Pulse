import { useState } from "react";
import { Play } from "lucide-react";
import { runSQL, type RawQueryResult } from "@/lib/api";

const EXAMPLES: { label: string; query: string }[] = [
  {
    label: "Slowest routes",
    query: `SELECT route, count() AS requests, round(avg(duration_ms), 1) AS avg_ms, round(quantile(0.95)(duration_ms), 1) AS p95_ms
FROM traces
WHERE start_time >= now() - INTERVAL 60 MINUTE AND route != ''
GROUP BY route
ORDER BY p95_ms DESC
LIMIT 20`,
  },
  {
    label: "Error logs by service",
    query: `SELECT service, count() AS errors
FROM logs
WHERE timestamp >= now() - INTERVAL 60 MINUTE AND level IN ('error', 'fatal')
GROUP BY service
ORDER BY errors DESC`,
  },
  {
    label: "Top exceptions",
    query: `SELECT exception_type, count() AS occurrences, any(exception_message) AS sample_message
FROM exceptions
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY exception_type
ORDER BY occurrences DESC
LIMIT 20`,
  },
  {
    label: "Metric names",
    query: `SELECT name, any(unit) AS unit, count() AS points
FROM metrics
WHERE timestamp >= now() - INTERVAL 60 MINUTE
GROUP BY name
ORDER BY points DESC`,
  },
];

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function Explore() {
  const [query, setQuery] = useState(EXAMPLES[0].query);
  const [result, setResult] = useState<RawQueryResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!query.trim() || running) return;
    setRunning(true);
    setError("");
    const { result: r, error: e } = await runSQL(query);
    setRunning(false);
    if (e) {
      setError(e);
      setResult(null);
    } else {
      setResult(r || null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Explore</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ad hoc ClickHouse SQL over your telemetry — read-only, capped at 1000 rows, 10s timeout
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="data-label">Examples</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => setQuery(ex.query)}
            className="h-7 px-2.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="panel p-4 space-y-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          rows={8}
          spellCheck={false}
          className="w-full px-3 py-2.5 text-xs font-mono leading-relaxed rounded bg-secondary border border-border focus:outline-none focus:border-ring resize-y"
          placeholder="SELECT service, count() FROM traces GROUP BY service"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={running}
            className="h-8 px-4 inline-flex items-center gap-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {running ? "Running…" : "Run query"}
          </button>
          <span className="text-[10px] font-mono text-muted-foreground">⌘⏎ to run · tables: traces, logs, metrics, exceptions</span>
        </div>
      </div>

      {error && (
        <div className="panel p-4 border-status-error/40">
          <div className="data-label mb-1.5">Query error</div>
          <p className="text-xs font-mono text-status-error break-words">{error}</p>
        </div>
      )}

      {result && (
        <div className="panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Results</div>
            <div className="text-[10px] font-mono text-muted-foreground">{result.row_count} rows</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  {result.columns.map((c) => (
                    <th key={c} className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr><td colSpan={result.columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">Query returned no rows.</td></tr>
                ) : (
                  result.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-2 font-mono whitespace-nowrap max-w-[400px] truncate">{fmtCell(cell)}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
