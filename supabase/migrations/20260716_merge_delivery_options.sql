-- Merge the four delivery options into three. "In but don't disturb" and
-- "out with own cool bag" were the same job for the driver (don't knock,
-- fill the customer's own bag/box in the safe place), so they become one.
--   in               -> in            (knock and hand over)
--   in_no_disturb    -> own_coolbag   (don't knock - fill their own bag/box)
--   out_own_coolbag  -> own_coolbag
--   out_need_coolbag -> local_coolbox (borrowed Local cool box, £10 deposit)
update orders
  set delivery_option = 'own_coolbag'
  where delivery_option in ('in_no_disturb', 'out_own_coolbag');
update orders
  set delivery_option = 'local_coolbox'
  where delivery_option = 'out_need_coolbag';

update customer_profiles
  set default_delivery_option = 'own_coolbag'
  where default_delivery_option in ('in_no_disturb', 'out_own_coolbag');
update customer_profiles
  set default_delivery_option = 'local_coolbox'
  where default_delivery_option = 'out_need_coolbag';

comment on column orders.delivery_option is 'Delivery preference: in (knock and hand over), own_coolbag (don''t knock - fill the customer''s own cool bag/box in their safe place), local_coolbox (borrowed Local cool box, refundable deposit)';
