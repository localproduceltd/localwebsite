-- The customer profile becomes the standing home of delivery details (orders
-- still snapshot them per week at checkout - routes/emails/slips read the order).
-- name: from Clerk at checkout (fixes the alphabetical Customers list).
-- default_*: prefill for the genuinely-weekly checkout questions.
-- admin_notes: Josie-only field ("gate code 1234"), shown on the driver's stop card.
alter table customer_profiles
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists delivery_instructions text,
  add column if not exists pin_lat numeric,
  add column if not exists pin_lng numeric,
  add column if not exists default_delivery_window text,
  add column if not exists default_delivery_option text,
  add column if not exists default_safe_place text,
  add column if not exists admin_notes text;

comment on column customer_profiles.name is 'Customer full name (from Clerk at checkout)';
comment on column customer_profiles.phone is 'Preferred contact number (prefills checkout)';
comment on column customer_profiles.delivery_instructions is 'Standing delivery instructions (prefills checkout)';
comment on column customer_profiles.pin_lat is 'Saved map pin - exact door location (prefills checkout)';
comment on column customer_profiles.pin_lng is 'Saved map pin - exact door location (prefills checkout)';
comment on column customer_profiles.default_delivery_window is 'Default for the weekly morning/afternoon/any question';
comment on column customer_profiles.default_delivery_option is 'Default for the weekly in/out question';
comment on column customer_profiles.default_safe_place is 'Default safe place for the weekly in/out question';
comment on column customer_profiles.admin_notes is 'Admin-only notes (gate codes, dogs, etc.) - shown to admin and on the driver stop card, never to the customer';
