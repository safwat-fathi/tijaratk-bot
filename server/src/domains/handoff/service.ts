import { and, eq, isNull, max } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Conversation, HandoffReason } from '../../db/types.js';

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

/**
 * A human just replied. Pause the AI and refresh the idle clock: `human_handoffs.updated_at` of the open handoff
 * (opened here if there is none) is "last human activity", which `resumeIfIdle` measures against.
 */
export async function recordHumanActivity(db: DbOrTx, merchantId: string, conversationId: string): Promise<void> {
  await ownedConversation(db, merchantId, conversationId);
  await db.update(schema.conversations).set({ humanTakeover: true }).where(eq(schema.conversations.id, conversationId));
  const h = schema.humanHandoffs;
  const touched = await db
    .update(h)
    .set({ updatedAt: new Date() })
    .where(and(eq(h.conversationId, conversationId), isNull(h.resolvedAt)))
    .returning({ id: h.id });
  if (!touched.length) await db.insert(h).values({ conversationId, reason: 'MERCHANT_TAKEOVER' });
}

/**
 * Lazy idle resume: if a human has had the conversation but nothing has touched its open handoff for `idleMinutes`,
 * hand it back to the AI. Returns the conversation as it should be treated from here on.
 */
export async function resumeIfIdle(db: DbOrTx, conversation: Conversation, idleMinutes: number): Promise<Conversation> {
  if (!conversation.humanTakeover) return conversation;
  const h = schema.humanHandoffs;
  const [row] = await db
    .select({ lastActivity: max(h.updatedAt) })
    .from(h)
    .where(and(eq(h.conversationId, conversation.id), isNull(h.resolvedAt)));
  if (!row?.lastActivity || Date.now() - row.lastActivity.getTime() < idleMinutes * 60_000) return conversation;
  await returnToAi(db, conversation.merchantId, conversation.id, 'auto_resume_idle');
  return { ...conversation, humanTakeover: false };
}
