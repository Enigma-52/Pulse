import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import StatCard from "@/components/StatCard";
import { genSeries, traces, services } from "@/lib/mockData";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const reqSeries = genSeries(60, 1200, 200, 7);
  const errSeries = genSeries(60, 8, 6, 11);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">production · last 15 minutes</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Requests" value="1,240" unit="req/s" delta={4.2} series={reqSeries} />
        <StatCard label="p99 latency" value="312" unit="ms" delta={-2.1} series={genSeries(60, 280, 60, 3)} inverse />
        <StatCard label="Error rate" value="0.68" unit="%" delta={12.0} series={errSeries} inverse />
        <StatCard label="Apdex" value="0.94" delta={-0.4} series={genSeries(60, 0.94, 0.04, 5)} inverse />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="data-label">Request volume</div>
              <div className="text-sm mt-1">All services · req/s</div>
            </div>
            <div className="flex gap-1 text-xs font-mono">
              {["5m", "15m", "1h", "6h", "24h"].map(r => (
                <button key={r} className={`px-2 py-1 rounded border ${r === "15m" ? "border-ring text-foreground" : "border-border text-muted-foreground hover:border-ring/40"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={reqSeries}>
                <defs>
                  <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={1.5} fill="url(#req)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <div className="data-label mb-4">Top services by RPS</div>
          <div className="space-y-3">
            {services.slice(0, 7).map(s => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${s.errorRate > 1 ? "bg-status-error" : s.errorRate > 0.5 ? "bg-status-warn" : "bg-status-ok"}`} />
                <span className="flex-1 truncate">{s.name}</span>
                <div className="flex-1 h-1 bg-secondary rounded">
                  <div className="h-full bg-foreground/60 rounded" style={{ width: `${(s.rps / 1500) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-muted-foreground w-16 text-right">{s.rps}/s</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="data-label">Recent traces</div>
            <div className="text-sm mt-1">Last 8 spans across all services</div>
          </div>
          <Link to="/app/traces" className="text-xs font-mono text-muted-foreground hover:text-foreground">view all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">ID</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Operation</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Service</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Duration</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-right">Spans</th>
              <th className="px-5 py-2.5 font-medium text-[11px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {traces.slice(0, 6).map(t => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                  <Link to={`/app/traces/${t.id}`} className="hover:text-foreground">{t.id}</Link>
                </td>
                <td className="px-5 py-2.5 font-mono text-xs">{t.name}</td>
                <td className="px-5 py-2.5 text-muted-foreground">{t.service}</td>
                <td className="px-5 py-2.5 font-mono text-xs text-right">{t.duration}ms</td>
                <td className="px-5 py-2.5 font-mono text-xs text-right text-muted-foreground">{t.spans}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    t.status === "ok" ? "border-status-ok/40 text-status-ok" : "border-status-error/40 text-status-error"
                  }`}>
                    {t.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
