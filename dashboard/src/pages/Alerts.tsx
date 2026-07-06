import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  fetchAlertRules,
  updateAlertRule,
  deleteAlertRule,
  type AlertRule,
} from "@/lib/api";
import AutoRefreshPicker from "@/components/AutoRefreshPicker";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type Tab = "rules" | "history" | "channels";

const OPERATOR_LABELS: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤" };

function conditionSummary(r: AlertRule) {
  const target = r.signal === "metrics" ? r.metric_name : r.signal;
  return `${r.aggregation}(${target}) ${OPERATOR_LABELS[r.operator] || r.operator} ${r.threshold}`;
}

export default function Alerts() {
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchAlertRules()
      .then(setRules)
      .finally(() => setLoading(false));
  }, []);

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
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading alert rules...</td>
                </tr>
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
        <div className="panel px-5 py-10 text-center text-sm text-muted-foreground">Alert history coming soon.</div>
      )}

      {tab === "channels" && (
        <div className="panel px-5 py-10 text-center text-sm text-muted-foreground">Notification channels coming soon.</div>
      )}
    </div>
  );
}
