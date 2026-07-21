import { useState, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  fetchAlertRules,
  updateAlertRule,
  deleteAlertRule,
  fetchAlerts,
  fetchChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  type AlertRule,
  type Alert,
  type NotificationChannel,
} from "@/lib/api";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type Tab = "rules" | "history" | "channels";

const OPERATOR_LABELS: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤" };

function conditionSummary(r: AlertRule) {
  const target = r.signal === "metrics" ? r.metric_name : r.signal;
  return `${r.aggregation}(${target}) ${OPERATOR_LABELS[r.operator] || r.operator} ${r.threshold}`;
}

function fmtTime(ts: string) {
  if (!ts || ts.startsWith("1970")) return "-";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

export default function Alerts() {
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | "firing" | "resolved">("");
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetchAlertRules().then(setRules),
      fetchAlerts({ status: statusFilter || undefined, limit: 100 }).then(setAlerts),
      fetchChannels().then(setChannels),
    ]).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useAutoRefresh(load);

  const toggleRule = async (rule: AlertRule) => {
    await updateAlertRule(rule.id, { ...rule, enabled: !rule.enabled });
    load();
  };

  const removeRule = async (rule: AlertRule) => {
    if (!window.confirm(`Delete alert rule "${rule.name}"?`)) return;
    await deleteAlertRule(rule.id);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Threshold rules evaluated continuously against traces, logs, and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshPicker value={refresh.interval} onChange={refresh.setInterval} isActive={refresh.isActive} />
          <Link
            to="/app/alerts/rules/new"
            className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            New rule
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {(["rules", "history", "channels"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Name</th>
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Signal</th>
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Condition</th>
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Window</th>
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Status</th>
                <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No alert rules yet. Create one to get notified when a threshold is breached.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-3">
                      <Link to={`/app/alerts/rules/${r.id}/edit`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.signal}</td>
                    <td className="px-5 py-3 font-mono text-xs">{conditionSummary(r)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{r.window_minutes}m</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {r.group_by_service ? "per service" : r.service || "all"}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleRule(r)}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          r.enabled
                            ? "border-status-ok/40 text-status-ok"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {r.enabled ? "ENABLED" : "DISABLED"}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link to={`/app/alerts/rules/${r.id}/edit`} className="text-xs text-status-info hover:underline">
                          Edit
                        </Link>
                        <button onClick={() => removeRule(r)} className="text-xs text-status-error hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center gap-1">
            {(["", "firing", "resolved"] as const).map((s) => (
              <button
                key={s || "all"}
                onClick={() => setStatusFilter(s)}
                className={`h-7 px-2.5 text-xs rounded border transition-colors ${
                  statusFilter === s
                    ? "border-ring bg-secondary text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s || "all"}
              </button>
            ))}
          </div>
          <div className="panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Status</th>
                  <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Rule</th>
                  <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
                  <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Value / threshold</th>
                  <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Fired</th>
                  <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : alerts.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No alerts recorded{statusFilter ? ` with status ${statusFilter}` : ""}.</td></tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          a.status === "firing"
                            ? "border-status-error/40 text-status-error"
                            : "border-status-ok/40 text-status-ok"
                        }`}>
                          {a.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Link to={`/app/alerts/${a.id}`} className="font-medium hover:underline">{a.rule_name}</Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{a.service || "-"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-right">
                        {a.value.toFixed(2)} <span className="text-muted-foreground">/ {a.threshold.toFixed(2)}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{fmtTime(a.fired_at)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-right text-muted-foreground">{fmtTime(a.resolved_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "channels" && <ChannelsTab channels={channels} onChanged={load} />}
    </div>
  );
}

function ChannelsTab({ channels, onChanged }: { channels: NotificationChannel[]; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"webhook" | "slack" | "email">("slack");
  const [url, setUrl] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  const inputClass =
    "h-8 w-full px-3 text-sm rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground";

  const startCreate = () => {
    setEditingId(null);
    setName("");
    setType("slack");
    setUrl("");
    setTo("");
    setError("");
    setShowForm(true);
  };

  const startEdit = (c: NotificationChannel) => {
    let cfg: { url?: string; to?: string } = {};
    try { cfg = JSON.parse(c.config_json); } catch { /* ignore */ }
    setEditingId(c.id);
    setName(c.name);
    setType(c.type);
    setUrl(cfg.url || "");
    setTo(cfg.to || "");
    setError("");
    setShowForm(true);
  };

  const save = async () => {
    const config = type === "email" ? { to } : { url };
    const payload = { name, type, config_json: JSON.stringify(config) };
    const result = editingId ? await updateChannel(editingId, payload) : await createChannel(payload);
    if (!result) {
      setError("Failed to save channel — check the URL is a valid http(s) address.");
      return;
    }
    setShowForm(false);
    onChanged();
  };

  const remove = async (c: NotificationChannel) => {
    if (!window.confirm(`Delete channel "${c.name}"?`)) return;
    await deleteChannel(c.id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={startCreate}
          className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded bg-secondary border border-border hover:border-ring"
        >
          <Plus className="w-3.5 h-3.5" />
          Add channel
        </button>
      </div>

      {showForm && (
        <div className="panel p-5 space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="data-label mb-1.5">Name</div>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="team-slack" />
            </div>
            <div>
              <div className="data-label mb-1.5">Type</div>
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="slack">Slack webhook</option>
                <option value="webhook">Generic webhook</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
          {type === "email" ? (
            <div>
              <div className="data-label mb-1.5">Recipient</div>
              <input className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} placeholder="oncall@example.com" />
              <p className="text-xs text-muted-foreground mt-1.5">Email config is stored, but delivery is not yet implemented — alerts to this channel are logged only.</p>
            </div>
          ) : (
            <div>
              <div className="data-label mb-1.5">Webhook URL</div>
              <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
            </div>
          )}
          {error && <p className="text-sm text-status-error">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={save} className="h-8 px-4 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90">
              {editingId ? "Save changes" : "Add channel"}
            </button>
            <button onClick={() => setShowForm(false)} className="h-8 px-4 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Name</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Type</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Destination</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {channels.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">No notification channels configured.</td></tr>
            ) : (
              channels.map((c) => {
                let cfg: { url?: string; to?: string } = {};
                try { cfg = JSON.parse(c.config_json); } catch { /* ignore */ }
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-status-info/40 text-status-info">{c.type}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground truncate max-w-[320px]">{cfg.url || cfg.to || "-"}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => startEdit(c)} className="text-xs text-status-info hover:underline">Edit</button>
                        <button onClick={() => remove(c)} className="text-xs text-status-error hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
