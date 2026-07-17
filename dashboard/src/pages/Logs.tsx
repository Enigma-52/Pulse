import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { LogLevel, Log } from "@/lib/mockData";
import { fetchLogs, fetchLogsHistogram, type LogHistogramPoint } from "@/lib/api";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { logLevel as logLevelColors } from "@/lib/colors";
import TimeRangeSelector, { type TimeRange, rangeToStartEnd, rangeToLabel, rangeToInterval, SHORT_RANGES } from "@/components/TimeRangeSelector";
import { useGlobalTimeRange } from "@/lib/timeRange";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const levelStyle: Record<LogLevel, string> = {
  info: "text-status-info border-status-info/40",
  warn: "text-status-warn border-status-warn/40",
  error: "text-status-error border-status-error/40",
  debug: "text-muted-foreground border-border",
};

type ViewMode = "stream" | "grouped";

interface ErrorGroup {
  message: string;
  count: number;
  services: string[];
  lastSeen: string;
  logs: Log[];
}

function groupErrors(logs: Log[]): ErrorGroup[] {
  const errorLogs = logs.filter(l => l.level === "error" || l.level === "warn");
  const map = new Map<string, ErrorGroup>();

  for (const l of errorLogs) {
    // Normalize: strip numbers/IDs to group similar messages
    const key = l.message.replace(/[0-9a-f]{8,}/gi, "*").replace(/\d+/g, "N");
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.logs.push(l);
      if (!existing.services.includes(l.service)) {
        existing.services.push(l.service);
      }
    } else {
      map.set(key, {
        message: l.message,
        count: 1,
        services: [l.service],
        lastSeen: l.timestamp,
        logs: [l],
      });
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevels, setActiveLevels] = useState<LogLevel[]>([]);
  const [histogram, setHistogram] = useState<LogHistogramPoint[]>([]);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const { range, setRange } = useGlobalTimeRange();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stream");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const loadLogs = useCallback(async (levels?: LogLevel[], searchQuery?: string, timeRange?: TimeRange) => {
    setLoading(true);
    try {
      const r = timeRange ?? range;
      const { start, end } = rangeToStartEnd(r);
      const levelParam = levels && levels.length > 0 ? levels.join(",") : undefined;
      const searchParam = searchQuery || undefined;
      const [data, hist] = await Promise.all([
        fetchLogs({ level: levelParam, search: searchParam, start, end }),
        fetchLogsHistogram({ level: levelParam, search: searchParam, start, end, interval: rangeToInterval(r) }),
      ]);
      setLogs(data);
      setHistogram(hist);
    } catch {
      setLogs([]);
      setHistogram([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadLogs(activeLevels, search, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const refresh = useAutoRefresh(() => loadLogs(activeLevels, search, range));

  const handleLevelClick = (level: LogLevel) => {
    const next = activeLevels.includes(level)
      ? activeLevels.filter(l => l !== level)
      : [...activeLevels, level];
    setActiveLevels(next);
    loadLogs(next, search);
  };

  const handleRun = () => {
    loadLogs(activeLevels, search);
  };

  const handleRangeChange = (r: TimeRange) => {
    setRange(r);
  };

  const levelCounts = {
    info: logs.filter(x => x.level === "info").length,
    warn: logs.filter(x => x.level === "warn").length,
    error: logs.filter(x => x.level === "error").length,
    debug: logs.filter(x => x.level === "debug").length,
  };

  const errorGroups = useMemo(() => groupErrors(logs), [logs]);

  const histogramData = useMemo(() => {
    const byTime = new Map<string, Record<string, number | string>>();
    for (const p of histogram) {
      const key = p.timestamp;
      if (!byTime.has(key)) {
        byTime.set(key, {
          time: new Date(p.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        });
      }
      const row = byTime.get(key)!;
      row[p.level] = ((row[p.level] as number) || 0) + p.count;
    }
    return Array.from(byTime.values());
  }, [histogram]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Structured log stream · {rangeToLabel(range)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse-dot" /> live
          </span>
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <TimeRangeSelector value={range} onChange={handleRangeChange} ranges={SHORT_RANGES} />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleRun()}
          placeholder='level = "error" AND service = "payments-service"'
          className="h-9 flex-1 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <button onClick={handleRun} className="h-9 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">Run</button>
      </div>

      {histogramData.length > 0 && (
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Log volume by level</div>
          <div className="h-24">
            <ResponsiveContainer>
              <BarChart data={histogramData}>
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                {(["debug", "info", "warn", "error"] as const).map(lv => (
                  <Bar key={lv} dataKey={lv} stackId="levels" fill={logLevelColors[lv].dot} fillOpacity={0.85} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["info", "warn", "error", "debug"] as LogLevel[]).map(l => (
            <button
              key={l}
              onClick={() => handleLevelClick(l)}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded border ${levelStyle[l]} hover:bg-secondary ${activeLevels.includes(l) ? "bg-secondary ring-1 ring-ring" : ""}`}
            >
              {l} · {levelCounts[l]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-xs font-mono">
          <button
            onClick={() => setViewMode("stream")}
            className={`px-2 py-1 rounded border ${viewMode === "stream" ? "border-ring text-foreground" : "border-border text-muted-foreground hover:border-ring/40"}`}
          >
            Stream
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-2 py-1 rounded border ${viewMode === "grouped" ? "border-ring text-foreground" : "border-border text-muted-foreground hover:border-ring/40"}`}
          >
            Grouped
          </button>
        </div>
      </div>

      {viewMode === "grouped" ? (
        <div className="panel font-mono text-xs">
          <div className="divide-y divide-border">
            {errorGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">No error/warn logs to group</div>
            ) : (
              errorGroups.map((g, idx) => (
                <div key={idx}>
                  <div
                    className="px-4 py-3 hover:bg-secondary/40 cursor-pointer flex items-center gap-3"
                    onClick={() => setExpandedGroup(expandedGroup === g.message ? null : g.message)}
                  >
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${
                      g.logs[0].level === "error" ? levelStyle.error : levelStyle.warn
                    }`}>
                      {g.count}x
                    </span>
                    <span className="flex-1 truncate">{g.message}</span>
                    <span className="text-muted-foreground shrink-0">
                      {g.services.join(", ")}
                    </span>
                    <span className="text-muted-foreground shrink-0">{g.lastSeen}</span>
                  </div>
                  {expandedGroup === g.message && (
                    <div className="border-t border-border/50 bg-secondary/20">
                      {g.logs.map(l => (
                        <Link
                          key={l.id}
                          to={`/app/logs/${encodeURIComponent(l.id)}`}
                          className="grid grid-cols-12 px-4 py-1.5 hover:bg-secondary/40 text-[11px]"
                        >
                          <div className="col-span-2 text-muted-foreground">{l.timestamp}</div>
                          <div className="col-span-2 text-muted-foreground">{l.service}</div>
                          <div className="col-span-8 truncate">{l.message}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="panel font-mono text-xs">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="px-4 py-8 text-center text-muted-foreground">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">No logs found</div>
            ) : (
              logs.map(l => (
                <div key={l.id}>
                  <div
                    className="grid grid-cols-12 px-4 py-2 hover:bg-secondary/40 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                  >
                    <div className="col-span-2 text-muted-foreground">{l.timestamp}</div>
                    <div className="col-span-1">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] ${levelStyle[l.level]}`}>
                        {l.level.toUpperCase()}
                      </span>
                    </div>
                    <div className="col-span-2 text-muted-foreground truncate">
                      <Link to={`/app/services/${l.service}`} onClick={e => e.stopPropagation()} className="hover:text-foreground transition-colors">{l.service}</Link>
                    </div>
                    <div className="col-span-6 truncate">
                      {l.message}
                      {Object.entries(l.attributes).length > 0 && expandedId !== l.id && (
                        <>
                          {Object.entries(l.attributes).slice(0, 2).map(([k, v]) => (
                            <span key={k} className="ml-3 text-muted-foreground">
                              <span className="text-foreground/60">{k}=</span>{String(v)}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      {l.trace_id && (
                        <Link
                          to={`/app/traces/${l.trace_id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                          title="View trace"
                        >
                          trace
                        </Link>
                      )}
                    </div>
                  </div>
                  {expandedId === l.id && (
                    <div className="px-4 pb-3 pt-1 bg-secondary/20 border-t border-border/50">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 max-w-2xl ml-[calc(100%/12*2)]">
                        {l.service && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">service</span>
                            <span>{l.service}</span>
                          </div>
                        )}
                        {l.trace_id && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">trace_id</span>
                            <Link to={`/app/traces/${l.trace_id}`} className="hover:underline">{l.trace_id.slice(0, 16)}...</Link>
                          </div>
                        )}
                        {l.span_id && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">span_id</span>
                            <span>{l.span_id.slice(0, 16)}</span>
                          </div>
                        )}
                        {Object.entries(l.attributes).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-muted-foreground">{k}</span>
                            <span>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
