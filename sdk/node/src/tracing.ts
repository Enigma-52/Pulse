export type SpanStatus = "ok" | "error";
export type SpanKind = "server" | "client" | "internal" | "producer" | "consumer";

export interface SpanAttributes {
  [key: string]: string | number | boolean | null;
}

export interface SpanEvent {
  time: number;
  name: string;
  attrs?: Record<string, string | number>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: SpanKind;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: SpanStatus;
  error?: string;
  attributes?: SpanAttributes;
  events?: SpanEvent[];
}

export interface StartSpanOptions {
  traceId?: string;
  parentSpanId?: string;
  kind?: SpanKind;
  attributes?: SpanAttributes;
}

export interface SpanHandle {
  span: Span;
  end: (overrides?: Partial<Pick<Span, "status" | "error" | "attributes">>) => void;
  setAttribute: (key: string, value: SpanAttributes[keyof SpanAttributes]) => void;
  addEvent: (name: string, attrs?: Record<string, string | number>) => void;
}

import { randomBytes } from "node:crypto";

export function generateId(): string {
  // Simple random hex string for trace/span IDs. Good enough for dev.
  return randomBytes(16).toString("hex");
}

