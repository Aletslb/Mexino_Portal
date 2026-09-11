CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  asset_type TEXT NOT NULL CHECK(asset_type IN ('Propiedad','Lote')),
  asset_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Apartado','Activa','Liquidada','Cancelacion en revision','Cancelada')),
  agreed_price REAL NOT NULL CHECK(agreed_price >= 0),
  reservation_amount REAL NOT NULL DEFAULT 0 CHECK(reservation_amount >= 0),
  down_payment REAL NOT NULL DEFAULT 0 CHECK(down_payment >= 0),
  monthly_payment REAL NOT NULL DEFAULT 0 CHECK(monthly_payment >= 0),
  term_months INTEGER NOT NULL DEFAULT 0 CHECK(term_months >= 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Efectivo','Transferencia','Tarjeta','Otro')),
  sale_date TEXT NOT NULL,
  next_payment_date TEXT NOT NULL DEFAULT '',
  commission_type TEXT NOT NULL CHECK(commission_type IN ('Porcentaje','Monto')),
  commission_value REAL NOT NULL DEFAULT 0 CHECK(commission_value >= 0),
  cancellation_notes TEXT NOT NULL DEFAULT '',
  cancellation_resolution TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_sales_active_asset
ON sales(asset_type, asset_id)
WHERE status != 'Cancelada';

CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_status ON sales(status);
