import { execBatch, execSql } from '../db/sqlite';
import { migrateSqlite } from '../db/sqlite/schema';
import { haversineDistanceMeters } from '../utils/capturePolicy';

export const SERVER_BASE_URL = process.env.EXPO_PUBLIC_SERVER_BASE_URL || '';

export async function ensureLocalDb() {
  await migrateSqlite();
}

type VenueRow = { id: string; name: string; address?: string | null; time_zone: string; lat: number; lon: number; updated_at: string };
type ExhibitionRow = { id: string; title: string; venue_id: string; starts_at: string; ends_at: string; status: string; lat: number; lon: number; updated_at: string };
type HoursRow = { id: string; exhibition_id: string; day_of_week: number; open_time: string; close_time: string; overnight: number };
type ExceptionRow = { id: string; exhibition_id: string; date: string; closed: number; open_time?: string | null; close_time?: string | null };

export async function syncExhibitions(params: { center?: { lat: number; lon: number }; radiusM?: number; since?: string }): Promise<{ updated: number }>
{
  if (!SERVER_BASE_URL) return { updated: 0 };
  await ensureLocalDb();
  const url = new URL('/exhibitions/sync', SERVER_BASE_URL);
  if (params.center) {
    url.searchParams.set('center_lat', String(params.center.lat));
    url.searchParams.set('center_lon', String(params.center.lon));
  }
  if (params.radiusM) url.searchParams.set('radius_m', String(params.radiusM));
  if (params.since) url.searchParams.set('since', params.since);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error('sync failed');
  const data = await resp.json();

  const venues: VenueRow[] = data.venues || [];
  const exhibitions: ExhibitionRow[] = data.exhibitions || [];
  const hours: HoursRow[] = data.exhibition_hours || [];
  const exceptions: ExceptionRow[] = data.exhibition_exceptions || [];
  const tombs: Array<{ id: string; table_name: string; deleted_id: string; deleted_at: string }> = data.tombstones || [];

  const batches: Array<{ sql: string; params?: any[] }> = [];
  for (const v of venues) {
    batches.push({ sql: `INSERT OR REPLACE INTO venues(id,name,address,time_zone,lat,lon,updated_at) VALUES (?,?,?,?,?,?,?)`, params: [v.id, v.name, v.address ?? null, v.time_zone, v.lat, v.lon, v.updated_at] });
  }
  for (const e of exhibitions) {
    batches.push({ sql: `INSERT OR REPLACE INTO exhibitions(id,title,venue_id,starts_at,ends_at,status,lat,lon,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`, params: [e.id, e.title, e.venue_id, e.starts_at, e.ends_at, e.status, e.lat, e.lon, e.updated_at] });
  }
  for (const h of hours) {
    batches.push({ sql: `INSERT OR REPLACE INTO exhibition_hours(id,exhibition_id,day_of_week,open_time,close_time,overnight) VALUES (?,?,?,?,?,?)`, params: [h.id, h.exhibition_id, h.day_of_week, h.open_time, h.close_time, h.overnight] });
  }
  for (const ex of exceptions) {
    batches.push({ sql: `INSERT OR REPLACE INTO exhibition_exceptions(id,exhibition_id,date,closed,open_time,close_time) VALUES (?,?,?,?,?,?)`, params: [ex.id, ex.exhibition_id, ex.date, ex.closed, ex.open_time ?? null, ex.close_time ?? null] });
  }
  for (const t of tombs) {
    batches.push({ sql: `INSERT OR REPLACE INTO tombstones(id,table_name,deleted_id,deleted_at) VALUES (?,?,?,?)`, params: [t.id, t.table_name, t.deleted_id, t.deleted_at] });
    // apply deletes
    if (t.table_name === 'venues') batches.push({ sql: `DELETE FROM venues WHERE id=?`, params: [t.deleted_id] });
    if (t.table_name === 'exhibitions') {
      batches.push({ sql: `DELETE FROM exhibitions WHERE id=?`, params: [t.deleted_id] });
      batches.push({ sql: `DELETE FROM exhibition_hours WHERE exhibition_id=?`, params: [t.deleted_id] });
      batches.push({ sql: `DELETE FROM exhibition_exceptions WHERE exhibition_id=?`, params: [t.deleted_id] });
    }
    if (t.table_name === 'exhibition_hours') batches.push({ sql: `DELETE FROM exhibition_hours WHERE id=?`, params: [t.deleted_id] });
    if (t.table_name === 'exhibition_exceptions') batches.push({ sql: `DELETE FROM exhibition_exceptions WHERE id=?`, params: [t.deleted_id] });
  }
  if (batches.length) await execBatch(batches);
  return { updated: batches.length };
}

function getLocalDayOfWeek(date: Date, timeZone: string): number {
  try {
    // 0..6 with given timezone using Intl
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    const str = fmt.format(date).toLowerCase();
    const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return map[str.slice(0, 3)] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
}

function getLocalTimeString(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  } catch {
    // fallback UTC HH:mm
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

function isOpenLocal(hours: HoursRow[], exceptions: ExceptionRow[], at: Date, tz: string): boolean {
  const dow = getLocalDayOfWeek(at, tz);
  const t = getLocalTimeString(at, tz);
  const tNum = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const exception = exceptions.find(ex => ex.date === at.toISOString().slice(0, 10));
  if (exception) {
    if (exception.closed) return false;
    const open = exception.open_time || '00:00';
    const close = exception.close_time || '23:59';
    const o = Number(open.slice(0, 2)) * 60 + Number(open.slice(3, 5));
    const c = Number(close.slice(0, 2)) * 60 + Number(close.slice(3, 5));
    return tNum >= o && tNum <= c;
  }
  const today = hours.filter(h => h.day_of_week === dow);
  return today.some(h => {
    const o = Number(h.open_time.slice(0, 2)) * 60 + Number(h.open_time.slice(3, 5));
    const c = Number(h.close_time.slice(0, 2)) * 60 + Number(h.close_time.slice(3, 5));
    if (!h.overnight) return tNum >= o && tNum <= c;
    return tNum >= o || tNum <= c;
  });
}

export async function nearestOpenLocal(params: { lat: number; lon: number; atIso?: string; radiusM?: number }): Promise<null | { id: string; title: string; venue_name: string; distance_m: number }>
{
  await ensureLocalDb();
  const at = params.atIso ? new Date(params.atIso) : new Date();
  const radius = params.radiusM ?? 3000;

  // fetch candidates within rough bbox (~1 deg ~ 111km)
  const deg = radius / 111000;
  const minLat = params.lat - deg;
  const maxLat = params.lat + deg;
  const minLon = params.lon - deg;
  const maxLon = params.lon + deg;
  const exRows = await execSql(`SELECT e.*, v.name as venue_name, v.time_zone FROM exhibitions e JOIN venues v ON v.id=e.venue_id WHERE e.status='published' AND e.starts_at <= ? AND e.ends_at >= ? AND e.lat BETWEEN ? AND ? AND e.lon BETWEEN ? AND ?`, [at.toISOString(), at.toISOString(), minLat, maxLat, minLon, maxLon]);
  if (!exRows.rows.length) return null;

  let best: null | { id: string; title: string; venue_name: string; distance_m: number } = null;
  for (const r of exRows.rows as any[]) {
    const hoursRows = await execSql(`SELECT * FROM exhibition_hours WHERE exhibition_id=?`, [r.id]);
    const excRows = await execSql(`SELECT * FROM exhibition_exceptions WHERE exhibition_id=?`, [r.id]);
    const open = isOpenLocal(hoursRows.rows as any, excRows.rows as any, at, r.time_zone);
    if (!open) continue;
    const d = haversineDistanceMeters({ lat: params.lat, lng: params.lon }, { lat: r.lat, lng: r.lon });
    if (d > radius) continue;
    if (!best || d < best.distance_m) best = { id: r.id, title: r.title, venue_name: r.venue_name, distance_m: Math.round(d) };
  }
  return best;
}

export async function validateWithServer(params: { lat: number; lon: number; atIso?: string; radiusM?: number }): Promise<null | { id: string; title: string; venue_name: string; distance_m: number }>
{
  if (!SERVER_BASE_URL) return null;
  const url = new URL('/exhibitions/nearby-open', SERVER_BASE_URL);
  url.searchParams.set('lat', String(params.lat));
  url.searchParams.set('lon', String(params.lon));
  if (params.atIso) url.searchParams.set('at', params.atIso);
  if (params.radiusM) url.searchParams.set('radius_m', String(params.radiusM));
  url.searchParams.set('limit', '1');
  const resp = await fetch(url.toString());
  if (!resp.ok) return null;
  const data = await resp.json();
  const item = (data.items || [])[0];
  return item ? { id: item.id, title: item.title, venue_name: item.venue_name, distance_m: Math.round(item.distance_m) } : null;
}


