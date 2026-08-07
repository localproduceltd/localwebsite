-- Explicit supplier deduction on refunds (£, retail value, pre-commission).
-- Null = legacy behaviour: didn't-arrive units implicitly drop out of the
-- payout in full; arrived refunds deduct the who-pays share of the refund.
alter table order_item_refunds add column if not exists supplier_deduction numeric;
