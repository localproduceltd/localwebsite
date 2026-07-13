-- Per-delivery-day box numbers: restart at 1 each Friday, assigned at order
-- creation, never reassigned (cancellations leave gaps). order_number stays
-- the permanent customer-facing reference.

alter table orders add column if not exists box_number integer;

create unique index if not exists orders_delivery_day_box_number_key
  on orders (delivery_day, box_number)
  where box_number is not null;

create or replace function assign_box_number()
returns trigger
language plpgsql
as $$
begin
  if new.box_number is null and new.delivery_day is not null and new.delivery_day <> '' then
    -- serialise per delivery day so concurrent checkouts can't take the same number
    perform pg_advisory_xact_lock(hashtext('box_number:' || new.delivery_day));
    select coalesce(max(box_number), 0) + 1
      into new.box_number
      from orders
     where delivery_day = new.delivery_day;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_box_number on orders;
create trigger orders_assign_box_number
  before insert on orders
  for each row execute function assign_box_number();

-- Backfill every existing order, numbered within its delivery day by order_number
with numbered as (
  select id, row_number() over (partition by delivery_day order by order_number) as rn
    from orders
   where delivery_day is not null and delivery_day <> ''
)
update orders o
   set box_number = n.rn
  from numbered n
 where o.id = n.id
   and o.box_number is null;

-- Carry the box number on the driver-run route rows too
alter table delivery_routes add column if not exists box_number integer;

update delivery_routes dr
   set box_number = o.box_number
  from orders o
 where o.id = dr.order_id
   and dr.box_number is null;
