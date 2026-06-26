# pulse-python SDK plan

Mirror of `sdk/node`. Same envelope format, same ingest endpoint.

## Structure

```
sdk/python/
  pulse/
    __init__.py       # exports: PulseClient, create_client
    client.py         # main client — buffers, flush loop, retry
    tracing.py        # Span, SpanHandle dataclasses + ID generation
    logging.py        # LogEvent dataclass
    metrics.py        # MetricPoint dataclass
    context.py        # ContextVar-based active span propagation
    middleware/
      flask.py        # WSGI — wraps each request in a span
      fastapi.py      # ASGI — async variant
  pyproject.toml
```

## Key implementation notes

- **Context propagation**: use `contextvars.ContextVar` — direct equivalent of Node's `AsyncLocalStorage`. Works across both sync and async code.
- **Flush timer**: `threading.Timer` (restarted after each fire) for sync; `asyncio.create_task` with a loop for async.
- **HTTP**: `httpx` — supports both sync and async, handles keepalive. Fallback: `urllib` if zero-dep is a goal.
- **IDs**: `secrets.token_hex(16)` — same output format as Node's `randomBytes(16).hex()`.
- **Retry/backoff**: same logic as Node — exponential with jitter, skip retry on 4xx.
- **Shutdown**: call `client.shutdown()` or register `atexit.register(client.shutdown)` for clean drain on process exit.

## Middleware

Flask (sync):
- Decorator/before+after request hooks
- Set `g.pulse_trace_id` and `g.pulse_span_id` for handlers to read

FastAPI (async):
- Starlette `BaseHTTPMiddleware`
- Same attributes, just `await`-aware

## Envelope format

Identical to Node — no ingestion changes needed:

```json
{
  "serviceName": "my-service",
  "environment": "production",
  "spans": [...],
  "logs": [...],
  "metrics": [...]
}
```

## Packaging

`pyproject.toml` with `[build-system]` using `hatchling`. Publish to PyPI as `pulse-python`.
Only hard dependency: `httpx`. Middleware deps (`flask`, `fastapi`) as optional extras.

```toml
[project.optional-dependencies]
flask   = ["flask>=2.0"]
fastapi = ["fastapi>=0.100", "starlette>=0.27"]
```
