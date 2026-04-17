import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { logs } from "@/lib/mockData";

export default function LogDetail() {
  const { id } = useParams();
  const log = logs.find(l => l.id === id) ?? logs[0];

  const levelColor =
    log.level === "error" ? "text-status-error border-status-error/40" :
    log.level === "warn" ? "text-status-warn border-status-warn/40" :
    log.level === "info" ? "text-status-info border-status-info/40" :
    "text-muted-foreground border-border";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link to="/app/logs" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> Back to logs
      </Link>

      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${levelColor}`}>
            {log.level.toUpperCase()}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{log.timestamp}</span>
          <span className="text-xs font-mono text-muted-foreground">·</span>
          <span className="text-xs font-mono text-muted-foreground">{log.service}</span>
        </div>
        <h1 className="text-lg font-mono">{log.message}</h1>
      </div>

      <div className="panel p-5">
        <div className="data-label mb-3">Attributes</div>
        <dl className="text-xs font-mono space-y-1.5">
          {Object.entries(log.attributes).map(([k, v]) => (
            <div key={k} className="flex">
              <dt className="text-muted-foreground w-44">{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {log.trace_id && (
        <div className="panel p-5">
          <div className="data-label mb-3">Linked trace</div>
          <Link
            to={`/app/traces/${log.trace_id}`}
            className="font-mono text-xs hover:underline"
          >
            {log.trace_id} →
          </Link>
        </div>
      )}

      <div className="panel p-5">
        <div className="data-label mb-3">Raw</div>
        <pre className="text-xs font-mono text-muted-foreground bg-secondary/40 p-3 rounded overflow-auto">
{JSON.stringify({
  timestamp: log.timestamp,
  level: log.level,
  service: log.service,
  message: log.message,
  trace_id: log.trace_id,
  attributes: log.attributes,
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
