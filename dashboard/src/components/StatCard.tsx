import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

type Props = {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  series?: { t: number; value: number }[];
  inverse?: boolean; // if true, positive delta is bad
};

export default function StatCard({ label, value, unit, delta, series, inverse }: Props) {
  const positive = delta !== undefined && delta >= 0;
  const good = inverse ? !positive : positive;
  const color = delta === undefined ? "text-muted-foreground" : good ? "text-status-ok" : "text-status-error";

  return (
    <div className="panel p-4 flex flex-col gap-3 hover:border-ring/40 transition-colors">
      <div className="data-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-mono font-medium tracking-tight">{value}</span>
        {unit && <span className="text-xs text-muted-foreground font-mono">{unit}</span>}
      </div>
      <div className="flex items-center justify-between mt-auto">
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-mono ${color}`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
        {series && (
          <div className="flex-1 h-8 ml-3">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={1.25} fill={`url(#g-${label})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
