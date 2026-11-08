import { and, desc, eq } from 'drizzle-orm';
import { cpLen } from '../../core/pystr.js';
import { iso } from '../../core/serialize.js';
import { type DbOrTx, schema } from '../../db/index.js';
import type { StoreKnowledge } from '../../db/types.js';

export interface StoreKnowledgeRead {
  id: string;
  merchant_id: string;
  knowledge_type: string;
  title: string;
  content: string;
  keywords: string[];
  created_at: string;
}

const toRead = (r: StoreKnowledge): StoreKnowledgeRead => ({
  id: r.id,
  merchant_id: r.merchantId,
  knowledge_type: r.knowledgeType,
  title: r.title,
  content: r.content,
  keywords: r.keywords,
  created_at: iso(r.createdAt)!,
});

/**
 * Keyword-match MVP (SRD §23): a row matches when any seeded trigger keyword appears as a substring of
 * the customer's text; ranked by the longest matching keyword (stable for ties, like Python's sort).
 */
export function matchKnowledge<T extends { keywords: string[] }>(rows: T[], query: string): T[] {
  const q = query.toLowerCase();
  return rows
    .map((row) => ({ row, best: Math.max(0, ...row.keywords.filter((k) => q.includes(k.toLowerCase())).map(cpLen)) }))
    .filter((s) => s.best > 0)
    .sort((a, b) => b.best - a.best)
    .map(({ row }) => row);
}

export async function search(db: DbOrTx, merchantId: string, query: string, knowledgeType?: string | null) {
  const t = schema.storeKnowledge;
  const rows = await db
    .select()
    .from(t)
    .where(knowledgeType ? and(eq(t.merchantId, merchantId), eq(t.knowledgeType, knowledgeType)) : eq(t.merchantId, merchantId));
  return matchKnowledge(rows, query).map((row) => ({ id: row.id, knowledge_type: row.knowledgeType, title: row.title, content: row.content }));
}

export async function listKnowledge(db: DbOrTx, merchantId: string): Promise<StoreKnowledgeRead[]> {
  const t = schema.storeKnowledge;
  return (await db.select().from(t).where(eq(t.merchantId, merchantId)).orderBy(desc(t.createdAt))).map(toRead);
}

export async function createKnowledge(
  db: DbOrTx,
  merchantId: string,
  p: { knowledge_type: string; title: string; content: string; keywords: string[] },
) {
  const [row] = await db
    .insert(schema.storeKnowledge)
    .values({ merchantId, knowledgeType: p.knowledge_type, title: p.title, content: p.content, keywords: p.keywords })
    .returning();
  return toRead(row);
}

export async function updateKnowledge(
  db: DbOrTx,
  merchantId: string,
  id: string,
  p: { knowledge_type?: string | null; title?: string | null; content?: string | null; keywords?: string[] | null },
) {
  const t = schema.storeKnowledge;
  const [entry] = await db.select().from(t).where(eq(t.id, id));
  if (!entry || entry.merchantId !== merchantId) return null;
  const set: Partial<typeof t.$inferInsert> = {};
  if (p.knowledge_type != null) set.knowledgeType = p.knowledge_type;
  if (p.title != null) set.title = p.title;
  if (p.content != null) set.content = p.content;
  if (p.keywords != null) set.keywords = p.keywords;
  const [row] = Object.keys(set).length ? await db.update(t).set(set).where(eq(t.id, id)).returning() : [entry];
  return toRead(row);
}

export async function deleteKnowledge(db: DbOrTx, merchantId: string, id: string): Promise<boolean> {
  const t = schema.storeKnowledge;
  const [entry] = await db.select().from(t).where(eq(t.id, id));
  if (!entry || entry.merchantId !== merchantId) return false;
  await db.delete(t).where(eq(t.id, id));
  return true;
}
