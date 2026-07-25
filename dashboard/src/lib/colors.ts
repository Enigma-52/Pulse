/**
 * Pulse Design System — Color Configuration
 *
 * Single source of truth for all colors used across the Pulse dashboard.
 * Inspired by SigNoz's dark observability aesthetic.
 *
 * Usage:
 *   import { colors, statusColor, chartColor } from "@/lib/colors";
 */

// ── Core Palette ─────────────────────────────────────────────────
// These are CSS variable references from the Tailwind theme (globals.css).
// Use `hsl(var(--<name>))` in className or style props.

export const cssVars = {
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  border: "var(--border)",
  secondary: "var(--secondary)",
  muted: "var(--muted-foreground)",
  popover: "var(--popover)",
  ring: "var(--ring)",
} as const;

// ── Status Colors ────────────────────────────────────────────────
// Semantic colors for health/status indicators.

export const status = {
  ok: "#66BB6A",       // green — healthy / success
  warn: "#FFA726",     // amber — degraded / warning
  error: "#EF5350",    // red — error / critical
  info: "#42A5F5",     // blue — informational
} as const;

// Tailwind-compatible class fragments:
export function statusColor(s: "ok" | "error" | "warn" | "info"): string {
  return {
    ok: "text-status-ok",
    error: "text-status-error",
    warn: "text-status-warn",
    info: "text-status-info",
  }[s];
}

export function statusBadge(s: "ok" | "error" | "warn" | "info"): string {
  return {
    ok: "border-status-ok/40 text-status-ok",
    error: "border-status-error/40 text-status-error",
    warn: "border-status-warn/40 text-status-warn",
    info: "border-status-info/40 text-status-info",
  }[s];
}

// ── Chart Colors ─────────────────────────────────────────────────
// For time-series charts, area fills, bar charts.

export const chart = {
  primary: "#4E92F9",    // blue — main metric line
  secondary: "#17A0B4",  // teal — secondary series
  tertiary: "#8A76E0",   // lavender — third series
  quaternary: "#D0761F", // orange — fourth series
  accent: "#E14B7D",     // pink — highlights
} as const;

// Categorical palette for multi-series charts. Hues are assigned in this
// fixed order (never re-ranked) and the set is validated on the dark card
// surface (#0f0f0f): lightness band, chroma floor, colorblind separation
// (worst adjacent pair ΔE 9.3), and ≥3:1 contrast all pass.
export const chartPalette = [
  "#4E92F9", // blue
  "#D0761F", // orange
  "#17A0B4", // teal
  "#E14B7D", // pink
  "#8A76E0", // lavender
  "#6F9A2E", // olive
  "#2492D6", // light blue
  "#B78A18", // gold
  "#BE3FA8", // magenta
  "#3F9E47", // green
  "#6B85C4", // slate blue
  "#C96A45", // rust
] as const;

// Chart gradient helper for recharts:
export function chartGradient(color: string, id: string) {
  return {
    id,
    stops: [
      { offset: "0%", color, opacity: 0.3 },
      { offset: "100%", color, opacity: 0 },
    ],
  };
}

// ── Service Colors ───────────────────────────────────────────────
// Deterministic color assignment for services (same service = same color).

export function serviceColor(service: string): string {
  let hash = 0;
  for (let i = 0; i < service.length; i++) {
    hash = ((hash << 5) - hash + service.charCodeAt(i)) | 0;
  }
  return chartPalette[Math.abs(hash) % chartPalette.length];
}

// ── Log Level Colors ─────────────────────────────────────────────

export const logLevel = {
  error: { text: "text-status-error", border: "border-status-error/40", bg: "bg-status-error/10", dot: "#EF5350" },
  warn:  { text: "text-status-warn",  border: "border-status-warn/40",  bg: "bg-status-warn/10",  dot: "#FFA726" },
  info:  { text: "text-status-info",  border: "border-status-info/40",  bg: "bg-status-info/10",  dot: "#42A5F5" },
  debug: { text: "text-muted-foreground", border: "border-border", bg: "bg-secondary/40", dot: "#78909C" },
} as const;

export function logLevelStyle(level: string) {
  return logLevel[level as keyof typeof logLevel] ?? logLevel.debug;
}

// ── Formatting Helpers ───────────────────────────────────────────

/** Format milliseconds for display: <1ms → 2 decimals, ≥1ms → integer */
export function fmtMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  return `${Math.round(ms)}ms`;
}

/** Format a rate/percentage for display */
export function fmtPct(pct: number): string {
  if (pct === 0) return "0%";
  if (pct < 0.01) return "<0.01%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

// ── Typography ───────────────────────────────────────────────────
// Font conventions (applied via Tailwind classes):
//
// Data values:    font-mono text-xs         (numbers, IDs, durations)
// Data labels:    data-label                (custom class: text-[10px] uppercase tracking-wider text-muted)
// Body text:      text-sm                   (descriptions, messages)
// Page titles:    text-xl font-medium       (page headers)
// Section titles: text-sm font-medium       (card/panel headers)

// ── Spacing ──────────────────────────────────────────────────────
// Panel padding:  p-4 or p-5
// Card gap:       gap-3
// Section gap:    space-y-6
// Grid columns:   grid-cols-2 md:grid-cols-4 (stat cards)
//                 grid-cols-1 lg:grid-cols-2 (content panels)

// ── Panel Styles ─────────────────────────────────────────────────
// Standard panel:   className="panel"  (border border-border rounded-lg bg-card)
// Hover panel:      className="panel hover:border-ring/40 transition-colors"
// Stat card:        className="panel p-4"  with data-label + font-mono value
