-- Drop existing constraint/column if retrying
alter table orders drop column if exists order_number;
drop sequence if exists order_number_seq;

-- Create sequence and column (no default yet so no auto-fill on add)
create sequence order_number_seq start with 1;
alter table orders add column order_number integer;

-- Backfill existing orders with sequential numbers based on creation date
with numbered as (
  select id, row_number() over (order by created_at asc) as rn
  from orders
)
update orders
set order_number = numbered.rn
from numbered
where orders.id = numbered.id;

-- Now add the unique constraint and default for future orders
alter table orders alter column order_number set default nextval('order_number_seq');
alter table orders add constraint orders_order_number_key unique (order_number);

-- Reset sequence to continue after the highest existing number
select setval('order_number_seq', coalesce((select max(order_number) from orders), 0));
