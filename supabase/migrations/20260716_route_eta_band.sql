-- Rough arrival band per route stop (e.g. "9-10am"), computed by the Thursday
-- route build from the stop's position in its leg. Shown on the Driver Run tab
-- and quoted in the prepped ("coming tomorrow") emails.
alter table delivery_routes add column if not exists eta_band text;

comment on column delivery_routes.eta_band is 'Rough hour arrival band for this stop, e.g. "9-10am" (from the route build)';
