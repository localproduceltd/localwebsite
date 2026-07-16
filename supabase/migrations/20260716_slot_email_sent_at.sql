-- Guard against double-sending the Thursday "your slot" email to "any"-window
-- customers (sent via Resend by POST /api/admin/slot-emails after Josie
-- approves the route). Null = not sent for this order.
alter table orders add column if not exists slot_email_sent_at timestamptz;

comment on column orders.slot_email_sent_at is 'When the Thursday slot email was sent to this (delivery_window=any) order - null = not sent';
