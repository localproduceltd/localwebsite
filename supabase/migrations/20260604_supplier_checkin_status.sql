-- Per-supplier check-in completion for a delivery day.
-- A row present = that supplier's check-in is marked complete (so under-counts
-- become real shortages). No row = still checking in (under-counts are "in
-- progress", not short). Deleting the row reopens check-in.

CREATE TABLE IF NOT EXISTS supplier_checkin_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_day DATE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(delivery_day, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_checkin_status_delivery_day
  ON supplier_checkin_status(delivery_day);

-- RLS: permissive policy matching sibling tables.
ALTER TABLE supplier_checkin_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON supplier_checkin_status;
CREATE POLICY "Allow all for authenticated" ON supplier_checkin_status
  FOR ALL TO public USING (true) WITH CHECK (true);
