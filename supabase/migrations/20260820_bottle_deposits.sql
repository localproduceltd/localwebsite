-- Milk bottle deposits: track how many bottles a customer has out, and the
-- credit they're owed once they tell us the empties are back.
--
-- Until now the only trace of a bottle deposit was orders.bottle_deposit_paid
-- (a boolean). The quantity went to Stripe and was never stored, so nothing
-- could work out what anyone was owed.
--
-- Two parts:
--   1. orders.bottle_deposit_qty - how many bottles that order charged for
--   2. bottle_deposit_ledger     - the running record per customer
--
-- The ledger is the source of truth for balances, NOT a column on
-- customer_profiles: that table's RLS policies allow anyone to update any row,
-- so a credit stored there could be rewritten with the public anon key that
-- ships in the browser bundle. This table has RLS on and deliberately no
-- policies, so the anon key can neither read nor write it - only the
-- service-role key (server routes and scripts) can.

alter table orders add column if not exists bottle_deposit_qty integer not null default 0;

comment on column orders.bottle_deposit_qty is
  'How many bottles a deposit was charged for on this order (0 if none).';

create table if not exists bottle_deposit_ledger (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  order_id uuid references orders(id) on delete set null,
  kind text not null check (kind in ('deposit', 'returned', 'credit_applied', 'adjustment')),
  -- Bottles physically with the customer: +n when a delivery goes out with a
  -- deposit on it, -n when they tell us the empties are back.
  bottles_delta integer not null default 0,
  -- Money owed back to them, in pence: +100 per bottle when returned, and
  -- negative when that credit comes off a later order.
  credit_delta_pence integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

comment on table bottle_deposit_ledger is
  'Append-only record of bottle deposits, returns and credit. Balances are the '
  'sum of the deltas per clerk_user_id. Service-role access only.';

-- One deposit row per order, so the Stripe webhook and the /checkout/confirm
-- route racing on the same session cannot double-count.
create unique index if not exists bottle_deposit_ledger_one_deposit_per_order
  on bottle_deposit_ledger (order_id) where kind = 'deposit';

-- Same guard for credit spent on an order.
create unique index if not exists bottle_deposit_ledger_one_credit_per_order
  on bottle_deposit_ledger (order_id) where kind = 'credit_applied';

create index if not exists bottle_deposit_ledger_user_idx
  on bottle_deposit_ledger (clerk_user_id);

alter table bottle_deposit_ledger enable row level security;
-- Deliberately no policies: service-role only.
