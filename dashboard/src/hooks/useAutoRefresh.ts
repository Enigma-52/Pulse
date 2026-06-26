import { useState, useEffect, useCallback, useRef } from "react";

export type RefreshInterval = 0 | 5 | 10 | 30 | 60;

const INTERVAL_LABELS: Record<RefreshInterval, string> = {
  0: "Off",
  5: "5s",
  10: "10s",
  30: "30s",
  60: "60s",
};

export const REFRESH_OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

export function useAutoRefresh(onRefresh: () => void, defaultInterval: RefreshInterval = 0) {
  const [interval, setInterval_] = useState<RefreshInterval>(defaultInterval);
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    if (interval === 0) return;
    const id = setInterval(() => callbackRef.current(), interval * 1000);
    return () => clearInterval(id);
  }, [interval]);

  return {
    interval,
    setInterval: setInterval_,
    label: INTERVAL_LABELS[interval],
    isActive: interval > 0,
  };
}
