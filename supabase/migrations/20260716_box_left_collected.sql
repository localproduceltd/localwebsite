-- Per-delivery record of what happened with Local cool boxes at the door,
-- captured by the driver when marking a stop delivered. Null = not recorded
-- (order pre-dates this, or not yet delivered).
alter table orders add column if not exists box_left boolean;
alter table orders add column if not exists box_collected boolean;

comment on column orders.box_left is 'Driver left a Local cool box with the customer at this delivery (null = not recorded)';
comment on column orders.box_collected is 'Driver collected an empty Local box back at this delivery (null = not recorded)';
