-- Records which suppliers have had their Wednesday order summary for a given
-- delivery day (Aug 2026, when the 7pm send became automatic).
--
-- One row per supplier per delivery day = the double-send guard. The Vercel
-- cron fires twice (BST/GMT slots) and the manual backup button still exists,
-- so "have we already told this supplier?" has to be a fact in the database,
-- not an assumption about which one ran.
create table if not exists supplier_summary_sends (
  id uuid primary key default gen_random_uuid(),
  delivery_day date not null,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  sent_at timestamptz not null default now(),
  -- 'cron' = the automatic Wednesday send, 'manual' = the backup button.
  sent_by text not null default 'cron',
  unique (delivery_day, supplier_id)
);

create index if not exists supplier_summary_sends_day_idx
  on supplier_summary_sends (delivery_day);
