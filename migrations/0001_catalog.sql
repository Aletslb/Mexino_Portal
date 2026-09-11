CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('properties','developments','lots')),
  parent_id TEXT REFERENCES records(id),
  lot_key TEXT,
  data TEXT NOT NULL CHECK(json_valid(data)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lot_number ON records(parent_id,lot_key) WHERE kind='lots';
CREATE INDEX IF NOT EXISTS idx_records_kind ON records(kind);
CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  before_data TEXT,
  after_data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at);
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
