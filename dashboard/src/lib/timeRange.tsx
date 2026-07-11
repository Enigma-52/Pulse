import { createContext, useContext, useState, type ReactNode } from "react";
import type { TimeRange } from "@/components/TimeRangeSelector";

interface TimeRangeContextValue {
  range: TimeRange;
  setRange: (r: TimeRange) => void;
}

const STORAGE_KEY = "pulse_time_range";
const VALID: TimeRange[] = ["5m", "15m", "1h", "6h", "24h", "7d"];

function initialRange(): TimeRange {
  const stored = localStorage.getItem(STORAGE_KEY) as TimeRange | null;
  return stored && VALID.includes(stored) ? stored : "15m";
}

const TimeRangeContext = createContext<TimeRangeContextValue>({
  range: "15m",
  setRange: () => {},
});

// One time range shared by the header selector and every page — changing it
// anywhere updates all mounted views, and it persists across sessions.
export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<TimeRange>(initialRange);

  const setRange = (r: TimeRange) => {
    setRangeState(r);
    localStorage.setItem(STORAGE_KEY, r);
  };

  return <TimeRangeContext.Provider value={{ range, setRange }}>{children}</TimeRangeContext.Provider>;
}

export function useGlobalTimeRange() {
  return useContext(TimeRangeContext);
}
