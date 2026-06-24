import type { Request, Response, NextFunction } from "express";
import type { PulseClient } from "../client";

declare module "express-serve-static-core" {
  interface Request {
    pulseTraceId?: string;
    pulseSpanId?: string;
  }
}

export function createExpressMiddleware(client: PulseClient) {
  return function pulseMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();

    void client.withSpan(`${req.method} ${req.path}`, {
      kind: "server",
      attributes: {
        "http.method": req.method,
        "http.route": req.route?.path ?? req.path,
        "http.target": req.originalUrl,
        "http.scheme": req.protocol,
        "http.host": req.hostname,
        "http.user_agent": req.get("user-agent") ?? "",
        "net.peer.ip": req.ip ?? "",
        "http.request_content_length": req.get("content-length") ? Number(req.get("content-length")) : 0,
      }
    }, async (span) => {
      req.pulseTraceId = span.span.traceId;
      req.pulseSpanId = span.span.spanId;

      await new Promise<void>((resolve) => {
        res.on("finish", () => {
          const durationNs = Number(process.hrtime.bigint() - startTime);
          const durationMs = durationNs / 1e6;

          span.setAttribute("http.status_code", res.statusCode);
          span.setAttribute("http.response_content_length", Number(res.get("content-length") ?? 0));

          if (res.statusCode >= 500) {
            span.span.status = "error";
            span.setAttribute("error.type", "server_error");
            client.counter("http.server.errors", 1, {
              attributes: {
                "http.method": req.method,
                "http.route": req.route?.path ?? req.path,
                "http.status_code": res.statusCode,
              },
            });
          } else if (res.statusCode >= 400) {
            span.span.status = "error";
            span.setAttribute("error.type", "client_error");
          }

          client.histogram("http.server.duration", durationMs, {
            unit: "ms",
            attributes: {
              "http.method": req.method,
              "http.route": req.route?.path ?? req.path,
              "http.status_code": res.statusCode,
            },
          });

          client.counter("http.server.requests", 1, {
            attributes: {
              "http.method": req.method,
              "http.route": req.route?.path ?? req.path,
              "http.status_code": res.statusCode,
            },
          });

          resolve();
        });
        res.on("close", resolve);
        next();
      });
    });
  };
}
