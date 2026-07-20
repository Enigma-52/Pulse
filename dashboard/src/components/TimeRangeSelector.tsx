import { useState } from "react";

export type TimeRange = "5m" | "15m" | "1h" | "6h" | "24h" | "7d";

export const TIME_RANGES: TimeRange[] = ["5m", "15m", "1h", "6h", "24h", "7d"];
export const SHORT_RANGES: TimeRange[] = ["5m", "15m", "1h", "6h", "24h"];

export function rangeToMinutes(r: TimeRange): number {
  const map: Record<TimeRange, number> = {
    "5m": 5,
    "15m": 15,
    "1h": 60,
    "6h": 360,
    "24h": 1440,
    "7d": 10080,
  };
  return map[r];
}

export function rangeToLabel(r: TimeRange): string {
  const map: Record<TimeRange, string> = {
    "5m": "last 5 minutes",
    "15m": "last 15 minutes",
    "1h": "last 1 hour",
    "6h": "last 6 hours",
    "24h": "last 24 hours",
    "7d": "last 7 days",
  };
  return map[r];
}

export function rangeToStartEnd(r: TimeRange): { start: string; end: string } {
  const now = Date.now();
  const ms = rangeToMinutes(r) * 60 * 1000;
  return {
    start: String(now - ms),
    end: String(now),
  };
}

// Bucket size in MINUTES for endpoints using toStartOfInterval(... MINUTE).
export function rangeToIntervalMinutes(r: TimeRange): number {
  const map: Record<TimeRange, number> = {
    "5m": 1,
    "15m": 1,
    "1h": 1,
    "6h": 2,
    "24h": 5,
    "7d": 30,
  };
  return map[r];
}

// Bucket size in SECONDS for the metric series endpoint.
export function rangeToInterval(r: TimeRange): number {
  const map: Record<TimeRange, number> = {
    "5m": 5,
    "15m": 15,
    "1h": 30,
    "6h": 120,
    "24h": 300,
    "7d": 1800,
  };
  return map[r];
}

export default function TimeRangeSelector({
  value,
  onChange,
  ranges = SHORT_RANGES,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  ranges?: TimeRange[];
}) {
  return (
    <div className="flex gap-1 text-xs font-mono">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2 py-1 rounded border ${
            r === value
              ? "border-ring text-foreground"
              : "border-border text-muted-foreground hover:border-ring/40"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
