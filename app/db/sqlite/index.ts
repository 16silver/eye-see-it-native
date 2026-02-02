import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  // legacy API ensures broad compatibility across Expo SDK versions
  _db = SQLite.openDatabase('eye_see_it.db');
  return _db;
}

export function execSql(sql: string, params: any[] = []): Promise<{ rows: any[]; rowsAffected: number; insertId?: number }>
{
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_tx, result) => {
          const rows: any[] = [];
          const len = result.rows.length;
          for (let i = 0; i < len; i++) rows.push(result.rows.item(i));
          resolve({ rows, rowsAffected: result.rowsAffected, insertId: (result as any).insertId });
        },
        (_tx, err) => {
          reject(err);
          return true;
        }
      );
    });
  });
}

export async function execBatch(sqls: Array<{ sql: string; params?: any[] }>): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      for (const { sql, params } of sqls) {
        tx.executeSql(sql, params || []);
      }
    }, reject, resolve);
  });
}


