-- 1. Add 'status' column to products (pending / approved / rejected)
--    Default 'approved' so all existing products remain live.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

-- 2. Add 'active' column to suppliers (controls visibility on public site)
--    Default true so all existing suppliers remain live.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- 3. Create supplier_users table to link Clerk users to suppliers
CREATE TABLE IF NOT EXISTS supplier_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by clerk user id
CREATE INDEX IF NOT EXISTS idx_supplier_users_clerk_id ON supplier_users(clerk_user_id);
