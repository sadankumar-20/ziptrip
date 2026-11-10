import pg from 'pg';

export interface Queryable {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Queryable {
  /** Run several statements in one transaction. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Return DATE and TIME columns as plain strings, not JS Dates shifted into the server's time zone.
pg.types.setTypeParser(1082, (v) => v); // date
pg.types.setTypeParser(1083, (v) => v); // time

export function createPgDb(url: string, ssl: boolean): Db {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return {
    query: (text, params) => pool.query(text, params as any[]) as Promise<any>,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn({ query: (t, p) => client.query(t, p as any[]) as Promise<any> });
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Errors raised by the SQL functions arrive with a short code in the message. */
export function sqlErrorCode(e: unknown): { code: string; detail?: string } | null {
  const msg = (e as { message?: string })?.message ?? '';
  const m = msg.match(/(TRIP_NOT_FOUND|TRIP_NOT_BOOKABLE|TRIP_DEPARTED|SOLD_OUT|NOT_ENOUGH_SEATS|BOOKING_NOT_FOUND)(?::(\d+))?/);
  return m ? { code: m[1], detail: m[2] } : null;
}
export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === '23505';
