import { and, asc, eq, gte, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { getSettings } from '../../config.js';
import { type DbOrTx, schema } from '../../db/index.js';

// Customer threads with a real inbound message this month (spam links and emoji reactions decided by the tier-0 rules don't hold a slot; model-labelled ones do, since the AI replies to them), first to write first. The first N of them are covered by the plan.
// ponytail: month starts at UTC midnight (Egypt is UTC+2/+3); switch to Africa/Cairo if month-edge accuracy matters.
async function conversationsThisMonth(db: DbOrTx, merchantId: string): Promise<string[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const m = schema.messages;
  const rows = await db
    .select({ id: m.conversationId })
    .from(m)
    .innerJoin(schema.conversations, eq(schema.conversations.id, m.conversationId))
    .where(and(eq(schema.conversations.merchantId, merchantId), eq(m.direction, 'INBOUND'), gte(m.createdAt, monthStart), or(isNull(m.intent), notInArray(m.intent, ['spam', 'reaction']), isNull(m.modelTier), ne(m.modelTier, 'RULE'))))
    .groupBy(m.conversationId)
    .orderBy(asc(sql`min(${m.createdAt})`), asc(m.conversationId));
  return rows.map((r) => r.id);
}

/** True when this conversation is past the plan's monthly quota (conversations already inside it keep working). */
export async function isOverConversationLimit(db: DbOrTx, merchantId: string, conversationId: string): Promise<boolean> {
  const covered = (await conversationsThisMonth(db, merchantId)).slice(0, getSettings().FREE_PLAN_MONTHLY_CONVERSATIONS);
  return !covered.includes(conversationId);
}

export async function conversationUsage(db: DbOrTx, merchantId: string) {
  const limit = getSettings().FREE_PLAN_MONTHLY_CONVERSATIONS;
  const used = Math.min((await conversationsThisMonth(db, merchantId)).length, limit); // threads past the quota get no AI, so they aren't "used"
  return { conversations_used: used, conversations_limit: limit };
}
