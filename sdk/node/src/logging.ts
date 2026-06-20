export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogFields {
  [key: string]: unknown;
}

export interface LogEvent {
  timestamp: number;
  level: LogLevel;
  message: string;
  fields?: LogFields;
  traceId?: string;
  spanId?: string;
}

