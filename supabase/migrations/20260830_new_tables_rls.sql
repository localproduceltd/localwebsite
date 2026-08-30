-- RLS on the two tables added 30 Aug 2026. Both were created without it, which
-- Supabase's own linter flags as an error: a public table with RLS off is
-- readable and writable by anyone holding the anon key, and that key ships in
-- the browser bundle.
--
-- Matches the posture of the sibling tables (order_item_refunds,
-- order_item_checkins, supplier_product_flags): permissive for the app, plus
-- the sophia_readonly reporting role.

-- order_issues is read client-side (the Stock queue, the Orders badge, and the
-- customer's own /account page), so it needs the same open policy its siblings
-- have. Writes still only ever happen through the API on the service role,
-- which checks the order actually belongs to the person reporting.
alter table order_issues enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='order_issues' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on order_issues for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='order_issues' and policyname='sophia_readonly_select') then
    create policy "sophia_readonly_select" on order_issues for select to sophia_readonly using (true);
  end if;
end $$;

-- supplier_summary_sends is only ever touched server-side (the cron and the
-- backup button, both on the service role, which bypasses RLS). No app policy
-- needed - just the reporting role.
alter table supplier_summary_sends enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='supplier_summary_sends' and policyname='sophia_readonly_select') then
    create policy "sophia_readonly_select" on supplier_summary_sends for select to sophia_readonly using (true);
  end if;
end $$;
