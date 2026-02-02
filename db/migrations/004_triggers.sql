-- Keep exhibition_locations in sync with exhibitions.override_geom and venues.geom

-- Helper function to compute effective location for an exhibition
CREATE OR REPLACE FUNCTION compute_exhibition_location(p_exhibition_id UUID)
RETURNS geometry AS $$
DECLARE
  v_geom geometry(Point, 4326);
BEGIN
  SELECT COALESCE(e.override_geom, v.geom)
    INTO v_geom
  FROM exhibitions e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.id = p_exhibition_id;
  RETURN v_geom;
END;
$$ LANGUAGE plpgsql STABLE;

-- Upsert location row for an exhibition
CREATE OR REPLACE FUNCTION upsert_exhibition_location(p_exhibition_id UUID)
RETURNS VOID AS $$
DECLARE
  g geometry(Point, 4326);
  la DOUBLE PRECISION;
  lo DOUBLE PRECISION;
BEGIN
  g := compute_exhibition_location(p_exhibition_id);
  IF g IS NULL THEN
    -- If we cannot compute a geometry, remove any existing row
    DELETE FROM exhibition_locations WHERE exhibition_id = p_exhibition_id;
    RETURN;
  END IF;
  lo := ST_X(g);
  la := ST_Y(g);
  INSERT INTO exhibition_locations (exhibition_id, geom, lat, lon, updated_at)
  VALUES (p_exhibition_id, g, la, lo, NOW())
  ON CONFLICT (exhibition_id) DO UPDATE SET
    geom = EXCLUDED.geom,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger: after insert/update on exhibitions affecting location
CREATE OR REPLACE FUNCTION trg_exhibitions_location_sync()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM upsert_exhibition_location(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exhibitions_location_sync ON exhibitions;
CREATE TRIGGER exhibitions_location_sync
AFTER INSERT OR UPDATE OF override_geom, venue_id ON exhibitions
FOR EACH ROW EXECUTE FUNCTION trg_exhibitions_location_sync();

-- Trigger: when venue geometry changes, refresh all related exhibitions
CREATE OR REPLACE FUNCTION trg_venues_geom_sync()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE exhibition_locations el
    SET geom = COALESCE(e.override_geom, NEW.geom),
        lat = ST_Y(COALESCE(e.override_geom, NEW.geom)),
        lon = ST_X(COALESCE(e.override_geom, NEW.geom)),
        updated_at = NOW()
  FROM exhibitions e
  WHERE e.id = el.exhibition_id
    AND e.venue_id = NEW.id
    AND e.override_geom IS NULL; -- only those inheriting venue geom

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS venues_geom_sync ON venues;
CREATE TRIGGER venues_geom_sync
AFTER UPDATE OF geom ON venues
FOR EACH ROW EXECUTE FUNCTION trg_venues_geom_sync();


