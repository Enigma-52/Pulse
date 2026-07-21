import { useState, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { fetchExceptions, type ExceptionGroup } from "@/lib/api";
import TimeRangeSelector, { type TimeRange, rangeToMinutes, rangeToLabel, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { serviceColor } from "@/lib/colors";

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function Exceptions() {
  const [groups, setGroups] = useState<ExceptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, setRange } = useGlobalTimeRange();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    fetchExceptions({ minutes: rangeToMinutes(range), q: query || undefined })
      .then(setGroups)
      .finally(() => setLoading(false));
  }, [range, query]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useAutoRefresh(load);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Exceptions</h1>
          <p className="text-sm text-muted-foreground mt-1">Errors grouped by fingerprint from span exception events · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={setRange} ranges={SHORT_RANGES} />
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by type or message…"
          className="h-8 w-full pl-8 pr-3 text-sm rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Exception</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Occurrences</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">First seen</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No exceptions recorded{query ? " matching your search" : ""}. OTel SDKs report exceptions automatically as span events.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.fingerprint} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-5 py-3 max-w-[480px]">
                    <Link to={`/app/exceptions/${g.fingerprint}`} className="block hover:underline">
                      <span className="font-mono text-xs text-status-error">{g.type}</span>
                      <span className="block text-xs text-muted-foreground truncate mt-0.5">{g.message || "(no message)"}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link to={`/app/services/${encodeURIComponent(g.service)}`} className="inline-flex items-center gap-1.5 font-mono text-xs hover:underline">
                      <span className="w-2 h-2 rounded-full" style={{ background: serviceColor(g.service) }} />
                      {g.service}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-right">{g.occurrences.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{relTime(g.first_seen)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{relTime(g.last_seen)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
