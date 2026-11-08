import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { getSettings } from '../../config.js';
import { type DbOrTx, schema } from '../../db/index.js';

// Customer threads where the AI actually delivered an answer this month, ordered by first answered message.
// ponytail: month starts at UTC midnight (Egypt is UTC+2/+3); switch to Africa/Cairo if month-edge accuracy matters.
async function conversationsThisMonthRows(db: DbOrTx, merchantId: string, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const m = schema.messages;
  return db
    .select({ id: m.conversationId, channelConnectionId: schema.conversations.channelConnectionId })
    .from(m)
    .innerJoin(schema.conversations, eq(schema.conversations.id, m.conversationId))
    .where(and(eq(schema.conversations.merchantId, merchantId), eq(m.direction, 'INBOUND'), eq(m.aiAnswered, true), gte(m.createdAt, monthStart)))
    .groupBy(m.conversationId, schema.conversations.channelConnectionId)
    .orderBy(asc(sql`min(${m.createdAt})`), asc(m.conversationId));
}

async function conversationsThisMonth(db: DbOrTx, merchantId: string): Promise<string[]> {
  return (await conversationsThisMonthRows(db, merchantId)).map((r) => r.id);
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

export async function conversationsThisMonthByPage(db: DbOrTx, merchantId: string, pageIds: string[], now = new Date()) {
  const limit = getSettings().FREE_PLAN_MONTHLY_CONVERSATIONS;
  const rows = await conversationsThisMonthRows(db, merchantId, now);
  const counted = rows.slice(0, limit);
  const counts = new Map<string, number>();
  for (const r of counted) {
    if (r.channelConnectionId) {
      counts.set(r.channelConnectionId, (counts.get(r.channelConnectionId) ?? 0) + 1);
    }
  }
  return {
    used: counted.length,
    limit,
    overQuota: rows.length >= limit,
    by_page: pageIds.map((id) => ({ id, used: counts.get(id) ?? 0 })),
  };
}
