-- Featured products + two-week activity stats.
-- products.featured_at: when the supplier starred it (NULL = not featured).
-- Featured products pin to the top of the supplier's own page (oldest star
-- first, so the order they picked them) and join the "recent activity" top
-- band on the main products page. Max 3 per supplier is enforced in the
-- portal (setProductFeatured in src/lib/data.ts), not at the DB level.

ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_at timestamptz;

-- Recreate products_with_stats with featured_at and 14-day activity counts
-- appended (new columns must go at the end for CREATE OR REPLACE).
-- recent_order_count excludes cancelled lines; the all-time order_count is
-- left as-is (it predates supplier_status and other pages rely on it).
CREATE OR REPLACE VIEW products_with_stats AS
SELECT p.id,
    p.supplier_id,
    p.name,
    p.description,
    p.price,
    p.unit,
    p.image,
    p.category,
    p.in_stock,
    p.created_at,
    p.locality,
    p.lat,
    p.lng,
    p.status,
    p.rejection_reason,
    p.archived_at,
    p.allergens,
    p.tags,
    p.variable_location,
    p.ingredients,
    COALESCE(r.avg_rating, 0::numeric)::numeric(3,2) AS avg_rating,
    COALESCE(r.rating_count, 0::bigint)::integer AS rating_count,
    COALESCE(o.order_count, 0::bigint)::integer AS order_count,
    p.refrigerated,
    p.weekly_stock,
    p.featured_at,
    COALESCE(ro.recent_order_count, 0::bigint)::integer AS recent_order_count,
    COALESCE(rr.recent_rating_count, 0::bigint)::integer AS recent_rating_count
   FROM products p
     LEFT JOIN ( SELECT ratings.product_id,
            avg(ratings.stars) AS avg_rating,
            count(*) AS rating_count
           FROM ratings
          GROUP BY ratings.product_id) r ON r.product_id = p.id
     LEFT JOIN ( SELECT order_items.product_id,
            sum(order_items.quantity) AS order_count
           FROM order_items
          GROUP BY order_items.product_id) o ON o.product_id = p.id
     LEFT JOIN ( SELECT oi.product_id,
            sum(oi.quantity) AS recent_order_count
           FROM order_items oi
             JOIN orders ord ON ord.id = oi.order_id
          WHERE oi.supplier_status <> 'cancelled'
            AND ord.created_at >= now() - interval '14 days'
          GROUP BY oi.product_id) ro ON ro.product_id = p.id
     LEFT JOIN ( SELECT ratings.product_id,
            count(*) AS recent_rating_count
           FROM ratings
          WHERE ratings.created_at >= now() - interval '14 days'
          GROUP BY ratings.product_id) rr ON rr.product_id = p.id;
