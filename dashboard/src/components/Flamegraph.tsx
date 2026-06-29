import { Span } from "@/lib/mockData";

// Service color palette — vibrant, distinct on dark backgrounds
const PALETTE = [
  "#4E92F9", // blue
  "#26C6DA", // teal
  "#7C4DFF", // purple
  "#FF9800", // orange
  "#66BB6A", // green
  "#AB47BC", // violet
  "#FF7043", // deep orange
  "#29B6F6", // light blue
  "#9CCC65", // light green
  "#EC407A", // pink
  "#78909C", // blue grey
  "#FFCA28", // yellow
];

const _map = new Map<string, string>();
let _idx = 0;

export function spanColorFor(service: string): string {
  if (!_map.has(service)) {
    _map.set(service, PALETTE[_idx % PALETTE.length]);
    _idx++;
  }
  return _map.get(service)!;
}

export function resetServiceColors() {
  _map.clear();
  _idx = 0;
}

export const ERROR_COLOR = "#F44336";

export function formatDuration(ms: number): string {
  if (ms < 0.01) return "<0.01ms";
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Timeline minimap — overview of all spans grouped by service row
export function TimelineMinimap({ spans, total }: { spans: Span[]; total: number }) {
  if (spans.length === 0 || total === 0) return null;

  // Group spans by service, preserving first-seen order
  const serviceOrder: string[] = [];
  const serviceSpans = new Map<string, Span[]>();
  for (const s of spans) {
    if (!serviceSpans.has(s.service)) {
      serviceOrder.push(s.service);
      serviceSpans.set(s.service, []);
    }
    serviceSpans.get(s.service)!.push(s);
  }

  const rowH = 10;
  const gap = 3;
  const height = serviceOrder.length * (rowH + gap) - gap;

  return (
    <div className="w-full overflow-hidden rounded bg-[hsl(var(--secondary)/0.3)] border border-border px-3 py-2">
      <svg width="100%" height={Math.max(height, 20)} viewBox={`0 0 1000 ${Math.max(height, 20)}`} preserveAspectRatio="none">
        {serviceOrder.map((svc, row) => {
          const rowSpans = serviceSpans.get(svc)!;
          const y = row * (rowH + gap);
          const color = spanColorFor(svc);
          return rowSpans.map((s, i) => {
            const x = (s.start / total) * 1000;
            const w = Math.max(2, (s.duration / total) * 1000);
            return (
              <rect
                key={`${svc}-${i}`}
                x={x} y={y}
                width={w} height={rowH}
                rx={1.5}
                fill={s.status === "error" ? ERROR_COLOR : color}
                opacity={0.85}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}

// Default export kept for backwards compat but no longer used
export default function Flamegraph({ spans, total }: { spans: Span[]; total: number }) {
  return <TimelineMinimap spans={spans} total={total} />;
}
