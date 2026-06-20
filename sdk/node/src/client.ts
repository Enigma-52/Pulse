import type { Span, SpanHandle, StartSpanOptions, SpanEvent } from "./tracing";
import type { LogEvent, LogLevel, LogFields } from "./logging";
import { generateId } from "./tracing";
import { getActiveContext, runWithContext, type SpanContext } from "./context";

export interface PulseClientConfig {
  ingestUrl: string;
  apiKey: string;
  serviceName: string;
  environment: string;
  flushIntervalMs?: number;
  batchSize?: number;
  maxQueueSize?: number;
}

export interface TelemetryEnvelope {
  projectId?: string;
  serviceName: string;
  environment: string;
  spans: Span[];
  logs: LogEvent[];
}

export class PulseClient {
  private readonly config: Required<PulseClientConfig>;
  private readonly spanBuffer: Span[] = [];
  private readonly logBuffer: LogEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: PulseClientConfig) {
    const {
      flushIntervalMs = 2000,
      batchSize = 100,
      maxQueueSize = 1000,
      ...rest
    } = config;

    this.config = {
      ...rest,
      flushIntervalMs,
      batchSize,
      maxQueueSize
    };

    this.startFlushTimer();
  }

  startSpan(name: string, options: StartSpanOptions = {}): SpanHandle {
    // Auto-inherit trace context from active span if not explicitly provided
    const activeCtx = getActiveContext();
    const traceId = options.traceId ?? activeCtx?.traceId ?? generateId();
    const parentSpanId = options.parentSpanId ?? activeCtx?.spanId;

    const span: Span = {
      traceId,
      spanId: generateId(),
      parentSpanId,
      name,
      kind: options.kind,
      startTime: Date.now(),
      status: "ok",
      attributes: options.attributes ? { ...options.attributes } : {},
      events: []
    };

    const handle: SpanHandle = {
      span,
      end: (overrides) => {
        if (span.endTime != null) return;
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        if (overrides?.status) span.status = overrides.status;
        if (overrides?.error) span.error = overrides.error;
        if (overrides?.attributes) {
          span.attributes = {
            ...(span.attributes ?? {}),
            ...overrides.attributes
          };
        }
        this.enqueueSpan(span);
      },
      setAttribute: (key, value) => {
        span.attributes = span.attributes ?? {};
        span.attributes[key] = value;
      },
      addEvent: (name, attrs) => {
        span.events = span.events ?? [];
        span.events.push({ time: Date.now(), name, attrs });
      }
    };

    return handle;
  }

  async withSpan<T>(
    name: string,
    options: StartSpanOptions,
    fn: (span: SpanHandle) => Promise<T> | T
  ): Promise<T> {
    const handle = this.startSpan(name, options);
    const ctx: SpanContext = {
      traceId: handle.span.traceId,
      spanId: handle.span.spanId
    };

    try {
      // Run the function within this span's context so nested spans auto-inherit
      const result = await runWithContext(ctx, () => fn(handle));
      handle.end();
      return result;
    } catch (err) {
      handle.end({
        status: "error",
        error: err instanceof Error ? err.message : String(err)
      });
      throw err;
    }
  }

  log(
    level: LogLevel,
    message: string,
    fields?: LogFields,
    context?: { traceId?: string; spanId?: string }
  ): void {
    // Auto-correlate logs with active span if no explicit context
    const activeCtx = getActiveContext();
    const event: LogEvent = {
      timestamp: Date.now(),
      level,
      message,
      fields,
      traceId: context?.traceId ?? activeCtx?.traceId,
      spanId: context?.spanId ?? activeCtx?.spanId
    };
    this.enqueueLog(event);
  }

  private enqueueSpan(span: Span): void {
    if (this.spanBuffer.length >= this.config.maxQueueSize) {
      this.spanBuffer.shift();
    }
    this.spanBuffer.push(span);
    if (this.spanBuffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  private enqueueLog(log: LogEvent): void {
    if (this.logBuffer.length >= this.config.maxQueueSize) {
      this.logBuffer.shift();
    }
    this.logBuffer.push(log);
    if (this.logBuffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
  }

  private stopFlushTimer(): void {
    if (!this.flushTimer) return;
    clearInterval(this.flushTimer);
    this.flushTimer = undefined;
  }

  async flush(): Promise<void> {
    if (this.spanBuffer.length === 0 && this.logBuffer.length === 0) {
      return;
    }

    const spans = this.spanBuffer.splice(0, this.config.batchSize);
    const logs = this.logBuffer.splice(0, this.config.batchSize);

    const envelope: TelemetryEnvelope = {
      projectId: undefined,
      serviceName: this.config.serviceName,
      environment: this.config.environment,
      spans,
      logs
    };

    try {
      await fetch(this.config.ingestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pulse-api-key": this.config.apiKey
        },
        body: JSON.stringify(envelope),
        keepalive: true
      } as RequestInit);
    } catch {
      // For now, swallow errors; a future iteration can add callbacks/metrics.
    }
  }

  shutdown(): void {
    this.stopFlushTimer();
    void this.flush();
  }
}

export function createClient(config: PulseClientConfig): PulseClient {
  return new PulseClient(config);
}
