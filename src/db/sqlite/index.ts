import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

// Enable promise-based API
SQLite.enablePromise(true);

let _db: SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabase({
    name: 'eye_see_it.db',
    location: 'default',
  });
  return _db;
}

export async function execSql(sql: string, params: any[] = []): Promise<{ rows: any[]; rowsAffected: number; insertId?: number }> {
  const db = await getDb();
  const [result] = await db.executeSql(sql, params);
  const rows: any[] = [];
  const len = result.rows.length;
  for (let i = 0; i < len; i++) {
    rows.push(result.rows.item(i));
  }
  return { rows, rowsAffected: result.rowsAffected, insertId: result.insertId };
}

export async function execBatch(sqls: Array<{ sql: string; params?: any[] }>): Promise<void> {
  const db = await getDb();
  for (const { sql, params } of sqls) {
    await db.executeSql(sql, params || []);
  }
}

