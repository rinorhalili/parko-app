CREATE OR REPLACE FUNCTION set_parking_geo_point()
RETURNS trigger AS $$
BEGIN
  NEW."geoPoint" := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parking_spot_set_geo_point ON "ParkingSpot";
CREATE TRIGGER parking_spot_set_geo_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON "ParkingSpot"
FOR EACH ROW EXECUTE FUNCTION set_parking_geo_point();

-- ParkingReport uses the same latitude/longitude/geoPoint shape. Keeping it on
-- the same database invariant makes the removed report-side raw UPDATE safe.
DROP TRIGGER IF EXISTS parking_report_set_geo_point ON "ParkingReport";
CREATE TRIGGER parking_report_set_geo_point
BEFORE INSERT OR UPDATE OF latitude, longitude ON "ParkingReport"
FOR EACH ROW EXECUTE FUNCTION set_parking_geo_point();

-- One-time backfill for rows created before the triggers existed.
UPDATE "ParkingSpot"
SET "geoPoint" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE "geoPoint" IS NULL;

UPDATE "ParkingReport"
SET "geoPoint" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE "geoPoint" IS NULL;
