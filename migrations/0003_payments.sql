CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  amount REAL NOT NULL CHECK(amount > 0),
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Efectivo','Transferencia','Tarjeta','Otro')),
  kind TEXT NOT NULL CHECK(kind IN ('Mensualidad','Abono extraordinario')),
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aplicado' CHECK(status IN ('Aplicado','Cancelado')),
  sale_status_before TEXT NOT NULL,
  cancellation_reason TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  cancelled_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_payments_sale_date ON payments(sale_id, payment_date, created_at);
CREATE INDEX idx_payments_applied_sale ON payments(sale_id) WHERE status = 'Aplicado';
