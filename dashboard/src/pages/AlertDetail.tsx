import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fetchAlert, fetchAlertRule, type Alert, type AlertRule } from "@/lib/api";

function fmtTime(ts: string) {
  if (!ts || ts.startsWith("1970")) return "-";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="panel p-4">
      <div className="data-label">{label}</div>
      <div className={`text-2xl font-mono font-medium mt-1 ${className}`}>{value}</div>
    </div>
  );
}

export default function AlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [rule, setRule] = useState<AlertRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchAlert(id)
      .then((a) => {
        setAlert(a);
        if (a?.rule_id) fetchAlertRule(a.rule_id).then(setRule);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading alert...</div>;
  if (!alert) return <div className="p-6 text-sm text-muted-foreground">Alert not found.</div>;

  const firing = alert.status === "firing";
  const tracesLink = alert.service
    ? `/app/traces?service=${encodeURIComponent(alert.service)}`
    : "/app/traces";

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/app/alerts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          Alerts
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-medium tracking-tight">{alert.rule_name}</h1>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            firing ? "border-status-error/40 text-status-error" : "border-status-ok/40 text-status-ok"
          }`}>
            {alert.status.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{alert.message}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Observed value" value={alert.value.toFixed(2)} className={firing ? "text-status-error" : ""} />
        <Stat label="Threshold" value={alert.threshold.toFixed(2)} />
        <Stat label="Fired at" value={fmtTime(alert.fired_at)} />
        <Stat label="Resolved at" value={fmtTime(alert.resolved_at)} />
      </div>

      <div className="panel p-5 space-y-3">
        <div className="data-label">Rule</div>
        {rule ? (
          <div className="text-sm space-y-1.5">
            <div className="font-mono text-xs">
              {rule.aggregation}({rule.signal === "metrics" ? rule.metric_name : rule.signal}) {rule.operator} {rule.threshold} over {rule.window_minutes}m
              {rule.group_by_service ? " · per service" : rule.service ? ` · service=${rule.service}` : " · all services"}
            </div>
            <Link to={`/app/alerts/rules/${rule.id}/edit`} className="inline-block text-xs text-status-info hover:underline">
              Edit rule
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Rule no longer exists.</p>
        )}
      </div>

      <div className="panel p-5 space-y-3">
        <div className="data-label">Investigate</div>
        <div className="flex items-center gap-4 text-xs">
          <Link to={tracesLink} className="text-status-info hover:underline">
            View traces{alert.service ? ` for ${alert.service}` : ""}
          </Link>
          <Link to="/app/logs" className="text-status-info hover:underline">View logs</Link>
          {rule?.signal === "metrics" && rule.metric_name && (
            <Link to={`/app/metrics/${encodeURIComponent(rule.metric_name)}`} className="text-status-info hover:underline">
              View metric {rule.metric_name}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
