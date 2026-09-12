CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('Inicial','Pago')),
  source_id TEXT NOT NULL,
  folio TEXT NOT NULL UNIQUE,
  sequence_year INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  issued_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sequence_year, sequence_number),
  UNIQUE(source_type, source_id)
);

CREATE INDEX idx_receipts_sale ON receipts(sale_id);
CREATE INDEX idx_receipts_date ON receipts(issued_date, sequence_number);

WITH sources AS (
  SELECT id AS source_id, id AS sale_id, 'Inicial' AS source_type, sale_date AS issued_date, created_at
  FROM sales
  WHERE reservation_amount + down_payment > 0
  UNION ALL
  SELECT id AS source_id, sale_id, 'Pago' AS source_type, payment_date AS issued_date, created_at
  FROM payments
), numbered AS (
  SELECT *, CAST(substr(issued_date, 1, 4) AS INTEGER) AS sequence_year,
    ROW_NUMBER() OVER (
      PARTITION BY substr(issued_date, 1, 4)
      ORDER BY issued_date, created_at, source_id
    ) AS sequence_number
  FROM sources
)
INSERT INTO receipts(id, sale_id, source_type, source_id, folio, sequence_year, sequence_number, issued_date, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  sale_id, source_type, source_id,
  'CM-' || sequence_year || '-' || printf('%06d', sequence_number),
  sequence_year, sequence_number, issued_date, created_at
FROM numbered;

CREATE TABLE receipt_sequences (
  sequence_year INTEGER PRIMARY KEY,
  next_number INTEGER NOT NULL CHECK(next_number > 0)
);

INSERT INTO receipt_sequences(sequence_year, next_number)
SELECT sequence_year, MAX(sequence_number) + 1 FROM receipts GROUP BY sequence_year;

CREATE TABLE test_data_control (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  reset_locked INTEGER NOT NULL DEFAULT 0 CHECK(reset_locked IN (0,1)),
  locked_at TEXT NOT NULL DEFAULT '',
  locked_by TEXT NOT NULL DEFAULT ''
);

INSERT INTO test_data_control(id) VALUES(1);
