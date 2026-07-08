-- Track when we last sent an abandoned-basket reminder for each saved basket,
-- so the weekly cron (and the manual admin button) never double-send.
alter table saved_baskets
  add column if not exists reminder_sent_at timestamptz;
