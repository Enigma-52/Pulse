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
    const span = client.startSpan("http_request", {
      attributes: {
        "http.method": req.method,
        "http.path": req.path
      }
    });

    req.pulseTraceId = span.span.traceId;
    req.pulseSpanId = span.span.spanId;

    const endSpan = () => {
      span.setAttribute("http.status_code", res.statusCode);
      span.end();
    };

    res.on("finish", endSpan);
    res.on("close", endSpan);

    next();
  };
}

