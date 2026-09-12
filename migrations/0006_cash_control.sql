CREATE TABLE cash_movements (
  id TEXT PRIMARY KEY,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('Ingreso','Gasto')),
  category TEXT NOT NULL CHECK(category IN ('Cobro de cliente','Entrega a propietario','Comisión','Nómina','Honorarios','Gasto operativo','Otro')),
  amount REAL NOT NULL CHECK(amount > 0),
  movement_date TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Efectivo','Transferencia','Tarjeta','Otro')),
  beneficiary TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'Manual' CHECK(source_type IN ('Manual')),
  source_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Aplicado' CHECK(status IN ('Aplicado','Cancelado')),
  cancellation_reason TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  cancelled_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT NOT NULL DEFAULT '',
  UNIQUE(source_type, source_id)
);

CREATE INDEX idx_cash_movements_date ON cash_movements(movement_date, created_at);
CREATE INDEX idx_cash_movements_status_method ON cash_movements(status, payment_method);

CREATE TABLE cash_closings (
  id TEXT PRIMARY KEY,
  closing_date TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Efectivo','Transferencia','Tarjeta','Otro')),
  expected_amount REAL NOT NULL,
  counted_amount REAL NOT NULL,
  difference REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(closing_date, payment_method)
);

CREATE INDEX idx_cash_closings_date ON cash_closings(closing_date);
