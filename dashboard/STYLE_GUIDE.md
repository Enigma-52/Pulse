# Pulse Dashboard — Design Style Guide

Inspired by SigNoz. Dark, dense, monospace-heavy.

## Color System

All colors are defined in `src/lib/colors.ts`. Import from there — never hardcode hex values in components.

### Status Colors
| Status   | Hex       | Usage                                |
|----------|-----------|--------------------------------------|
| OK       | `#66BB6A` | Healthy services, successful traces  |
| Warning  | `#FFA726` | Degraded services, elevated errors   |
| Error    | `#EF5350` | Failed spans, critical services      |
| Info     | `#42A5F5` | Informational badges, links          |

### Chart Palette (categorical, fixed order)
Validated on the dark card surface (#0f0f0f): lightness band, chroma floor,
colorblind adjacent-pair separation (worst ΔE 9.3), and ≥3:1 contrast all pass.
Hues are assigned in this fixed order — never re-ranked when series come and go.
```
#4E92F9  blue         — primary metric line
#D0761F  orange
#17A0B4  teal
#E14B7D  pink
#8A76E0  lavender
#6F9A2E  olive
#2492D6  light blue
#B78A18  gold
#BE3FA8  magenta
#3F9E47  green
#6B85C4  slate blue
#C96A45  rust
```

### Service Colors
Determined by `serviceColor(name)` — hashes the service name to pick a consistent color from the chart palette. Same service always gets the same color.

## Typography

| Element        | Classes                                      |
|----------------|----------------------------------------------|
| Page title     | `text-xl font-medium tracking-tight`         |
| Section label  | `text-[10px] uppercase tracking-wider text-muted-foreground` (or `data-label` class) |
| Data value     | `font-mono text-xs` or `font-mono text-sm`   |
| Large stat     | `text-2xl font-mono font-medium`             |
| Body text      | `text-sm text-muted-foreground`              |
| Monospace ID   | `font-mono text-xs text-muted-foreground`    |

Font stack: Inter (body), JetBrains Mono (code/data).

## Component Patterns

### Stat Card
Panel with a colored bottom accent bar (2px).
```
<div className="panel p-4 relative overflow-hidden">
  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: color }} />
  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</div>
  <div className="text-2xl font-mono font-medium mt-1">Value</div>
</div>
```

### Service Card
Panel with a colored left accent bar (3px).
```
<div className="panel p-4 relative overflow-hidden">
  <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: svcColor }} />
  <!-- content with pl-2 -->
</div>
```

### Status Badge
```
<span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-status-ok/40 text-status-ok">
  OK
</span>
```

### Table
```
<div className="panel">
  <div className="px-5 py-3 border-b border-border">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</div>
  </div>
  <table className="w-full text-xs">
    <thead>
      <tr className="text-left text-muted-foreground border-b border-border">
        <th className="px-5 py-2 font-medium text-[10px] uppercase tracking-wider">Column</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
        <td className="px-5 py-2.5 font-mono">data</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Chart
- Use colors from `chart` in `colors.ts`, never `hsl(var(--chart-1))`
- X-axis: real timestamps formatted as HH:MM
- Grid: `stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false}`
- Tooltip: `background: "hsl(var(--popover))"`, border, border-radius 6, font-family mono

## Spacing

| Context         | Value     |
|-----------------|-----------|
| Page padding    | `p-6`     |
| Section gap     | `space-y-6` |
| Card gap        | `gap-3`   |
| Panel padding   | `p-4` or `p-5` |
| Table cell      | `px-5 py-2.5` |

## Layout Grid

| Content type     | Grid                                      |
|------------------|-------------------------------------------|
| Stat cards       | `grid-cols-2 md:grid-cols-4`              |
| Service cards    | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` |
| Content panels   | `grid-cols-1 lg:grid-cols-2` or `lg:grid-cols-3` |

## Panels

Base class: `panel` (defined in globals.css — border, rounded-lg, bg-card).
Hover variant: add `hover:border-ring/40 transition-colors`.
