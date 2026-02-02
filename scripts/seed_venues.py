#!/usr/bin/env python3
import argparse
import csv
import os
import sys
import uuid
from typing import Dict, Any

import psycopg2
from psycopg2.extras import execute_values

try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    def load_dotenv(*_args: Any, **_kwargs: Any) -> None:
        return


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed venues into Postgres (with PostGIS)")
    p.add_argument(
        "--file",
        default=os.path.join("data", "venues.sample.csv"),
        help="CSV file path (columns: name,address,time_zone,lon,lat)",
    )
    p.add_argument(
        "--update-existing",
        action="store_true",
        help="If a venue with same (name,address) exists, update its location/time_zone",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and show operations without committing",
    )
    return p.parse_args()


def get_conn():
    load_dotenv()
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL env var is not set.", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    return conn


def read_rows(path: str):
    if not os.path.exists(path):
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        required = {"name", "address", "time_zone", "lon", "lat"}
        missing = required - set([c.strip() for c in rdr.fieldnames or []])
        if missing:
            print(f"ERROR: missing columns in CSV: {', '.join(sorted(missing))}", file=sys.stderr)
            sys.exit(1)
        for row in rdr:
            try:
                name = row["name"].strip()
                address = row["address"].strip()
                tz = row["time_zone"].strip()
                lon = float(row["lon"])
                lat = float(row["lat"])
                yield {
                    "name": name,
                    "address": address,
                    "time_zone": tz,
                    "lon": lon,
                    "lat": lat,
                }
            except Exception as e:
                print(f"SKIP: invalid row {row} ({e})", file=sys.stderr)


def find_existing_id(cur, name: str, address: str):
    cur.execute(
        "SELECT id FROM venues WHERE name = %s AND address = %s LIMIT 1",
        (name, address),
    )
    r = cur.fetchone()
    return r[0] if r else None


def upsert_one(cur, row: Dict[str, Any], update_existing: bool):
    existing_id = find_existing_id(cur, row["name"], row["address"])
    if existing_id and update_existing:
        cur.execute(
            """
            UPDATE venues
            SET time_zone = %s,
                geom = ST_SetSRID(ST_MakePoint(%s,%s), 4326),
                updated_at = NOW()
            WHERE id = %s
            """,
            (row["time_zone"], row["lon"], row["lat"], existing_id),
        )
        return ("update", existing_id)
    else:
        new_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO venues (id, name, address, time_zone, geom, created_at, updated_at)
            VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s,%s), 4326), NOW(), NOW())
            """,
            (new_id, row["name"], row["address"], row["time_zone"], row["lon"], row["lat"]),
        )
        return ("insert", new_id)


def main():
    args = parse_args()
    rows = list(read_rows(args.file))
    if not rows:
        print("No valid rows to process.")
        return
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            created, updated = 0, 0
            for row in rows:
                op, _id = upsert_one(cur, row, args.update_existing)
                if op == "insert":
                    created += 1
                else:
                    updated += 1
            if args.dry_run:
                conn.rollback()
                print(f"[DRY-RUN] would insert: {created}, update: {updated}")
            else:
                conn.commit()
                print(f"done. inserted: {created}, updated: {updated}")
    except Exception as e:
        conn.rollback()
        print("ERROR:", e, file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()



