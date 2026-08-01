// Simulated storefront traffic. Each action opens a named root span (so the
// trace reads "GET /storefront/..." at the top) and then makes real HTTP calls
// into the backend services, which continue the same trace.
const { trace, SpanStatusCode } = require("@opentelemetry/api");

const ORDER = process.env.ORDER_URL || "http://order-service:3000";
const CATALOG = process.env.CATALOG_URL || "http://catalog-service:8000";
const RPS = parseInt(process.env.RPS || "4", 10);
const tracer = trace.getTracer("storefront-web");

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function action(name, fn) {
  await tracer.startActiveSpan(name, async (span) => {
    try {
      await fn();
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    } finally {
      span.end();
    }
  });
}

async function browse() {
  await action("GET /storefront/products", async () => {
    const r = await fetch(`${CATALOG}/products`);
    await r.text();
  });
}

async function viewProduct() {
  await action("GET /storefront/product", async () => {
    const r = await fetch(`${CATALOG}/products/${rand(1, 5)}`);
    await r.text();
  });
}

async function checkout(bad = false) {
  await action("POST /storefront/checkout", async () => {
    const body = bad ? { product_id: 9999, qty: 1 } : { product_id: rand(1, 5), qty: rand(1, 3) };
    const r = await fetch(`${ORDER}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await r.text();
  });
}

// Weighted mix of user journeys; ~8% intentionally fail to populate Errors.
const journeys = [
  [browse, 40],
  [viewProduct, 30],
  [() => checkout(false), 22],
  [() => checkout(true), 8],
];

function pick() {
  const total = journeys.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [fn, w] of journeys) {
    if (r < w) return fn;
    r -= w;
  }
  return journeys[0][0];
}

async function tick() {
  await Promise.all(Array.from({ length: RPS }, () => pick()().catch(() => {})));
}

console.log(`traffic-gen → order=${ORDER} catalog=${CATALOG} rps=${RPS}`);
setInterval(tick, 1000);
