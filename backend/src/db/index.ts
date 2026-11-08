import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export { schema };
/** Works for both the pool-backed db and a transaction handle, like the Python `session` param. */
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }) as Db, pool };
}
