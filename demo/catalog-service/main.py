"""catalog-service — real FastAPI app over Postgres + Redis.

Auto-instrumented by `opentelemetry-instrument` (see Dockerfile CMD), so every
HTTP request, psycopg query, and redis call becomes a real span exported to
Pulse. No telemetry is hand-crafted here.
"""
import json
import logging
import os
import random

import psycopg
import redis
from fastapi import FastAPI, HTTPException

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("catalog")

PG_DSN = os.environ.get("PG_DSN", "postgresql://demo:demo@postgres:5432/shop")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")

rds = redis.Redis.from_url(REDIS_URL, decode_responses=True)
app = FastAPI(title="catalog-service")


def db():
    # A fresh connection per request keeps the demo simple; the psycopg
    # instrumentation records each query as a db.system=postgresql span.
    return psycopg.connect(PG_DSN, autocommit=True)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/products")
def list_products():
    cached = rds.get("products:all")
    if cached:
        return {"source": "cache", "products": json.loads(cached)}
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, sku, name, price_cents, stock FROM products ORDER BY id")
        rows = [
            {"id": r[0], "sku": r[1], "name": r[2], "price_cents": r[3], "stock": r[4]}
            for r in cur.fetchall()
        ]
    rds.setex("products:all", 30, json.dumps(rows))
    return {"source": "db", "products": rows}


@app.get("/products/{product_id}")
def get_product(product_id: int):
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, sku, name, price_cents, stock FROM products WHERE id = %s",
            (product_id,),
        )
        row = cur.fetchone()
    if row is None:
        # A real 404 → real exception recorded on the span.
        raise HTTPException(status_code=404, detail=f"product {product_id} not found")
    # Occasionally simulate a downstream data problem so the Errors page has
    # genuine exceptions to group.
    if random.random() < 0.04:
        raise ValueError(f"price integrity check failed for product {product_id}")
    return {"id": row[0], "sku": row[1], "name": row[2], "price_cents": row[3], "stock": row[4]}


@app.post("/products")
def create_product(body: dict):
    sku = body.get("sku")
    name = body.get("name")
    price = int(body.get("price_cents", 0))
    if not sku or not name or price <= 0:
        raise HTTPException(status_code=400, detail="sku, name, price_cents required")
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO products (sku, name, price_cents) VALUES (%s, %s, %s) RETURNING id",
            (sku, name, price),
        )
        pid = cur.fetchone()[0]
    rds.delete("products:all")
    log.info("created product %s (%s)", pid, sku)
    return {"id": pid}
