-- Schema shared by order-service and catalog-service.
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    sku         TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    qty         INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'created',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO products (sku, name, price_cents, stock) VALUES
    ('SKU-1001', 'Aurora Headphones', 12900, 200),
    ('SKU-1002', 'Nimbus Keyboard',    8900, 150),
    ('SKU-1003', 'Zephyr Mouse',       3900, 300),
    ('SKU-1004', 'Lumen Monitor',     24900,  80),
    ('SKU-1005', 'Pulse Webcam',       6900, 120)
ON CONFLICT (sku) DO NOTHING;
