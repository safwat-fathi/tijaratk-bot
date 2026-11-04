import { and, eq, isNull } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import type { HandoffReason } from '../../db/types.js';

export class ConversationNotFoundError extends Error {}

async function ownedConversation(db: DbOrTx, merchantId: string, conversationId: string) {
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  if (!c || c.merchantId !== merchantId) throw new ConversationNotFoundError(conversationId);
  return c;
}

export async function takeoverConversation(
  db: DbOrTx,
  merchantId: string,
  conversationId: string,
  reason: HandoffReason,
  notes: string | null = null,
): Promise<void> {
  await ownedConversation(db, merchantId, conversationId);
  await db.update(schema.conversations).set({ humanTakeover: true }).where(eq(schema.conversations.id, conversationId));
  await db.insert(schema.humanHandoffs).values({ conversationId, reason, notes });
}

export async function returnToAi(db: DbOrTx, merchantId: string, conversationId: string, notes: string | null = null): Promise<void> {
  await ownedConversation(db, merchantId, conversationId);
  await db.update(schema.conversations).set({ humanTakeover: false }).where(eq(schema.conversations.id, conversationId));
  const h = schema.humanHandoffs;
  await db
    .update(h)
    .set({ resolvedAt: new Date(), notes })
    .where(and(eq(h.conversationId, conversationId), isNull(h.resolvedAt)));
}
