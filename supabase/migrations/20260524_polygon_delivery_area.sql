-- Replace multi-circle delivery zones with a single polygon-based delivery area

DROP TABLE IF EXISTS delivery_zones CASCADE;

CREATE TABLE IF NOT EXISTS delivery_area (
  id              text PRIMARY KEY DEFAULT 'current'
                  CHECK (id = 'current'),
  polygon_geojson jsonb NOT NULL,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE delivery_area ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read delivery_area"
  ON delivery_area FOR SELECT USING (true);
CREATE POLICY "Anyone can manage delivery_area"
  ON delivery_area FOR ALL USING (true) WITH CHECK (true);
