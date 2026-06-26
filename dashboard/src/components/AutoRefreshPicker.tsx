import { REFRESH_OPTIONS, type RefreshInterval } from "@/hooks/useAutoRefresh";
import { RefreshCw } from "lucide-react";

export default function AutoRefreshPicker({
  value,
  onChange,
  isActive,
}: {
  value: RefreshInterval;
  onChange: (v: RefreshInterval) => void;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      <RefreshCw className={`w-3 h-3 ${isActive ? "text-status-ok animate-spin" : "text-muted-foreground"}`} style={isActive ? { animationDuration: "2s" } : undefined} />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as RefreshInterval)}
        className="h-7 px-1.5 rounded bg-secondary border border-border text-xs font-mono focus:outline-none focus:border-ring text-foreground"
      >
        {REFRESH_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
