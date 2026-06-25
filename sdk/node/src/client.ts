import type { Span, SpanHandle, StartSpanOptions, SpanEvent } from "./tracing";
import type { LogEvent, LogLevel, LogFields } from "./logging";
import type { MetricPoint } from "./metrics";
import { generateId } from "./tracing";
import { getActiveContext, runWithContext, type SpanContext } from "./context";

export interface FlushError {
  envelope: TelemetryEnvelope;
  error: unknown;
  attempt: number;
}

export interface ResourceAttributes {
  [key: string]: string | number | boolean;
}

export interface PulseClientConfig {
  ingestUrl: string;
  apiKey: string;
  serviceName: string;
  environment: string;
  serviceVersion?: string;
  resource?: ResourceAttributes;
  flushIntervalMs?: number;
  batchSize?: number;
  maxQueueSize?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  shutdownTimeoutMs?: number;
  onFlushError?: (err: FlushError) => void;
}

export interface TelemetryEnvelope {
  projectId?: string;
  serviceName: string;
  environment: string;
  spans: Span[];
  logs: LogEvent[];
  metrics: MetricPoint[];
}

export class PulseClient {
  private readonly config: Required<Omit<PulseClientConfig, "onFlushError" | "resource">> & { onFlushError?: (err: FlushError) => void; resource: ResourceAttributes };
  private readonly spanBuffer: Span[] = [];
  private readonly logBuffer: LogEvent[] = [];
  private readonly metricBuffer: MetricPoint[] = [];
  private flushTimer?: NodeJS.Timeout;
  private inflightFlushes = 0;

  constructor(config: PulseClientConfig) {
    const {
      flushIntervalMs = 2000,
      batchSize = 100,
      maxQueueSize = 1000,
      maxRetries = 3,
      retryBaseMs = 200,
      retryMaxMs = 5000,
      shutdownTimeoutMs = 10000,
      serviceVersion = "",
      resource = {},
      onFlushError,
      ...rest
    } = config;

    this.config = {
      ...rest,
      flushIntervalMs,
      batchSize,
      maxQueueSize,
      maxRetries,
      retryBaseMs,
      retryMaxMs,
      shutdownTimeoutMs,
      serviceVersion,
      resource: {
        "service.name": rest.serviceName,
        "service.version": serviceVersion,
        "deployment.environment": rest.environment,
        "telemetry.sdk.name": "pulse-node",
        "telemetry.sdk.version": "0.1.0",
        "process.runtime.name": "node",
        "process.runtime.version": process.version,
        "process.pid": process.pid,
        "host.arch": process.arch,
        "os.type": process.platform,
        ...resource,
      },
      onFlushError
    };

    this.startFlushTimer();
  }

  getResource(): ResourceAttributes {
    return { ...this.config.resource };
  }

  startSpan(name: string, options: StartSpanOptions = {}): SpanHandle {
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
      attributes: {
        "service.name": this.config.serviceName,
        "service.version": this.config.serviceVersion,
        "deployment.environment": this.config.environment,
        ...(options.attributes ?? {}),
      },
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
    const activeCtx = getActiveContext();
    const enrichedFields: LogFields = {
      "service.name": this.config.serviceName,
      "service.version": this.config.serviceVersion,
      "deployment.environment": this.config.environment,
      ...fields,
    };
    const event: LogEvent = {
      timestamp: Date.now(),
      level,
      message,
      fields: enrichedFields,
      traceId: context?.traceId ?? activeCtx?.traceId,
      spanId: context?.spanId ?? activeCtx?.spanId
    };
    this.enqueueLog(event);
  }

  debug(message: string, fields?: LogFields): void {
    this.log("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.log("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.log("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.log("error", message, fields);
  }

  counter(name: string, value: number = 1, options?: { unit?: string; attributes?: Record<string, string | number | boolean> }): void {
    this.enqueueMetric({
      name,
      type: "counter",
      value,
      unit: options?.unit ?? "",
      timestamp: Date.now(),
      attributes: options?.attributes
    });
  }

  gauge(name: string, value: number, options?: { unit?: string; attributes?: Record<string, string | number | boolean> }): void {
    this.enqueueMetric({
      name,
      type: "gauge",
      value,
      unit: options?.unit ?? "",
      timestamp: Date.now(),
      attributes: options?.attributes
    });
  }

  histogram(name: string, value: number, options?: { unit?: string; attributes?: Record<string, string | number | boolean> }): void {
    this.enqueueMetric({
      name,
      type: "histogram",
      value,
      unit: options?.unit ?? "",
      timestamp: Date.now(),
      attributes: options?.attributes
    });
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

  private enqueueMetric(metric: MetricPoint): void {
    if (this.metricBuffer.length >= this.config.maxQueueSize) {
      this.metricBuffer.shift();
    }
    this.metricBuffer.push(metric);
    if (this.metricBuffer.length >= this.config.batchSize) {
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
    if (this.spanBuffer.length === 0 && this.logBuffer.length === 0 && this.metricBuffer.length === 0) {
      return;
    }

    const spans = this.spanBuffer.splice(0, this.config.batchSize);
    const logs = this.logBuffer.splice(0, this.config.batchSize);
    const metrics = this.metricBuffer.splice(0, this.config.batchSize);

    const envelope: TelemetryEnvelope = {
      projectId: undefined,
      serviceName: this.config.serviceName,
      environment: this.config.environment,
      spans,
      logs,
      metrics
    };

    this.inflightFlushes++;
    try {
      await this.sendWithRetry(envelope);
    } finally {
      this.inflightFlushes--;
    }
  }

  private async sendWithRetry(envelope: TelemetryEnvelope): Promise<void> {
    const { maxRetries, retryBaseMs, retryMaxMs } = this.config;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(this.config.ingestUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-pulse-api-key": this.config.apiKey
          },
          body: JSON.stringify(envelope),
          keepalive: true
        } as RequestInit);

        // Don't retry client errors (4xx) — they won't succeed on retry
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          return;
        }

        // Server error (5xx) — retry
        if (attempt < maxRetries) {
          await this.backoff(attempt, retryBaseMs, retryMaxMs);
          continue;
        }

        this.config.onFlushError?.({ envelope, error: new Error(`HTTP ${res.status}`), attempt });
      } catch (err) {
        if (attempt < maxRetries) {
          await this.backoff(attempt, retryBaseMs, retryMaxMs);
          continue;
        }
        this.config.onFlushError?.({ envelope, error: err, attempt });
      }
    }
  }

  private backoff(attempt: number, baseMs: number, maxMs: number): Promise<void> {
    const jitter = Math.random() * 0.5 + 0.75; // 0.75–1.25x
    const delay = Math.min(baseMs * 2 ** attempt * jitter, maxMs);
    return new Promise((r) => setTimeout(r, delay));
  }

  async shutdown(): Promise<void> {
    this.stopFlushTimer();

    // Drain remaining buffers
    const flushPromises: Promise<void>[] = [];
    while (this.spanBuffer.length > 0 || this.logBuffer.length > 0 || this.metricBuffer.length > 0) {
      flushPromises.push(this.flush());
    }

    // Wait for all inflight + drain flushes with a timeout
    const allDone = Promise.all(flushPromises).then(() => {
      // Also wait for any flushes that were already inflight before shutdown
      return new Promise<void>((resolve) => {
        const check = () => {
          if (this.inflightFlushes <= 0) return resolve();
          setTimeout(check, 50);
        };
        check();
      });
    });

    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, this.config.shutdownTimeoutMs)
    );

    await Promise.race([allDone, timeout]);
  }
}

export function createClient(config: PulseClientConfig): PulseClient {
  return new PulseClient(config);
}
