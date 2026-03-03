export type SpanStatus = "ok" | "error";

export interface SpanAttributes {
  [key: string]: string | number | boolean | null;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: SpanStatus;
  error?: string;
  attributes?: SpanAttributes;
}

export interface StartSpanOptions {
  parentSpanId?: string;
  attributes?: SpanAttributes;
}

export interface SpanHandle {
  span: Span;
  end: (overrides?: Partial<Pick<Span, "status" | "error" | "attributes">>) => void;
  setAttribute: (key: string, value: SpanAttributes[keyof SpanAttributes]) => void;
}

import { randomBytes } from "node:crypto";

export function generateId(): string {
  // Simple random hex string for trace/span IDs. Good enough for dev.
  return randomBytes(16).toString("hex");
}

