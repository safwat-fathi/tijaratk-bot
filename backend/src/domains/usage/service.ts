import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { getSettings } from '../../config.js';
import { type DbOrTx, schema } from '../../db/index.js';

// Customer threads where the AI actually delivered an answer this month, ordered by first answered message.
// ponytail: month starts at UTC midnight (Egypt is UTC+2/+3); switch to Africa/Cairo if month-edge accuracy matters.
async function conversationsThisMonth(db: DbOrTx, merchantId: string): Promise<string[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const m = schema.messages;
  const rows = await db
    .select({ id: m.conversationId })
    .from(m)
    .innerJoin(schema.conversations, eq(schema.conversations.id, m.conversationId))
    .where(and(eq(schema.conversations.merchantId, merchantId), eq(m.direction, 'INBOUND'), eq(m.aiAnswered, true), gte(m.createdAt, monthStart)))
    .groupBy(m.conversationId)
    .orderBy(asc(sql`min(${m.createdAt})`), asc(m.conversationId));
  return rows.map((r) => r.id);
}

/** True when this conversation is past the plan's monthly quota (conversations already inside it keep working). */
export async function isOverConversationLimit(db: DbOrTx, merchantId: string, conversationId: string): Promise<boolean> {
  const limit = getSettings().FREE_PLAN_MONTHLY_CONVERSATIONS;
  const answered = await conversationsThisMonth(db, merchantId);
  return answered.length >= limit && !answered.slice(0, limit).includes(conversationId);
}

export async function conversationUsage(db: DbOrTx, merchantId: string) {
  const limit = getSettings().FREE_PLAN_MONTHLY_CONVERSATIONS;
  const used = Math.min((await conversationsThisMonth(db, merchantId)).length, limit);
  return { conversations_used: used, conversations_limit: limit };
}
