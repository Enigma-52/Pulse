import express from "express";
import Database from "better-sqlite3";
import crypto from "crypto";
import { createClient, createExpressMiddleware } from "@pulse/node";

const app = express();
app.use(express.json());

const pulse = createClient({
  ingestUrl: process.env.PULSE_INGEST_URL ?? "http://localhost:8081/v1/ingest",
  apiKey: process.env.PULSE_API_KEY ?? "dev-api-key",
  serviceName: "api-gateway",
  environment: process.env.NODE_ENV ?? "development",
  flushIntervalMs: 1000,
});

app.use(createExpressMiddleware(pulse));

// ── Database setup ───────────────────────────────────────────────────────
const db = new Database(":memory:");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE products (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 100
  );

  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    total REAL NOT NULL,
    item_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id),
    sku TEXT NOT NULL REFERENCES products(sku),
    qty INTEGER NOT NULL,
    price REAL NOT NULL
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    template TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed data
db.exec(`
  INSERT INTO users (id, email, name) VALUES
    ('u_4421', 'alice@example.com', 'Alice Johnson'),
    ('u_4422', 'bob@example.com', 'Bob Smith');

  INSERT INTO sessions (token, user_id, expires_at) VALUES
    ('sess_abc123', 'u_4421', datetime('now', '+1 day')),
    ('sess_def456', 'u_4422', datetime('now', '+1 day'));

  INSERT INTO products (sku, name, price, stock) VALUES
    ('SKU-21084', 'Wireless Mouse', 29.80, 100),
    ('SKU-21085', 'Mechanical Keyboard', 49.90, 50),
    ('SKU-21086', 'USB-C Hub', 9.70, 200);
`);

// Prepared statements
const stmts = {
  getSession: db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"),
  getUser: db.prepare("SELECT * FROM users WHERE id = ?"),
  getProduct: db.prepare("SELECT * FROM products WHERE sku = ?"),
  reserveStock: db.prepare("UPDATE products SET stock = stock - ? WHERE sku = ? AND stock >= ?"),
  restoreStock: db.prepare("UPDATE products SET stock = stock + ? WHERE sku = ?"),
  insertOrder: db.prepare("INSERT INTO orders (id, user_id, total, item_count, status) VALUES (?, ?, ?, ?, ?)"),
  insertOrderItem: db.prepare("INSERT INTO order_items (order_id, sku, qty, price) VALUES (?, ?, ?, ?)"),
  updateOrderStatus: db.prepare("UPDATE orders SET status = ? WHERE id = ?"),
  insertNotification: db.prepare("INSERT INTO notifications (order_id, channel, template) VALUES (?, ?, ?)"),
  getOrder: db.prepare("SELECT * FROM orders WHERE id = ?"),
  listOrders: db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?"),
  getAnalytics: db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(total) as revenue,
      AVG(total) as avg_order_value,
      COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
    FROM orders
  `),
};

const skus = ["SKU-21084", "SKU-21085", "SKU-21086"];

// ── POST /api/orders ── realistic multi-service trace ──────────────────
app.post("/api/orders", async (_req, res) => {
  const userId = "u_4421";
  const sessionToken = "sess_abc123";

  // Auth check — real DB lookup
  const session = await pulse.withSpan("auth.verify_token", {
    kind: "client",
    attributes: { "rpc.system": "grpc", "rpc.method": "VerifyToken", "user.id": userId },
  }, async () => {
    return await pulse.withSpan("db.query", {
      kind: "client",
      attributes: { "db.system": "sqlite", "db.operation": "SELECT", "db.statement": "SELECT * FROM sessions WHERE token = ?" },
    }, async () => {
      return stmts.getSession.get(sessionToken);
    });
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Pick random items
  const itemCount = 1 + Math.floor(Math.random() * 3);
  const chosenSkus = Array.from({ length: itemCount }, () => skus[Math.floor(Math.random() * skus.length)]);
  const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;

  // Order creation
  let total = 0;
  await pulse.withSpan("orders.create", {
    kind: "internal",
    attributes: { "order.id": orderId, "order.items": itemCount },
  }, async (orderSpan) => {
    // Look up products and calculate total
    const items: { sku: string; qty: number; price: number }[] = [];

    for (const sku of chosenSkus) {
      const product = await pulse.withSpan("db.query", {
        kind: "client",
        attributes: { "db.system": "sqlite", "db.operation": "SELECT", "db.statement": "SELECT * FROM products WHERE sku = ?" },
      }, async () => {
        return stmts.getProduct.get(sku) as { sku: string; price: number } | undefined;
      });

      if (product) {
        items.push({ sku, qty: 1, price: product.price });
        total += product.price;
      }
    }

    orderSpan.setAttribute("order.total", total);
    orderSpan.addEvent("validation.passed");

    // Inventory reservation
    await pulse.withSpan("inventory.reserve", {
      kind: "client",
      attributes: { "inventory.item_count": items.length },
    }, async () => {
      for (const item of items) {
        await pulse.withSpan("db.execute", {
          kind: "client",
          attributes: { "db.system": "sqlite", "db.operation": "UPDATE", "db.statement": "UPDATE products SET stock = stock - ? WHERE sku = ?" },
        }, async () => {
          stmts.reserveStock.run(item.qty, item.sku, item.qty);
        });
      }
    });

    // Persist order
    await pulse.withSpan("db.execute", {
      kind: "client",
      attributes: { "db.system": "sqlite", "db.operation": "INSERT", "db.statement": "INSERT INTO orders (...) VALUES (...)" },
    }, async () => {
      stmts.insertOrder.run(orderId, userId, total, items.length, "confirmed");
      for (const item of items) {
        stmts.insertOrderItem.run(orderId, item.sku, item.qty, item.price);
      }
    });

    // Send notification — real DB insert
    await pulse.withSpan("notifications.send", {
      kind: "internal",
      attributes: { "notification.channel": "email", "notification.template": "order_confirmation" },
    }, async () => {
      stmts.insertNotification.run(orderId, "email", "order_confirmation");
    });

    orderSpan.addEvent("order.persisted");
    pulse.log("info", "Order created", { order_id: orderId, user_id: userId, total });
  });

  // Metrics
  pulse.counter("http.requests.total", 1, { unit: "req", attributes: { method: "POST", route: "/api/orders", status_code: 200 } });
  pulse.counter("orders.created", 1, { unit: "order" });
  pulse.histogram("order.value", total, { unit: "USD" });

  res.json({ status: "ok", orderId });
});

// ── GET /ok ── simple health check ─────────────────────────────────────
app.get("/ok", async (_req, res) => {
  pulse.counter("http.requests.total", 1, { unit: "req", attributes: { method: "GET", route: "/ok", status_code: 200 } });
  res.status(200).json({ status: "ok" });
});

// ── GET /slow ── analytics query ───────────────────────────────────────
app.get("/slow", async (_req, res) => {
  const result = await pulse.withSpan("db.query", {
    kind: "client",
    attributes: { "db.system": "sqlite", "db.operation": "SELECT", "db.statement": "SELECT COUNT(*), SUM(total), AVG(total) ... FROM orders" },
  }, async () => {
    return stmts.getAnalytics.get();
  });

  pulse.counter("http.requests.total", 1, { unit: "req", attributes: { method: "GET", route: "/slow", status_code: 200 } });
  const analytics = result as Record<string, number> | undefined;
  if (analytics) {
    pulse.gauge("db.connections.active", Math.floor(3 + Math.random() * 10), { unit: "conn" });
    pulse.gauge("orders.total_count", analytics.total_orders ?? 0, { unit: "order" });
  }

  res.status(200).json({ status: "ok", analytics: result });
});

// ── GET /error ── payment failure simulation ───────────────────────────
app.get("/error", async (_req, res) => {
  const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await pulse.withSpan("orders.create", {
      kind: "internal",
      attributes: { "order.id": orderId },
    }, async () => {
      // Insert a pending order
      await pulse.withSpan("db.execute", {
        kind: "client",
        attributes: { "db.system": "sqlite", "db.operation": "INSERT", "db.statement": "INSERT INTO orders (...) VALUES (...)" },
      }, async () => {
        stmts.insertOrder.run(orderId, "u_4421", 149.99, 1, "pending");
      });

      // Simulate payment failure
      if (Math.random() < 0.7) {
        // Mark order as failed in DB
        await pulse.withSpan("db.execute", {
          kind: "client",
          attributes: { "db.system": "sqlite", "db.operation": "UPDATE", "db.statement": "UPDATE orders SET status = 'failed' WHERE id = ?" },
        }, async () => {
          stmts.updateOrderStatus.run("failed", orderId);
        });

        throw new Error("Payment declined");
      }

      await pulse.withSpan("db.execute", {
        kind: "client",
        attributes: { "db.system": "sqlite", "db.operation": "UPDATE", "db.statement": "UPDATE orders SET status = 'confirmed' WHERE id = ?" },
      }, async () => {
        stmts.updateOrderStatus.run("confirmed", orderId);
      });
    });

    pulse.counter("http.requests.total", 1, { unit: "req", attributes: { method: "GET", route: "/error", status_code: 200 } });
    res.json({ status: "ok", orderId });
  } catch (err) {
    pulse.counter("http.requests.total", 1, { unit: "req", attributes: { method: "GET", route: "/error", status_code: 500 } });
    pulse.counter("http.request.errors", 1, { unit: "err" });
    pulse.log("error", "Payment failed", { order_id: orderId, error: (err as Error).message });
    res.status(500).json({ error: "Payment failed", orderId });
  }
});

// ── POST /generate ── burst traffic generator ──────────────────────────
app.post("/generate", async (req, res) => {
  const count = Number(req.query.count) || 5;
  const endpoints = [
    { method: "POST", path: "/api/orders" },
    { method: "GET", path: "/slow" },
    { method: "GET", path: "/error" },
    { method: "GET", path: "/ok" },
  ];

  for (let i = 0; i < count; i++) {
    const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
    try {
      await fetch(`http://localhost:${port}${ep.path}`, { method: ep.method });
    } catch { /* ignore */ }
  }

  await pulse.flush();
  res.json({ generated: count });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Demo backend listening on http://localhost:${port}`);
  console.log(`Generate traces: curl -X POST "http://localhost:${port}/generate?count=10"`);
});
