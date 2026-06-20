import { AsyncLocalStorage } from "node:async_hooks";

export interface SpanContext {
  traceId: string;
  spanId: string;
}

const storage = new AsyncLocalStorage<SpanContext>();

export function getActiveContext(): SpanContext | undefined {
  return storage.getStore();
}

export function runWithContext<T>(ctx: SpanContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
