import { Link } from "react-router-dom";
import { logs, LogLevel } from "@/lib/mockData";

const levelStyle: Record<LogLevel, string> = {
  info: "text-status-info border-status-info/40",
  warn: "text-status-warn border-status-warn/40",
  error: "text-status-error border-status-error/40",
  debug: "text-muted-foreground border-border",
};

export default function Logs() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Structured log stream · live tail</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse-dot" /> live
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          placeholder='level = "error" AND service = "payments-service"'
          className="h-9 flex-1 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <button className="h-9 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">Run</button>
        <button className="h-9 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90">Save view</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["info", "warn", "error", "debug"] as LogLevel[]).map(l => (
          <button key={l} className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded border ${levelStyle[l]} hover:bg-secondary`}>
            {l} · {logs.filter(x => x.level === l).length}
          </button>
        ))}
      </div>

      <div className="panel font-mono text-xs">
        <div className="divide-y divide-border">
          {logs.map(l => (
            <Link key={l.id} to={`/app/logs/${l.id}`} className="grid grid-cols-12 px-4 py-2 hover:bg-secondary/40">
              <div className="col-span-2 text-muted-foreground">{l.timestamp}</div>
              <div className="col-span-1">
                <span className={`px-1.5 py-0.5 rounded border text-[10px] ${levelStyle[l.level]}`}>
                  {l.level.toUpperCase()}
                </span>
              </div>
              <div className="col-span-2 text-muted-foreground truncate">{l.service}</div>
              <div className="col-span-7 truncate">
                {l.message}
                {Object.entries(l.attributes).slice(0, 2).map(([k, v]) => (
                  <span key={k} className="ml-3 text-muted-foreground">
                    <span className="text-foreground/60">{k}=</span>{String(v)}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
