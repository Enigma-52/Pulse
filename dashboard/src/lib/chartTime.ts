// Shared time formatting for every chart so axes, tooltips, and captions read
// consistently and always carry enough context (date + timezone), not a bare
// "14:32" with no idea which day or zone.

// Local timezone abbreviation, e.g. "IST", "PST", "UTC".
export function tzAbbrev(): string {
  const m = new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).match(/\b([A-Z]{2,5})$/);
  return m?.[1] ?? "local";
}

const toDate = (ts: string | number) => (typeof ts === "number" ? new Date(ts) : new Date(ts));

// Axis tick: compact for intraday, but folds in the date once the window spans
// a day or more so multi-day charts aren't ambiguous.
export function axisTick(ts: string | number, spanMinutes: number): string {
  const d = toDate(ts);
  if (spanMinutes >= 1440) {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

// Full, unambiguous timestamp for tooltips: "Jul 18, 14:32:08 IST".
export function fullTimestamp(ts: string | number): string {
  const d = toDate(ts);
  return (
    d.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }) + " " + tzAbbrev()
  );
}

// Minutes spanned by a series (used to decide axis granularity).
export function spanMinutes(data: { timestamp: string | number }[]): number {
  if (data.length < 2) return 60;
  const a = toDate(data[0].timestamp).getTime();
  const b = toDate(data[data.length - 1].timestamp).getTime();
  return Math.max(1, Math.abs(b - a) / 60000);
}

// One-line caption describing the visible window + timezone, e.g.
// "Jul 18, 01:30–02:20 · IST" or (multi-day) "Jul 16 → Jul 18 · IST".
export function windowCaption(data: { timestamp: string | number }[]): string {
  if (data.length === 0) return "";
  const first = toDate(data[0].timestamp);
  const last = toDate(data[data.length - 1].timestamp);
  const sameDay = first.toDateString() === last.toDateString();
  const hm = (d: Date) => d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const body = sameDay ? `${md(first)}, ${hm(first)}–${hm(last)}` : `${md(first)} → ${md(last)}`;
  return `${body} · ${tzAbbrev()}`;
}
