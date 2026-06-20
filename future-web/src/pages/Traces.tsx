import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ServiceGraph from "@/components/ServiceGraph";
import type { Trace } from "@/lib/mockData";
import { fetchTraces } from "@/lib/api";

export default function Traces() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTraces()
      .then(setTraces)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Traces</h1>
          <p className="text-sm text-muted-foreground mt-1">Service dependency graph and recent spans</p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="service.name = orders"
            className="h-8 w-72 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
          />
          <button className="h-8 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">Filter</button>
        </div>
      </div>

      <ServiceGraph />

      <div className="panel">
        <div className="px-5 py-4 border-b border-border">
          <div className="data-label">Trace stream</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Time</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Trace ID</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Operation</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Duration</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Spans</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading traces...</td>
              </tr>
            ) : traces.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">No traces found</td>
              </tr>
            ) : traces.map(t => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{t.timestamp}</td>
                <td className="px-5 py-2.5 font-mono text-xs">
                  <Link to={`/app/traces/${t.id}`} className="hover:underline">{t.id}</Link>
                </td>
                <td className="px-5 py-2.5 font-mono text-xs">{t.name}</td>
                <td className="px-5 py-2.5 text-muted-foreground">{t.service}</td>
                <td className="px-5 py-2.5 font-mono text-xs text-right">{t.duration}ms</td>
                <td className="px-5 py-2.5 font-mono text-xs text-right text-muted-foreground">{t.spans}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    t.status === "ok" ? "border-status-ok/40 text-status-ok" : "border-status-error/40 text-status-error"
                  }`}>
                    {t.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
