-- Supplier product flags: tracks when a supplier flags a product as unavailable for a delivery day
-- Used for "can't supply this week" feature in supplier portal

CREATE TABLE IF NOT EXISTS supplier_product_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_day DATE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity_unavailable INTEGER, -- how many of the ordered total can't be supplied; NULL = whole line
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flagged_by TEXT NOT NULL CHECK (flagged_by IN ('supplier', 'admin')),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  UNIQUE(delivery_day, supplier_id, product_name)
);

-- RLS: permissive policy matching sibling tables (order_item_checkins etc).
ALTER TABLE supplier_product_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON supplier_product_flags;
CREATE POLICY "Allow all for authenticated" ON supplier_product_flags
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Index for efficient lookups by delivery day
CREATE INDEX IF NOT EXISTS idx_supplier_product_flags_delivery_day ON supplier_product_flags(delivery_day);

-- Index for finding unresolved flags
CREATE INDEX IF NOT EXISTS idx_supplier_product_flags_unresolved ON supplier_product_flags(delivery_day, resolved) WHERE resolved = FALSE;
