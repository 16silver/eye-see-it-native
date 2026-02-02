-- Spatial and btree indexes for performance

-- Venues spatial index
CREATE INDEX IF NOT EXISTS venues_geom_gist ON venues USING GIST (geom);

-- Exhibitions time range and status
CREATE INDEX IF NOT EXISTS exhibitions_time_idx ON exhibitions (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS exhibitions_status_idx ON exhibitions (status);

-- Partial index for published exhibitions
CREATE INDEX IF NOT EXISTS exhibitions_published_idx ON exhibitions (starts_at, ends_at) WHERE status = 'published';

-- Exhibition override geom spatial index
CREATE INDEX IF NOT EXISTS exhibitions_override_geom_gist ON exhibitions USING GIST (override_geom);

-- Exhibition locations spatial index
CREATE INDEX IF NOT EXISTS exhibition_locations_geom_gist ON exhibition_locations USING GIST (geom);


