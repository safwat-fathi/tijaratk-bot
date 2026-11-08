import { Logger } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import type { LabeledExample } from '../../db/types.js';
import { AICallError } from '../../engine/clients.js';
import { embedText } from '../../engine/embeddings.js';

const log = new Logger('labeled_examples');

export interface LabeledExampleRead {
  id: string;
  merchant_id: string | null;
  normalized_text: string;
  intent: string;
  extraction: Record<string, unknown> | null;
  source: string;
}
const toRead = (r: LabeledExample): LabeledExampleRead => ({
  id: r.id,
  merchant_id: r.merchantId,
  normalized_text: r.normalizedText,
  intent: r.intent,
  extraction: (r.extraction as Record<string, unknown> | null) ?? null,
  source: r.source,
});

/** Fail open: an example without an embedding never surfaces as a few-shot example, but saving matters more. */
async function embeddingFor(text: string): Promise<number[] | null> {
  try {
    return await embedText(text);
  } catch (e) {
    if (e instanceof AICallError) {
      log.warn(`labeled_example_embedding_failed error=${e.message}`);
      return null;
    }
    throw e;
  }
}

export async function listExamples(db: DbOrTx, merchantId: string) {
  const t = schema.labeledExamples;
  return (await db.select().from(t).where(eq(t.merchantId, merchantId)).orderBy(asc(t.normalizedText))).map(toRead);
}

export async function createExample(
  db: DbOrTx,
  merchantId: string,
  p: { normalized_text: string; intent: string; extraction: Record<string, unknown> | null },
) {
  const [row] = await db
    .insert(schema.labeledExamples)
    .values({
      merchantId,
      normalizedText: p.normalized_text,
      intent: p.intent,
      extraction: p.extraction,
      embedding: await embeddingFor(p.normalized_text),
      source: 'merchant',
    })
    .returning();
  return toRead(row);
}

export async function updateExample(
  db: DbOrTx,
  merchantId: string,
  id: string,
  p: { normalized_text?: string | null; intent?: string | null; extraction?: Record<string, unknown> | null },
) {
  const t = schema.labeledExamples;
  const [ex] = await db.select().from(t).where(eq(t.id, id));
  if (!ex || ex.merchantId !== merchantId) return null;
  const set: Partial<typeof t.$inferInsert> = {};
  if (p.normalized_text != null) {
    set.normalizedText = p.normalized_text;
    set.embedding = await embeddingFor(p.normalized_text);
  }
  if (p.intent != null) set.intent = p.intent;
  if (p.extraction != null) set.extraction = p.extraction;
  const [row] = Object.keys(set).length ? await db.update(t).set(set).where(eq(t.id, id)).returning() : [ex];
  return toRead(row);
}

export async function deleteExample(db: DbOrTx, merchantId: string, id: string): Promise<boolean> {
  const t = schema.labeledExamples;
  const [ex] = await db.select().from(t).where(eq(t.id, id));
  if (!ex || ex.merchantId !== merchantId) return false;
  await db.delete(t).where(eq(t.id, id));
  return true;
}
