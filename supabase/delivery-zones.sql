-- Delivery zones: multiple named zones, each with a centre + radius
create table if not exists delivery_zones (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  centre_lat double precision not null,
  centre_lng double precision not null,
  radius_miles double precision not null default 5,
  created_at timestamptz default now()
);

-- RLS
alter table delivery_zones enable row level security;

create policy "Anyone can read delivery_zones"
  on delivery_zones for select using (true);
create policy "Anyone can insert delivery_zones"
  on delivery_zones for insert with check (true);
create policy "Anyone can update delivery_zones"
  on delivery_zones for update using (true);
create policy "Anyone can delete delivery_zones"
  on delivery_zones for delete using (true);

-- Seed with Ashbourne & Belper
insert into delivery_zones (name, centre_lat, centre_lng, radius_miles) values
  ('Ashbourne', 53.0167, -1.7333, 5),
  ('Belper', 53.0240, -1.4827, 5);

-- Migrate any existing single delivery_settings into first zone (skip if already seeded)
-- You can drop delivery_settings table after confirming zones work:
-- drop table if exists delivery_settings;
