import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { chartPalette } from "@/lib/colors";

export interface SeriesPoint {
  timestamp: string | number;
  [series: string]: string | number;
}

interface TimeSeriesChartProps {
  data: SeriesPoint[];
  /** Data keys to plot; each gets a palette color unless colors overrides it. */
  series: string[];
  mode?: "area" | "line" | "bar";
  height?: number;
  stacked?: boolean;
  colors?: Record<string, string>;
  showLegend?: boolean;
  yWidth?: number;
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
};

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 9,
  tickLine: false,
  axisLine: false,
} as const;

// 12000 → 12k, 3400000 → 3.4M — keeps the Y axis narrow and scannable.
function abbreviateTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  if (abs > 0 && abs < 1) return v.toFixed(2);
  return String(Math.round(v));
}

// Shared recharts wrapper so every chart carries the same axis, grid,
// tooltip, and palette treatment from the style guide.
export default function TimeSeriesChart({
  data,
  series,
  mode = "line",
  height = 192,
  stacked = false,
  colors,
  showLegend = false,
  yWidth = 36,
}: TimeSeriesChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        time:
          typeof d.timestamp === "string"
            ? new Date(d.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
            : d.timestamp,
      })),
    [data],
  );

  const colorOf = (key: string, i: number) => colors?.[key] ?? chartPalette[i % chartPalette.length];

  const common = (
    <>
      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
      <XAxis dataKey="time" {...axisProps} interval="preserveStartEnd" />
      <YAxis {...axisProps} width={yWidth} tickFormatter={abbreviateTick} />
      <Tooltip contentStyle={tooltipStyle} />
      {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
    </>
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        {mode === "bar" ? (
          <BarChart data={chartData}>
            {common}
            {series.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId={stacked ? "stack" : undefined}
                fill={colorOf(key, i)}
                fillOpacity={0.85}
                radius={stacked ? undefined : [2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        ) : mode === "area" ? (
          <AreaChart data={chartData}>
            {common}
            {series.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId={stacked ? "stack" : undefined}
                stroke={colorOf(key, i)}
                fill={colorOf(key, i)}
                fillOpacity={0.15}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            {common}
            {series.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colorOf(key, i)} strokeWidth={1.5} dot={false} connectNulls />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
