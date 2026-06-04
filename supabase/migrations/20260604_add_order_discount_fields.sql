-- Capture discount / promo code details on each order.
-- NOTE: already applied to the live database (via Supabase migration
-- 20260604172928_add_order_discount_fields). Committed here so the repo
-- matches. Idempotent - safe to re-run.

alter table public.orders
  add column if not exists discount_code text,
  add column if not exists coupon_name text,
  add column if not exists discount_amount numeric;

comment on column public.orders.discount_code is 'Promotion code the customer typed at checkout (e.g. FREEFIRST). Null if no code / coupon applied directly.';
comment on column public.orders.coupon_name is 'Stripe coupon name behind the discount (e.g. FREE DELIVERY).';
comment on column public.orders.discount_amount is 'Amount discounted in GBP.';
