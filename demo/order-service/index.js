// order-service — real Express API over Postgres + Redis that also calls the
// catalog-service and an external HTTP API. All spans are produced by the
// auto-instrumentation loaded in tracing.js.
const express = require("express");
const { Pool } = require("pg");
const Redis = require("ioredis");

const PG_DSN = process.env.PG_DSN || "postgresql://demo:demo@postgres:5432/shop";
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const CATALOG_URL = process.env.CATALOG_URL || "http://catalog-service:8000";
const EXTERNAL_URL = process.env.EXTERNAL_URL || "https://httpbin.org/anything/charge";

const pool = new Pool({ connectionString: PG_DSN });
const redis = new Redis(REDIS_URL);
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/orders/:id", async (req, res) => {
  const id = req.params.id;
  const cached = await redis.get(`order:${id}`);
  if (cached) return res.json({ source: "cache", order: JSON.parse(cached) });
  const { rows } = await pool.query(
    "SELECT id, product_id, qty, total_cents, status FROM orders WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "order not found" });
  return res.json({ source: "db", order: rows[0] });
});

app.post("/orders", async (req, res) => {
  const { product_id, qty } = req.body || {};
  if (!product_id || !qty || qty < 1) {
    return res.status(400).json({ error: "product_id and qty>=1 required" });
  }

  // 1) Validate the product via the catalog-service (cross-service HTTP span).
  const pr = await fetch(`${CATALOG_URL}/products/${product_id}`);
  if (pr.status === 404) return res.status(404).json({ error: "product not found" });
  if (!pr.ok) return res.status(502).json({ error: "catalog lookup failed" });
  const product = await pr.json();

  const total = product.price_cents * qty;

  // 2) Charge via an external API (outbound HTTP span → External APIs page).
  try {
    await fetch(EXTERNAL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount_cents: total, currency: "USD" }),
    });
  } catch (e) {
    return res.status(502).json({ error: "payment gateway unreachable" });
  }

  // 3) Persist the order (Postgres span) and cache it (Redis span).
  const { rows } = await pool.query(
    "INSERT INTO orders (product_id, qty, total_cents) VALUES ($1, $2, $3) RETURNING id, product_id, qty, total_cents, status",
    [product_id, qty, total]
  );
  const order = rows[0];
  await redis.set(`order:${order.id}`, JSON.stringify(order), "EX", 60);
  return res.status(201).json({ order });
});

const port = 3000;
app.listen(port, () => console.log(`order-service listening on ${port}`));
