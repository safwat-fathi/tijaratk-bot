import { asc, desc, eq } from 'drizzle-orm';
import { iso } from '../../core/serialize.js';
import { type DbOrTx, schema } from '../../db/index.js';

export async function listConversations(db: DbOrTx, merchantId: string) {
  const c = schema.conversations;
  const rows = await db.select().from(c).where(eq(c.merchantId, merchantId)).orderBy(desc(c.lastMessageAt));
  return rows.map((r) => ({
    id: r.id,
    merchant_id: r.merchantId,
    customer_ref: r.customerRef,
    state: r.state,
    slots: r.slots,
    last_message_at: iso(r.lastMessageAt)!,
    ai_enabled: r.aiEnabled,
    human_takeover: r.humanTakeover,
  }));
}

/** null => conversation missing or owned by another merchant. */
export async function getConversationMessages(db: DbOrTx, merchantId: string, conversationId: string) {
  const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  if (!conv || conv.merchantId !== merchantId) return null;
  const m = schema.messages;
  const rows = await db.select().from(m).where(eq(m.conversationId, conversationId)).orderBy(asc(m.createdAt));
  return rows.map((r) => ({
    id: r.id,
    conversation_id: r.conversationId,
    direction: r.direction,
    raw_text: r.rawText,
    intent: r.intent,
    intent_confidence: r.intentConfidence,
    created_at: iso(r.createdAt)!,
  }));
}
