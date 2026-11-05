import { asc, desc, eq, sql } from 'drizzle-orm';
import type { Settings } from '../../config.js';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Merchant } from '../../db/types.js';

/**
 * Open mode has one owner merchant: OPEN_MERCHANT_ID if pinned, else the one with an active channel connection
 * (the store actually in use), else the first by name, else a fresh one. Returns null only when the pinned id does not exist.
 */
export async function findOpenMerchant(db: DbOrTx, s: Settings): Promise<Merchant | null> {
  const t = schema.merchants;
  const inUse = sql`exists (select 1 from channel_connections cc where cc.merchant_id = ${t.id} and cc.is_active)`;
  const [found] = await db
    .select()
    .from(t)
    .where(s.OPEN_MERCHANT_ID ? eq(t.id, s.OPEN_MERCHANT_ID) : undefined)
    .orderBy(desc(inUse), asc(t.name), asc(t.id))
    .limit(1);
  if (found || s.OPEN_MERCHANT_ID) return found ?? null;
  const [created] = await db.insert(t).values({ name: 'My Store' }).returning();
  return created;
}
