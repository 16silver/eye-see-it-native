import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';

export const exhibitionsRouter = Router();

// GET /exhibitions/nearby-open
exhibitionsRouter.get('/nearby-open', async (req, res) => {
  try {
    const schema = z.object({
      lat: z.coerce.number(),
      lon: z.coerce.number(),
      at: z.string().datetime().or(z.coerce.date().transform(d => d.toISOString())).optional(),
      radius_m: z.coerce.number().default(3000),
      limit: z.coerce.number().default(1),
    });
    const parsed = schema.parse(req.query);
    const atIso = parsed.at ?? new Date().toISOString();

    const sql = `
      WITH p AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS pt
      )
      SELECT e.id, e.title, v.name AS venue_name,
             ST_DistanceSphere(l.geom, p.pt) AS distance_m,
             ST_X(l.geom) AS lon, ST_Y(l.geom) AS lat
      FROM exhibitions e
      JOIN exhibition_locations l ON l.exhibition_id = e.id
      JOIN venues v ON v.id = e.venue_id, p
      WHERE e.status='published'
        AND e.starts_at <= $3 AND e.ends_at >= $3
        AND is_exhibition_open(e.id, $3)
        AND ST_DWithin(l.geom::geography, p.pt::geography, $4)
      ORDER BY l.geom <-> p.pt
      LIMIT $5;
    `;
    const resp = await query(sql, [parsed.lon, parsed.lat, atIso, parsed.radius_m, parsed.limit]);
    res.json({ items: resp.rows });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? String(err) });
  }
});

// GET /exhibitions/sync
// Returns venues, exhibitions, hours, exceptions updated since a timestamp, optionally within a radius of a center point
exhibitionsRouter.get('/sync', async (req, res) => {
  try {
    const schema = z.object({
      center_lat: z.coerce.number().optional(),
      center_lon: z.coerce.number().optional(),
      radius_m: z.coerce.number().default(10000),
      since: z.string().datetime().optional(),
    }).refine(v => (!v.center_lat && !v.center_lon) || (typeof v.center_lat === 'number' && typeof v.center_lon === 'number'), {
      message: 'center_lat and center_lon must be provided together'
    });
    const p = schema.parse(req.query);
    const since = p.since ?? '1970-01-01T00:00:00.000Z';

    // Build a temp set of exhibition ids in scope
    const idSql = `
      WITH scope AS (
        SELECT e.id
        FROM exhibitions e
        JOIN exhibition_locations l ON l.exhibition_id = e.id
        WHERE e.updated_at >= $1 OR e.created_at >= $1
        ${p.center_lat !== undefined ? 'AND ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $4)' : ''}
      )
      SELECT id FROM scope;
    `;
    const idParams: any[] = [since];
    if (p.center_lat !== undefined) {
      idParams.push(p.center_lon, p.center_lat, p.radius_m);
    }
    const idRows = await query<{ id: string }>(idSql, idParams);
    const ids = idRows.rows.map(r => r.id);

    // If nothing changed, still check tombstones
    const venuesSql = ids.length ? `
      SELECT DISTINCT v.* FROM venues v
      JOIN exhibitions e ON e.venue_id = v.id
      WHERE e.id = ANY($1)
    ` : 'SELECT * FROM venues WHERE updated_at >= $1';
    const exhibitionsSql = ids.length ? 'SELECT * FROM exhibitions WHERE id = ANY($1)' : 'SELECT * FROM exhibitions WHERE updated_at >= $1 OR created_at >= $1';
    const hoursSql = ids.length ? 'SELECT * FROM exhibition_hours WHERE exhibition_id = ANY($1)' : 'SELECT * FROM exhibition_hours WHERE updated_at >= $1 OR created_at >= $1';
    const exceptionsSql = ids.length ? 'SELECT * FROM exhibition_exceptions WHERE exhibition_id = ANY($1)' : 'SELECT * FROM exhibition_exceptions WHERE updated_at >= $1 OR created_at >= $1';
    const tombsSql = 'SELECT * FROM tombstones WHERE deleted_at >= $1 AND table_name IN (\'venues\', \'exhibitions\', \'exhibition_hours\', \'exhibition_exceptions\')';

    const [venuesRes, exhibitionsRes, hoursRes, exceptionsRes, tombsRes] = await Promise.all([
      query(venuesSql, ids.length ? [ids] : [since]),
      query(exhibitionsSql, ids.length ? [ids] : [since]),
      query(hoursSql, ids.length ? [ids] : [since]),
      query(exceptionsSql, ids.length ? [ids] : [since]),
      query(tombsSql, [since]),
    ]);

    res.json({
      since,
      venues: venuesRes.rows,
      exhibitions: exhibitionsRes.rows,
      exhibition_hours: hoursRes.rows,
      exhibition_exceptions: exceptionsRes.rows,
      tombstones: tombsRes.rows,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? String(err) });
  }
});


