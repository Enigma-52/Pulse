import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  fetchAlertRule,
  createAlertRule,
  updateAlertRule,
  fetchChannels,
  type AlertRulePayload,
  type NotificationChannel,
} from "@/lib/api";

const AGGREGATIONS: Record<string, { value: string; label: string }[]> = {
  traces: [
    { value: "count", label: "Request count" },
    { value: "avg", label: "Avg latency (ms)" },
    { value: "p95", label: "p95 latency (ms)" },
    { value: "p99", label: "p99 latency (ms)" },
    { value: "error_rate", label: "Error rate (%)" },
    { value: "error_count", label: "Error count" },
  ],
  logs: [
    { value: "count", label: "Log count" },
    { value: "error_count", label: "Error/fatal log count" },
  ],
  metrics: [
    { value: "value_avg", label: "Avg value" },
    { value: "value_max", label: "Max value" },
  ],
};

const OPERATORS = [
  { value: "gt", label: "> greater than" },
  { value: "gte", label: "≥ greater or equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "≤ less or equal" },
];

const inputClass =
  "h-9 w-full px-3 text-sm rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="data-label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

export default function AlertRuleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [thresholdInput, setThresholdInput] = useState("0");
  const [form, setForm] = useState<AlertRulePayload>({
    name: "",
    signal: "traces",
    metric_name: "",
    service: "",
    group_by_service: false,
    aggregation: "count",
    operator: "gt",
    threshold: 0,
    window_minutes: 5,
    channel_ids: [],
    enabled: true,
  });

  useEffect(() => {
    fetchChannels().then(setChannels);
    if (id) {
      fetchAlertRule(id).then((rule) => {
        if (rule) {
          setForm({
            name: rule.name,
            signal: rule.signal,
            metric_name: rule.metric_name,
            service: rule.service,
            group_by_service: rule.group_by_service,
            aggregation: rule.aggregation,
            operator: rule.operator,
            threshold: rule.threshold,
            window_minutes: rule.window_minutes,
            channel_ids: rule.channel_ids,
            enabled: rule.enabled,
          });
          setThresholdInput(String(rule.threshold));
        }
        setLoading(false);
      });
    }
  }, [id]);

  const set = <K extends keyof AlertRulePayload>(key: K, value: AlertRulePayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setSignal = (signal: AlertRulePayload["signal"]) =>
    setForm((f) => ({ ...f, signal, aggregation: AGGREGATIONS[signal][0].value }));

  const toggleChannel = (channelId: string) =>
    setForm((f) => ({
      ...f,
      channel_ids: f.channel_ids.includes(channelId)
        ? f.channel_ids.filter((c) => c !== channelId)
        : [...f.channel_ids, channelId],
    }));

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.signal === "metrics" && !form.metric_name.trim()) {
      setError("Metric name is required for metrics rules");
      return;
    }
    const threshold = Number(thresholdInput);
    if (thresholdInput.trim() === "" || !Number.isFinite(threshold)) {
      setError("Threshold must be a number");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { ...form, threshold };
    const result = id ? await updateAlertRule(id, payload) : await createAlertRule(payload);
    setSaving(false);
    if (result) {
      navigate("/app/alerts");
    } else {
      setError("Failed to save alert rule");
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading rule...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <Link to="/app/alerts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />
          Alerts
        </Link>
        <h1 className="text-xl font-medium tracking-tight mt-2">{editing ? "Edit alert rule" : "New alert rule"}</h1>
      </div>

      <div className="panel p-5 space-y-5">
        <Field label="Name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="High error rate on checkout"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Signal">
            <select className={inputClass} value={form.signal} onChange={(e) => setSignal(e.target.value as AlertRulePayload["signal"])}>
              <option value="traces">Traces</option>
              <option value="logs">Logs</option>
              <option value="metrics">Metrics</option>
            </select>
          </Field>
          <Field label="Aggregation">
            <select className={inputClass} value={form.aggregation} onChange={(e) => set("aggregation", e.target.value)}>
              {AGGREGATIONS[form.signal].map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>
        </div>

        {form.signal === "metrics" && (
          <Field label="Metric name">
            <input
              className={inputClass}
              value={form.metric_name}
              onChange={(e) => set("metric_name", e.target.value)}
              placeholder="http.server.request.duration"
            />
          </Field>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Field label="Operator">
            <select className={inputClass} value={form.operator} onChange={(e) => set("operator", e.target.value as AlertRulePayload["operator"])}>
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Threshold">
            <input
              type="number"
              className={inputClass}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
          </Field>
          <Field label="Window (minutes)">
            <input
              type="number"
              min={1}
              max={1440}
              className={inputClass}
              value={form.window_minutes}
              onChange={(e) => set("window_minutes", Math.max(1, Math.min(1440, Number(e.target.value))))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Service filter (optional)">
            <input
              className={inputClass}
              value={form.service}
              onChange={(e) => set("service", e.target.value)}
              placeholder="all services"
            />
          </Field>
          <Field label="Evaluation scope">
            <label className="flex items-center gap-2 h-9 text-sm">
              <input
                type="checkbox"
                checked={form.group_by_service}
                onChange={(e) => set("group_by_service", e.target.checked)}
              />
              Evaluate per service
            </label>
          </Field>
        </div>

        <Field label="Notification channels">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels configured yet — add one in Alerts → Channels.</p>
          ) : (
            <div className="space-y-1.5">
              {channels.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.channel_ids.includes(c.id)}
                    onChange={() => toggleChannel(c.id)}
                  />
                  {c.name}
                  <span className="text-[10px] font-mono text-muted-foreground border border-border px-1 rounded">{c.type}</span>
                </label>
              ))}
            </div>
          )}
        </Field>

        <Field label="Status">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
            />
            Rule enabled
          </label>
        </Field>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="h-8 px-4 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : editing ? "Save changes" : "Create rule"}
          </button>
          <Link to="/app/alerts" className="h-8 px-4 inline-flex items-center text-xs font-medium rounded bg-secondary border border-border hover:border-ring">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
