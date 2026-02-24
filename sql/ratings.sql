create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  product_id uuid not null references products(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  stars integer not null check (stars >= 1 and stars <= 5),
  created_at timestamptz default now(),
  unique(user_id, product_id, order_id)
);

alter table ratings enable row level security;

create policy "Anyone can insert ratings"
  on ratings for insert
  with check (true);

create policy "Anyone can read ratings"
  on ratings for select
  using (true);

-- Seed some starter ratings for existing products
-- Uses a random spread of 3-5 stars from a fake user
insert into ratings (user_id, product_id, order_id, stars)
select
  'seed_user_' || (random() * 5 + 1)::int,
  p.id,
  o.id,
  (random() * 2 + 3)::int  -- random 3, 4, or 5
from products p
cross join lateral (
  select id from orders order by random() limit 1
) o
where p.status = 'approved'
on conflict do nothing;

-- Add a second round of ratings for variety
insert into ratings (user_id, product_id, order_id, stars)
select
  'seed_user_' || (random() * 5 + 6)::int,
  p.id,
  o.id,
  (random() * 2 + 3)::int
from products p
cross join lateral (
  select id from orders offset 1 limit 1
) o
where p.status = 'approved'
on conflict do nothing;
