-- Add a delivery contact phone number to orders.
-- Collected (required) at checkout from 26 Jun 2026; used only to reach the
-- customer during delivery if the driver can't find them. Nullable so older
-- orders (placed before this field existed) remain valid.
alter table orders add column if not exists phone text;
