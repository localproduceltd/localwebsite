-- "Something not right?" - customer-reported problems with a delivered box
-- (Aug 2026). Before this, customers just emailed Josie and it lived in her
-- inbox with no record and no link to the refund.
--
-- A report is NEVER a refund. It's a claim that Josie decides on: refund (in
-- full or in part), or reply explaining why not. Both close the report.
create table if not exists order_issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- Matched by name, like order_item_refunds, so it survives a product being
  -- edited or archived after the fact.
  product_name text not null,
  quantity integer not null default 1,

  -- What the customer says went wrong. 'damaged' is ours (crushed in packing
  -- or transit); 'quality' is the farm's (off, mouldy, past its best) - split
  -- because they point at different people paying.
  issue_type text not null check (
    issue_type in ('missing', 'short', 'too_many', 'wrong_item', 'damaged', 'quality', 'other')
  ),
  customer_note text,

  -- open      = waiting on Josie
  -- refunded  = money went back (refund_id points at it)
  -- declined  = no refund, customer told why
  -- noted     = nothing owed, e.g. "I got too many" - thanked and closed
  status text not null default 'open' check (status in ('open', 'refunded', 'declined', 'noted')),
  refund_id uuid references order_item_refunds(id) on delete set null,
  admin_reply text,

  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- One open report per line, so a customer can't stack reports on the same item.
-- Closed ones don't block a later, genuinely separate report.
create unique index if not exists order_issues_one_open_per_line
  on order_issues (order_id, product_name) where status = 'open';

create index if not exists order_issues_open_idx
  on order_issues (status) where status = 'open';

create index if not exists order_issues_order_idx on order_issues (order_id);
