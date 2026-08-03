-- Add optional email capture to feedback (Carrie form + map/checkout expansion requests)
alter table feedback add column if not exists email text;
