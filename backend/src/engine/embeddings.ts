import { asc, cosineDistance, eq, isNull } from 'drizzle-orm';
import { type DbOrTx, schema } from '../db/index.js';
import type { LabeledExample } from '../db/types.js';
import * as gateway from './gateway.js';

export const embedText = (text: string): Promise<number[]> => gateway.embed(text);

/** Merchant-scoped few-shot neighbours first; falls back to the global pool when the merchant has none. */
export async function findSimilarExamples(
  db: DbOrTx,
  embedding: number[],
  merchantId: string | null,
  limit = 5,
): Promise<LabeledExample[]> {
  const t = schema.labeledExamples;
  const query = (where: ReturnType<typeof eq>) =>
    db.select().from(t).where(where).orderBy(asc(cosineDistance(t.embedding, embedding))).limit(limit);

  if (merchantId) {
    const scoped = await query(eq(t.merchantId, merchantId));
    if (scoped.length) return scoped;
  }
  return query(isNull(t.merchantId) as ReturnType<typeof eq>);
}

