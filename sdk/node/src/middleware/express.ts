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
    // Use withSpan so all downstream code inherits trace context automatically
    void client.withSpan(`${req.method} ${req.path}`, {
      kind: "server",
      attributes: {
        "http.method": req.method,
        "http.route": req.path,
        "http.user_agent": req.get("user-agent") ?? "",
        "net.peer.ip": req.ip ?? "",
      }
    }, async (span) => {
      req.pulseTraceId = span.span.traceId;
      req.pulseSpanId = span.span.spanId;

      await new Promise<void>((resolve) => {
        res.on("finish", () => {
          span.setAttribute("http.status_code", res.statusCode);
          if (res.statusCode >= 400) {
            span.span.status = "error";
          }
          resolve();
        });
        res.on("close", resolve);
        next();
      });
    });
  };
}
