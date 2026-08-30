-- Two-stage refunds (Aug 2026).
--
-- The customer leg is settled on the packing bench the moment a shortfall is
-- found - Luke refunds the card and emails the customer. The supplier leg
-- (who bears the cost, and what we say to them) waits for Josie, who works a
-- queue on the Stock tab. New suppliers often get grace on their first weeks,
-- so it's a judgement call, never automatic.

-- The old single refund_reason went into BOTH the customer's email and the
-- supplier's notice, so a bench note like "couldn't find this" landed in the
-- customer's inbox. Split in two: customer_note is what they're told,
-- supplier_note is Josie's private line to the producer.
alter table order_item_refunds add column if not exists customer_note text;
alter table order_item_refunds add column if not exists supplier_note text;

-- 'pending' = customer refunded, supplier side not yet decided (no notice sent,
-- payout not safe to run). 'settled' = Josie has made the call.
alter table order_item_refunds add column if not exists supplier_status text not null default 'pending';
alter table order_item_refunds add column if not exists settled_at timestamptz;

-- What the packer reckoned at the bench: 'supplier' | 'local' | 'unsure'.
-- A hint on Josie's queue, never a decision.
alter table order_item_refunds add column if not exists fault_hint text;

-- Existing rows: their supplier notices already went out and their payouts have
-- run, so they're settled by definition, and the old single reason field was
-- what the customer saw.
update order_item_refunds set customer_note = refund_reason where customer_note is null;
update order_item_refunds set supplier_status = 'settled', settled_at = coalesce(settled_at, refunded_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'order_item_refunds_supplier_status_check'
  ) then
    alter table order_item_refunds
      add constraint order_item_refunds_supplier_status_check
      check (supplier_status in ('pending', 'settled'));
  end if;
end $$;

create index if not exists order_item_refunds_pending_idx
  on order_item_refunds (supplier_status) where supplier_status = 'pending';
