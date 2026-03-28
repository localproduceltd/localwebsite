-- Customer profiles: stores saved postcode and coordinates
create table if not exists customer_profiles (
  id uuid default gen_random_uuid() primary key,
  clerk_user_id text unique not null,
  postcode text,
  lat double precision,
  lng double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Delivery settings: single row with centre point + radius
create table if not exists delivery_settings (
  id uuid default gen_random_uuid() primary key,
  centre_lat double precision not null default 53.0167,
  centre_lng double precision not null default -1.7333,
  radius_miles double precision not null default 15,
  updated_at timestamptz default now()
);

-- Insert default row (Ashbourne area, 15 mile radius)
insert into delivery_settings (centre_lat, centre_lng, radius_miles)
values (53.0167, -1.7333, 15)
on conflict do nothing;

-- RLS policies
alter table customer_profiles enable row level security;
alter table delivery_settings enable row level security;

-- Anyone can read delivery settings (public)
create policy "Anyone can read delivery_settings"
  on delivery_settings for select using (true);

-- Anyone can read/write customer profiles (auth handled in app via Clerk)
create policy "Anyone can read customer_profiles"
  on customer_profiles for select using (true);
create policy "Anyone can insert customer_profiles"
  on customer_profiles for insert with check (true);
create policy "Anyone can update customer_profiles"
  on customer_profiles for update using (true);
