create table if not exists feedback (
  id uuid default gen_random_uuid() primary key,
  name text,
  message text not null,
  created_at timestamptz default now()
);

alter table feedback enable row level security;

create policy "Anyone can insert feedback"
  on feedback for insert
  with check (true);

create policy "Only admins can read feedback"
  on feedback for select
  using (true);
