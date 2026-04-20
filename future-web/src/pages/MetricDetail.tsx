import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { metrics, genSeries } from "@/lib/mockData";

export default function MetricDetail() {
  const { id } = useParams();
  const metric = metrics.find(m => m.id === id) ?? metrics[0];
  const series = genSeries(120, metric.value, metric.value * 0.3, 13);

  return (
    <div className="p-6 space-y-6">
      <Link to="/app/metrics" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> Back to metrics
      </Link>

      <div>
        <div className="data-label mb-1">Metric</div>
        <h1 className="text-xl font-mono">{metric.name}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{metric.description}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          ["Current", `${metric.value} ${metric.unit}`],
          ["Avg (15m)", `${(metric.value * 0.92).toFixed(1)} ${metric.unit}`],
          ["Max (15m)", `${(metric.value * 1.18).toFixed(1)} ${metric.unit}`],
          ["Δ", `${metric.delta >= 0 ? "+" : ""}${metric.delta}%`],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4">
            <div className="data-label">{k}</div>
            <div className="text-lg font-mono mt-1">{v}</div>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="data-label">{metric.unit}</div>
            <div className="text-sm mt-1 font-mono text-muted-foreground">{metric.name}</div>
          </div>
          <div className="flex gap-1 text-xs font-mono">
            {["5m", "15m", "1h", "6h", "24h", "7d"].map(r => (
              <button key={r} className={`px-2 py-1 rounded border ${r === "1h" ? "border-ring text-foreground" : "border-border text-muted-foreground hover:border-ring/40"}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="m-detail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={1.25} fill="url(#m-detail)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="panel p-5">
          <div className="data-label mb-3">Labels</div>
          <dl className="text-xs font-mono space-y-1.5">
            {[
              ["env", "production"],
              ["region", "us-east-1"],
              ["cluster", "primary"],
              ["instance", "node-04"],
            ].map(([k, v]) => (
              <div key={k} className="flex">
                <dt className="text-muted-foreground w-32">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="panel p-5">
          <div className="data-label mb-3">Alerts</div>
          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span>{metric.name} {">"} {Math.round(metric.value * 1.5)}</span>
              <span className="text-status-ok">healthy</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span>rate({metric.name}) {">"} 20%</span>
              <span className="text-status-warn">pending</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
