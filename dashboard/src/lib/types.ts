// Shared UI domain types. These describe the shapes the API layer maps raw
// responses into — there is no mock/sample data anywhere in the app.

export type Trace = {
  id: string;
  name: string;
  service: string;
  duration: number;
  spans: number;
  status: "ok" | "error";
  timestamp: string;
};

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type Log = {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  attributes: Record<string, string | number>;
};

export type Metric = {
  id: string;
  name: string;
  unit: string;
  value: number;
  delta: number;
  description: string;
};

export type SpanKind = "server" | "client" | "internal" | "producer" | "consumer";

export type Span = {
  id: string;
  parentId: string | null;
  name: string;
  service: string;
  kind: SpanKind;
  start: number; // ms from trace start
  duration: number;
  status: "ok" | "error";
  depth: number;
  attributes: Record<string, string | number | boolean>;
  events?: { time: number; name: string; attrs?: Record<string, string | number> }[];
};
