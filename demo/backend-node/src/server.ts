import express from "express";
import { createClient } from "@pulse/node";

const app = express();
app.use(express.json());

const pulseClient = createClient({
  ingestUrl: process.env.PULSE_INGEST_URL ?? "http://localhost:8081/v1/ingest",
  apiKey: process.env.PULSE_API_KEY ?? "dev-api-key",
  serviceName: "api-gateway",
  environment: process.env.NODE_ENV ?? "development",
  flushIntervalMs: 1000,
});

// Helper to simulate async work
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Generate a realistic order creation trace with multiple "services"
app.post("/api/orders", async (req, res) => {
  const root = pulseClient.startSpan("POST /api/orders", {
    kind: "server",
    attributes: {
      "http.method": "POST",
      "http.route": "/api/orders",
      "http.status_code": 200,
      "http.user_agent": req.get("user-agent") ?? "unknown",
      "net.peer.ip": req.ip ?? "127.0.0.1",
    },
  });
  root.addEvent("request.received");
  const traceId = root.span.traceId;

  try {
    // Auth verification
    const authSpan = pulseClient.startSpan("auth.verify_token", {
      traceId,
      parentSpanId: root.span.spanId,
      kind: "client",
      attributes: { "rpc.system": "grpc", "rpc.method": "VerifyToken", "user.id": "u_4421" },
    });

    // Redis cache lookup
    const redisSpan = pulseClient.startSpan("redis.get", {
      traceId,
      parentSpanId: authSpan.span.spanId,
      kind: "client",
      attributes: { "db.system": "redis", "db.operation": "GET", "db.statement": "GET session:u_4421" },
    });
    await delay(2 + Math.random() * 3);
    redisSpan.end();
    await delay(8 + Math.random() * 10);
    authSpan.end();

    // Order creation
    const orderSpan = pulseClient.startSpan("orders.create", {
      traceId,
      parentSpanId: root.span.spanId,
      kind: "internal",
      attributes: {
        "order.id": `ord_${Math.floor(Math.random() * 10000)}`,
        "order.total": 89.4,
        "order.items": 3,
      },
    });
    orderSpan.addEvent("validation.passed");

    // Inventory reservation
    const invSpan = pulseClient.startSpan("inventory.reserve", {
      traceId,
      parentSpanId: orderSpan.span.spanId,
      kind: "client",
      attributes: { "inventory.sku": "SKU-21084", "inventory.qty": 3 },
    });

    const pgUpdateSpan = pulseClient.startSpan("postgres.update", {
      traceId,
      parentSpanId: invSpan.span.spanId,
      kind: "client",
      attributes: {
        "db.system": "postgresql",
        "db.name": "inventory",
        "db.statement": "UPDATE stock SET qty = qty - $1 WHERE sku = $2",
      },
    });
    await delay(10 + Math.random() * 10);
    pgUpdateSpan.end();
    await delay(5 + Math.random() * 10);
    invSpan.end();

    // Payment processing
    const paySpan = pulseClient.startSpan("payments.charge", {
      traceId,
      parentSpanId: orderSpan.span.spanId,
      kind: "client",
      attributes: { "payment.provider": "stripe", "payment.amount": 89.4, "payment.currency": "USD" },
    });

    const stripeSpan = pulseClient.startSpan("stripe.api.call", {
      traceId,
      parentSpanId: paySpan.span.spanId,
      kind: "client",
      attributes: {
        "http.method": "POST",
        "http.url": "https://api.stripe.com/v1/charges",
        "http.status_code": 200,
      },
    });
    stripeSpan.addEvent("request.start");
    await delay(80 + Math.random() * 100);
    stripeSpan.addEvent("response.received");
    stripeSpan.end();
    await delay(5 + Math.random() * 10);
    paySpan.end();

    // Insert order into DB
    const pgInsertSpan = pulseClient.startSpan("postgres.insert", {
      traceId,
      parentSpanId: orderSpan.span.spanId,
      kind: "client",
      attributes: {
        "db.system": "postgresql",
        "db.name": "orders",
        "db.statement": "INSERT INTO orders (...) VALUES (...)",
      },
    });
    await delay(10 + Math.random() * 10);
    pgInsertSpan.end();

    // Publish to Kafka
    const kafkaSpan = pulseClient.startSpan("kafka.publish", {
      traceId,
      parentSpanId: orderSpan.span.spanId,
      kind: "producer",
      attributes: {
        "messaging.system": "kafka",
        "messaging.destination": "orders.events",
        "messaging.message_id": `msg_${Math.floor(Math.random() * 10000)}`,
      },
    });
    await delay(3 + Math.random() * 5);

    // Notification consumer
    const notifSpan = pulseClient.startSpan("notifications.send", {
      traceId,
      parentSpanId: kafkaSpan.span.spanId,
      kind: "consumer",
      attributes: {
        "messaging.system": "kafka",
        "notification.channel": "email",
        "notification.template": "order_confirmation",
      },
    });
    await delay(4 + Math.random() * 6);
    notifSpan.end();
    kafkaSpan.end();

    orderSpan.addEvent("order.persisted");
    orderSpan.end();

    // Log correlated to trace
    pulseClient.log("info", "Order created", {
      order_id: orderSpan.span.attributes?.["order.id"],
      user_id: "u_4421",
      total: 89.4,
    }, { traceId, spanId: orderSpan.span.spanId });

    pulseClient.log("info", "Charge initiated", {
      amount: 89.4,
      currency: "USD",
    }, { traceId, spanId: paySpan.span.spanId });

    root.addEvent("response.sent");
    root.end({ attributes: { "http.status_code": 200 } });
    res.json({ status: "ok", traceId });
  } catch (err) {
    root.end({ status: "error", error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal error" });
  }
});

// Simple health check with single span
app.get("/ok", async (_req, res) => {
  await pulseClient.withSpan("ok_handler", { kind: "server" }, async () => {
    res.status(200).json({ status: "ok" });
  });
});

// Slow endpoint with nested DB call
app.get("/slow", async (_req, res) => {
  const root = pulseClient.startSpan("GET /slow", {
    kind: "server",
    attributes: { "http.method": "GET", "http.route": "/slow" },
  });
  const traceId = root.span.traceId;

  const dbSpan = pulseClient.startSpan("postgres.query", {
    traceId,
    parentSpanId: root.span.spanId,
    kind: "client",
    attributes: {
      "db.system": "postgresql",
      "db.name": "analytics",
      "db.statement": "SELECT * FROM reports WHERE ...",
    },
  });
  const d = 100 + Math.random() * 700;
  await delay(d);
  dbSpan.end();
  root.end({ attributes: { "http.status_code": 200 } });
  res.status(200).json({ status: "slow", delay: Math.round(d), traceId });
});

// Error endpoint with payment failure simulation
app.get("/error", async (_req, res) => {
  const root = pulseClient.startSpan("POST /api/payments/charge", {
    kind: "server",
    attributes: { "http.method": "POST", "http.route": "/api/payments/charge" },
  });
  const traceId = root.span.traceId;

  const stripeSpan = pulseClient.startSpan("stripe.api.call", {
    traceId,
    parentSpanId: root.span.spanId,
    kind: "client",
    attributes: {
      "http.method": "POST",
      "http.url": "https://api.stripe.com/v1/charges",
    },
  });
  stripeSpan.addEvent("request.start");
  await delay(800 + Math.random() * 1200);

  if (Math.random() < 0.7) {
    stripeSpan.addEvent("timeout");
    stripeSpan.end({ status: "error", error: "Stripe API timeout after 1800ms", attributes: { "http.status_code": 504 } });
    root.end({ status: "error", error: "Payment failed", attributes: { "http.status_code": 504 } });
    pulseClient.log("error", "Stripe API timeout after 1800ms", {
      provider: "stripe",
      retries: 2,
      status_code: 504,
    }, { traceId });
    res.status(504).json({ error: "Payment timeout", traceId });
  } else {
    stripeSpan.addEvent("response.received");
    stripeSpan.end({ attributes: { "http.status_code": 200 } });
    root.end({ attributes: { "http.status_code": 200 } });
    res.json({ status: "ok", traceId });
  }
});

// Generate traffic endpoint — creates a burst of traces
app.post("/generate", async (_req, res) => {
  const endpoints = [
    { method: "POST", path: "/api/orders" },
    { method: "GET", path: "/slow" },
    { method: "GET", path: "/error" },
    { method: "GET", path: "/ok" },
  ];
  const count = Number(_req.query.count) || 5;

  for (let i = 0; i < count; i++) {
    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    try {
      await fetch(`http://localhost:${port}${ep.path}`, { method: ep.method });
    } catch {
      // ignore
    }
  }

  await pulseClient.flush();
  res.json({ generated: count });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Demo backend listening on http://localhost:${port}`);
  console.log(`Generate traces: curl -X POST http://localhost:${port}/generate?count=10`);
});
