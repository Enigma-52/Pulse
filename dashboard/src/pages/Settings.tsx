import { useState, useEffect, useCallback } from "react";
import { GitBranch, ScrollText, BarChart3, Bug } from "lucide-react";
import { fetchUsage, type UsageStat } from "@/lib/api";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const SIGNAL_META: Record<string, { label: string; icon: typeof GitBranch; envVar: string }> = {
  traces: { label: "Traces", icon: GitBranch, envVar: "PULSE_RETENTION_TRACES_DAYS" },
  logs: { label: "Logs", icon: ScrollText, envVar: "PULSE_RETENTION_LOGS_DAYS" },
  metrics: { label: "Metrics", icon: BarChart3, envVar: "PULSE_RETENTION_METRICS_DAYS" },
  exceptions: { label: "Exceptions", icon: Bug, envVar: "PULSE_RETENTION_EXCEPTIONS_DAYS" },
};

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const u of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = u;
  }
  return `${value.toFixed(1)} ${unit}`;
}

function fmtTime(ts: string) {
  if (!ts || ts.startsWith("1970")) return "-";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function Settings() {
  const [usage, setUsage] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchUsage()
      .then(setUsage)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useAutoRefresh(load);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Data usage and retention per signal</p>
        </div>
        <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
      </div>

      {loading ? (
        <div className="panel px-5 py-10 text-center text-sm text-muted-foreground">Loading usage...</div>
      ) : usage.length === 0 ? (
        <div className="panel px-5 py-10 text-center text-sm text-muted-foreground">
          No data stored yet. Point an OpenTelemetry exporter at Pulse to start ingesting.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usage.map((u) => {
            const meta = SIGNAL_META[u.signal] || { label: u.signal, icon: GitBranch, envVar: "" };
            const Icon = meta.icon;
            return (
              <div key={u.signal} className="panel p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="font-medium">{meta.label}</span>
                  </div>
                  {u.retention_days > 0 ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-status-info/40 text-status-info">
                      keeps {u.retention_days}d
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      no retention limit
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="data-label">Rows</div>
                    <div className="text-2xl font-mono font-medium mt-1">{u.rows.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="data-label">On disk</div>
                    <div className="text-2xl font-mono font-medium mt-1">{fmtBytes(u.bytes)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground font-mono">
                  <div>
                    <div className="data-label mb-1">Oldest</div>
                    {fmtTime(u.oldest)}
                  </div>
                  <div>
                    <div className="data-label mb-1">Newest</div>
                    {fmtTime(u.newest)}
                  </div>
                </div>

                {u.retention_days === 0 && meta.envVar && (
                  <p className="text-xs text-muted-foreground">
                    Set <code className="font-mono text-[11px] bg-secondary px-1 py-0.5 rounded">{meta.envVar}</code> to enable TTL cleanup.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
