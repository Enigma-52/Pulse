import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { metrics, genSeries } from "@/lib/mockData";

export default function Metrics() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">Time-series across the cluster · last 15m</p>
      </div>

      <div className="flex gap-2">
        <input
          placeholder='rate(http_requests_total[5m])'
          className="h-9 flex-1 px-3 text-xs font-mono rounded bg-secondary border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        <button className="h-9 px-3 text-xs font-medium rounded bg-secondary border border-border hover:border-ring">Execute</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {metrics.map((m, i) => {
          const series = genSeries(40, m.value, m.value * 0.3, i + 1);
          const positive = m.delta >= 0;
          return (
            <Link
              key={m.id}
              to={`/app/metrics/${m.id}`}
              className="panel p-5 hover:border-ring/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground truncate">{m.name}</div>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-mono">{m.value.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground font-mono">{m.unit}</span>
                  </div>
                </div>
                <span className={`text-xs font-mono ${positive ? "text-status-warn" : "text-status-ok"}`}>
                  {positive ? "+" : ""}{m.delta.toFixed(1)}%
                </span>
              </div>
              <div className="h-20 mt-3 -mx-1">
                <ResponsiveContainer>
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id={`m-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={1.25} fill={`url(#m-${m.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-muted-foreground mt-2 truncate">{m.description}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
