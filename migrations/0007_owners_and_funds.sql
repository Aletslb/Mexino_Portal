CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owners_active_name ON owners(active, name);

ALTER TABLE sales ADD COLUMN ownership_type TEXT NOT NULL DEFAULT 'Casa Mexino'
  CHECK(ownership_type IN ('Casa Mexino','Tercero'));
ALTER TABLE sales ADD COLUMN owner_id TEXT REFERENCES owners(id);

CREATE INDEX IF NOT EXISTS idx_sales_owner ON sales(owner_id, status);
