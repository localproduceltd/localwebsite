-- ─────────────────────────────────────────────────────────────────────────────
-- Local Produce Ltd — Complete Database Schema
-- Run this on a fresh Supabase project to set up all tables, policies, and triggers.
-- Then run seed-data.sql (optional) and storage-setup.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Sequences ───────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  image         text NOT NULL DEFAULT '',
  location      text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT '',
  lat           double precision,
  lng           double precision,
  active        boolean NOT NULL DEFAULT true,
  status        text DEFAULT 'live',
  email         text,
  created_at    timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  price             numeric NOT NULL DEFAULT 0,
  unit              text NOT NULL DEFAULT '',
  image             text NOT NULL DEFAULT '',
  category          text NOT NULL DEFAULT '',
  in_stock          boolean NOT NULL DEFAULT true,
  locality          text DEFAULT 'Local',
  lat               double precision,
  lng               double precision,
  variable_location boolean DEFAULT false,
  status            text NOT NULL DEFAULT 'approved',
  rejection_reason  text,
  archived_at       timestamptz,
  allergens         text[] DEFAULT '{}',
  tags              text[] DEFAULT '{}',
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_archived_at ON products(archived_at);

-- Delivery days
CREATE TABLE IF NOT EXISTS delivery_days (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date  date NOT NULL,
  cutoff_date    date NOT NULL,
  cutoff_time    time NOT NULL DEFAULT '18:00:00',
  created_at     timestamptz DEFAULT now()
);

-- Delivery settings (single-row table for map centre + radius)
CREATE TABLE IF NOT EXISTS delivery_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_lat     double precision NOT NULL DEFAULT 53.0167,
  centre_lng     double precision NOT NULL DEFAULT -1.7333,
  radius_miles   double precision NOT NULL DEFAULT 15,
  updated_at     timestamptz DEFAULT now()
);

-- Delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  centre_lat     double precision NOT NULL,
  centre_lng     double precision NOT NULL,
  radius_miles   double precision NOT NULL DEFAULT 5,
  zone_status    text NOT NULL DEFAULT 'live',
  launch_date    date,
  created_at     timestamptz DEFAULT now()
);

-- Customer profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id         text NOT NULL UNIQUE,
  postcode              text,
  address_line1         text,
  address_line2         text,
  city                  text,
  lat                   double precision,
  lng                   double precision,
  has_outstanding_box   boolean DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      integer DEFAULT nextval('order_number_seq'),
  user_id           text NOT NULL,
  customer_email    text,
  total             numeric NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending',
  delivery_day      text NOT NULL DEFAULT '',
  delivery_window   text,
  will_be_in        boolean DEFAULT true,
  safe_place        text,
  box_deposit_paid  boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name     text NOT NULL,
  quantity         integer NOT NULL DEFAULT 1,
  price            numeric NOT NULL DEFAULT 0,
  supplier_id      uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_status  text NOT NULL DEFAULT 'order_placed'
);
CREATE INDEX IF NOT EXISTS idx_order_items_supplier_id ON order_items(supplier_id);

-- Supplier users (links Clerk users to suppliers)
CREATE TABLE IF NOT EXISTS supplier_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  text NOT NULL,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_users_clerk_id ON supplier_users(clerk_user_id);

-- Ratings
CREATE TABLE IF NOT EXISTS ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stars       integer NOT NULL,
  comment     text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id, order_id)
);

-- Feedback (Carrie the Carrot + order reviews)
CREATE TABLE IF NOT EXISTS feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,
  message       text NOT NULL,
  source        text DEFAULT 'carrie',
  order_number  integer,
  created_at    timestamptz DEFAULT now()
);

-- Email signups (pre-launch marketing)
CREATE TABLE IF NOT EXISTS email_signups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_signups_email ON email_signups(email);
CREATE INDEX IF NOT EXISTS idx_email_signups_created_at ON email_signups(created_at DESC);

-- ─── Row-Level Security ──────────────────────────────────────────────────────
-- NOTE: Auth is handled in the app layer via Clerk. These policies are
-- permissive by design; tighten them once Supabase JWT verification is added.

ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback           ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_signups      ENABLE ROW LEVEL SECURITY;

-- Suppliers
CREATE POLICY "Public read suppliers"    ON suppliers FOR SELECT USING (true);
CREATE POLICY "Allow all write suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- Products
CREATE POLICY "Public read products"     ON products FOR SELECT USING (true);
CREATE POLICY "Allow all write products"  ON products FOR ALL USING (true) WITH CHECK (true);

-- Delivery days
CREATE POLICY "Public read delivery_days"     ON delivery_days FOR SELECT USING (true);
CREATE POLICY "Allow all write delivery_days"  ON delivery_days FOR ALL USING (true) WITH CHECK (true);

-- Delivery settings / zones
CREATE POLICY "Public read delivery_settings" ON delivery_settings FOR SELECT USING (true);
CREATE POLICY "Allow all write delivery_settings" ON delivery_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read delivery_zones"    ON delivery_zones FOR SELECT USING (true);
CREATE POLICY "Allow all write delivery_zones" ON delivery_zones FOR ALL USING (true) WITH CHECK (true);

-- Customer profiles
CREATE POLICY "Public read customer_profiles"    ON customer_profiles FOR SELECT USING (true);
CREATE POLICY "Allow all write customer_profiles" ON customer_profiles FOR ALL USING (true) WITH CHECK (true);

-- Orders
CREATE POLICY "Public read orders"     ON orders FOR SELECT USING (true);
CREATE POLICY "Allow all write orders"  ON orders FOR ALL USING (true) WITH CHECK (true);

-- Order items
CREATE POLICY "Public read order_items"     ON order_items FOR SELECT USING (true);
CREATE POLICY "Allow all write order_items"  ON order_items FOR ALL USING (true) WITH CHECK (true);

-- Supplier users
CREATE POLICY "Public read supplier_users"     ON supplier_users FOR SELECT USING (true);
CREATE POLICY "Allow all write supplier_users"  ON supplier_users FOR ALL USING (true) WITH CHECK (true);

-- Ratings
CREATE POLICY "Public read ratings"    ON ratings FOR SELECT USING (true);
CREATE POLICY "Allow all write ratings" ON ratings FOR ALL USING (true) WITH CHECK (true);

-- Feedback
CREATE POLICY "Public read feedback"    ON feedback FOR SELECT USING (true);
CREATE POLICY "Allow all write feedback" ON feedback FOR ALL USING (true) WITH CHECK (true);

-- Email signups
CREATE POLICY "Anyone can sign up"      ON email_signups FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view signups" ON email_signups FOR SELECT TO authenticated USING (true);

-- ─── Triggers ────────────────────────────────────────────────────────────────
-- Cascade: when an order's status changes, update its order_items accordingly.
CREATE OR REPLACE FUNCTION cascade_order_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' THEN
    UPDATE order_items SET supplier_status = 'delivered' WHERE order_id = NEW.id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE order_items SET supplier_status = 'cancelled' WHERE order_id = NEW.id;
  ELSIF NEW.status = 'confirmed' AND OLD.status IN ('delivered', 'cancelled') THEN
    UPDATE order_items SET supplier_status = 'dropped_at_depot' WHERE order_id = NEW.id;
  ELSIF NEW.status = 'pending' AND OLD.status IN ('confirmed', 'delivered', 'cancelled') THEN
    UPDATE order_items SET supplier_status = 'order_placed' WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cascade_order_status_trigger ON orders;
CREATE TRIGGER cascade_order_status_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION cascade_order_status();
