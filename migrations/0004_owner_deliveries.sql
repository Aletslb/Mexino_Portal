ALTER TABLE sales ADD COLUMN owner_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sales ADD COLUMN owner_phone TEXT NOT NULL DEFAULT '';

CREATE TABLE owner_deliveries (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  amount REAL NOT NULL CHECK(amount > 0),
  delivery_date TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Efectivo','Transferencia','Tarjeta','Otro')),
  recipient TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aplicada' CHECK(status IN ('Aplicada','Cancelada')),
  cancellation_reason TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  cancelled_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_owner_deliveries_sale_date ON owner_deliveries(sale_id, delivery_date, created_at);
CREATE INDEX idx_owner_deliveries_applied_sale ON owner_deliveries(sale_id) WHERE status = 'Aplicada';
