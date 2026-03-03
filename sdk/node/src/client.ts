import type { Span, SpanHandle, StartSpanOptions } from "./tracing";
import type { LogEvent, LogLevel, LogFields } from "./logging";
import { generateId } from "./tracing";

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
    const span: Span = {
      traceId: generateId(),
      spanId: generateId(),
      parentSpanId: options.parentSpanId,
      name,
      startTime: Date.now(),
      status: "ok",
      attributes: options.attributes
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
      }
    };

    return handle;
  }

  async withSpan<T>(
    name: string,
    options: StartSpanOptions,
    fn: (span: SpanHandle) => Promise<T> | T
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (err) {
      span.end({
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
    const event: LogEvent = {
      timestamp: Date.now(),
      level,
      message,
      fields,
      traceId: context?.traceId,
      spanId: context?.spanId
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

