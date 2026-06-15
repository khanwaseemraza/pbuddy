// Postgres connection pool + a transaction helper with SERIALIZABLE-friendly
// retry semantics. All DB access in the API goes through here; clients never
// touch the database directly.
import pg from 'pg';
import { config } from './config.ts';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export type Tx = pg.PoolClient;

/**
 * Run `fn` inside a transaction. On serialization / deadlock failures
 * (40001 / 40P01) the transaction is retried up to `retries` times. This is how
 * the cap firewall stays correct under concurrent bid accepts on the same trip.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  retries = 3,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const code = (err as { code?: string }).code;
      if ((code === '40001' || code === '40P01') && attempt < retries) {
        continue; // serialization failure / deadlock — retry
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
