-- Core tables for venues, exhibitions, locations, hours, exceptions, photos, tombstones

-- Venues: exhibition venues with a canonical location and time zone
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  time_zone TEXT NOT NULL, -- IANA time zone
  geom geometry(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exhibitions: metadata and schedule attached to a venue, with optional override location
CREATE TABLE IF NOT EXISTS exhibitions (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published','draft','archived')) DEFAULT 'published',
  override_geom geometry(Point, 4326), -- optional override location for the exhibition
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exhibition locations: denormalized active location for KNN/distance queries
CREATE TABLE IF NOT EXISTS exhibition_locations (
  exhibition_id UUID PRIMARY KEY REFERENCES exhibitions(id) ON DELETE CASCADE,
  geom geometry(Point, 4326) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly hours for an exhibition (local venue time)
CREATE TABLE IF NOT EXISTS exhibition_hours (
  id UUID PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  overnight BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exhibition_id, day_of_week, open_time)
);

-- Date exceptions (closures or extended hours)
CREATE TABLE IF NOT EXISTS exhibition_exceptions (
  id UUID PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photos taken by users and the suggestion result recorded
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY,
  user_id UUID,
  captured_at TIMESTAMPTZ NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  suggested_exhibition_id UUID REFERENCES exhibitions(id) ON DELETE SET NULL,
  suggestion_confidence NUMERIC,
  suggestion_method TEXT CHECK (suggestion_method IN ('server','client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tombstones: record deletions for sync
CREATE TABLE IF NOT EXISTS tombstones (
  id UUID PRIMARY KEY,
  table_name TEXT NOT NULL,
  deleted_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


