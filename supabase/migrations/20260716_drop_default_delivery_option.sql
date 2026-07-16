-- The in/out choice is a weekly decision, not a standing fact about the
-- customer - so it's asked fresh at every checkout and never saved.
-- (Safe place, delivery instructions and address stay on the profile.)
alter table customer_profiles drop column if exists default_delivery_option;
