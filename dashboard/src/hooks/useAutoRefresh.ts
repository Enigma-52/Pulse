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

const STORAGE_KEY = "pulse_refresh_interval";
const VALID_INTERVALS: RefreshInterval[] = [0, 5, 10, 30, 60];

function storedInterval(fallback: RefreshInterval): RefreshInterval {
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return VALID_INTERVALS.includes(raw as RefreshInterval) ? (raw as RefreshInterval) : fallback;
}

export function useAutoRefresh(onRefresh: () => void, defaultInterval: RefreshInterval = 10) {
  // The chosen cadence persists across pages and sessions.
  const [interval, setIntervalState] = useState<RefreshInterval>(() => storedInterval(defaultInterval));
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  const setInterval_ = useCallback((v: RefreshInterval) => {
    setIntervalState(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  }, []);

  useEffect(() => {
    if (interval === 0) return;
    // Don't poll from background tabs; refresh once when the tab returns.
    const id = setInterval(() => {
      if (!document.hidden) callbackRef.current();
    }, interval * 1000);
    const onVisible = () => {
      if (!document.hidden) callbackRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [interval]);

  return {
    interval,
    setInterval: setInterval_,
    label: INTERVAL_LABELS[interval],
    isActive: interval > 0,
  };
}
