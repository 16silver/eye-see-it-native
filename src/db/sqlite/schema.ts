import { execBatch } from './index';

export async function migrateSqlite(): Promise<void> {
  await execBatch([
    { sql: `CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      time_zone TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      updated_at TEXT NOT NULL
    );` },
    { sql: `CREATE TABLE IF NOT EXISTS exhibitions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      venue_id TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      updated_at TEXT NOT NULL
    );` },
    { sql: `CREATE TABLE IF NOT EXISTS exhibition_hours (
      id TEXT PRIMARY KEY,
      exhibition_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      open_time TEXT NOT NULL,
      close_time TEXT NOT NULL,
      overnight INTEGER NOT NULL
    );` },
    { sql: `CREATE TABLE IF NOT EXISTS exhibition_exceptions (
      id TEXT PRIMARY KEY,
      exhibition_id TEXT NOT NULL,
      date TEXT NOT NULL,
      closed INTEGER NOT NULL,
      open_time TEXT,
      close_time TEXT
    );` },
    { sql: `CREATE TABLE IF NOT EXISTS tombstones (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      deleted_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    );` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_exhibitions_time ON exhibitions(starts_at, ends_at);` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_exhibitions_status ON exhibitions(status);` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_exhibitions_venue ON exhibitions(venue_id);` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_hours_exhibition ON exhibition_hours(exhibition_id);` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_exc_exhibition ON exhibition_exceptions(exhibition_id);` },
  ]);
}


