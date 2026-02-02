import { Pool, QueryResult } from 'pg';

// Lazy initialization for database pool
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // eslint-disable-next-line no-console
      console.warn('[server] DATABASE_URL is not set. Set it in environment to enable DB access.');
    }
    _pool = new Pool({ connectionString });
  }
  return _pool;
}

export const pool = { get instance() { return getPool(); } };

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const client = await getPool().connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}


