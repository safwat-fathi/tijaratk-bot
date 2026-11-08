import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/index.js';

export type StatsRange = 'today' | '7d' | '30d';

export const RANGE_DAYS: Record<StatsRange, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

export interface PageStatsSummary {
  conversations: number;
  handled_by_ai: number;
  handled_pct: number;
  needed_you: number;
  orders: number;
  revenue: number;
}

export interface PageDailyPoint {
  date: string;
  conversations: number;
  handled_by_ai: number;
}

export const emptySummary = (): PageStatsSummary => ({
  conversations: 0,
  handled_by_ai: 0,
  handled_pct: 0,
  needed_you: 0,
  orders: 0,
  revenue: 0,
});

const cairoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function cairoDateList(days: number, now = new Date()): string[] {
  const [y, m, d] = cairoFmt.format(now).split('-').map(Number);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return out;
}

function periodBounds(days: number, previous: boolean, now: Date) {
  const nowIso = now.toISOString();
  const currentStart = sql`(date_trunc('day', ${nowIso}::timestamptz AT TIME ZONE 'Africa/Cairo') - (${days - 1} * interval '1 day')) AT TIME ZONE 'Africa/Cairo'`;
  if (previous) {
    const prevStart = sql`(date_trunc('day', ${nowIso}::timestamptz AT TIME ZONE 'Africa/Cairo') - (${2 * days - 1} * interval '1 day')) AT TIME ZONE 'Africa/Cairo'`;
    return { startExpr: prevStart, endExpr: currentStart };
  }
  const currentEnd = sql`(date_trunc('day', ${nowIso}::timestamptz AT TIME ZONE 'Africa/Cairo') + interval '1 day') AT TIME ZONE 'Africa/Cairo'`;
  return { startExpr: currentStart, endExpr: currentEnd };
}

export async function queryPageSummaries(
  db: DbOrTx,
  merchantId: string,
  o: { days: number; previous?: boolean; pageId?: string; now?: Date },
): Promise<Map<string, PageStatsSummary>> {
  const { startExpr, endExpr } = periodBounds(o.days, o.previous ?? false, o.now ?? new Date());
  const pageFilter = o.pageId ? sql`AND cc.id = ${o.pageId}` : sql``;
  const res = await db.execute<{
    page_id: string;
    conversations: number;
    handled_by_ai: number;
    needed_you: number;
    orders: number;
    revenue: number;
  }>(sql`
    WITH msg_stats AS (
      SELECT
        c.channel_connection_id AS page_id,
        COUNT(DISTINCT CASE WHEN m.direction = 'INBOUND' THEN c.id END)::int AS conversations,
        COUNT(DISTINCT CASE WHEN m.direction = 'INBOUND' AND m.ai_answered = true THEN c.id END)::int AS handled_by_ai
      FROM conversations c
      INNER JOIN messages m ON m.conversation_id = c.id
      WHERE c.merchant_id = ${merchantId}
        AND c.channel_connection_id IS NOT NULL
        AND m.created_at >= ${startExpr}
        AND m.created_at < ${endExpr}
      GROUP BY c.channel_connection_id
    ),
    needed_stats AS (
      SELECT
        c.channel_connection_id AS page_id,
        COUNT(DISTINCT c.id)::int AS needed_you
      FROM conversations c
      WHERE c.merchant_id = ${merchantId}
        AND c.channel_connection_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM messages m
            WHERE m.conversation_id = c.id
              AND m.escalation_reason IS NOT NULL
              AND m.created_at >= ${startExpr}
              AND m.created_at < ${endExpr}
          )
          OR EXISTS (
            SELECT 1 FROM human_handoffs hh
            WHERE hh.conversation_id = c.id
              AND hh.created_at >= ${startExpr}
              AND hh.created_at < ${endExpr}
          )
        )
      GROUP BY c.channel_connection_id
    ),
    order_stats AS (
      SELECT
        c.channel_connection_id AS page_id,
        COUNT(o.id)::int AS orders,
        COALESCE(SUM(o.total), 0)::float8 AS revenue
      FROM orders o
      INNER JOIN conversations c ON c.id = o.conversation_id
      INNER JOIN messages om ON om.id = o.message_id
      WHERE o.merchant_id = ${merchantId}
        AND c.merchant_id = ${merchantId}
        AND c.channel_connection_id IS NOT NULL
        AND om.created_at >= ${startExpr}
        AND om.created_at < ${endExpr}
      GROUP BY c.channel_connection_id
    )
    SELECT
      cc.id AS page_id,
      COALESCE(ms.conversations, 0)::int AS conversations,
      COALESCE(ms.handled_by_ai, 0)::int AS handled_by_ai,
      COALESCE(ns.needed_you, 0)::int AS needed_you,
      COALESCE(os.orders, 0)::int AS orders,
      COALESCE(os.revenue, 0)::float8 AS revenue
    FROM channel_connections cc
    LEFT JOIN msg_stats ms ON ms.page_id = cc.id
    LEFT JOIN needed_stats ns ON ns.page_id = cc.id
    LEFT JOIN order_stats os ON os.page_id = cc.id
    WHERE cc.merchant_id = ${merchantId}
    ${pageFilter}
  `);

  const out = new Map<string, PageStatsSummary>();
  for (const r of res.rows) {
    const conversations = Number(r.conversations);
    const handled_by_ai = Number(r.handled_by_ai);
    out.set(r.page_id, {
      conversations,
      handled_by_ai,
      handled_pct: conversations > 0 ? Math.round((handled_by_ai / conversations) * 100) : 0,
      needed_you: Number(r.needed_you),
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    });
  }
  return out;
}

export async function queryPageDailySeries(
  db: DbOrTx,
  merchantId: string,
  o: { days: number; pageIds: string[]; now?: Date },
): Promise<Map<string, PageDailyPoint[]>> {
  const now = o.now ?? new Date();
  const dates = cairoDateList(o.days, now);
  const { startExpr, endExpr } = periodBounds(o.days, false, now);
  const res = await db.execute<{
    page_id: string;
    day: string;
    conversations: number;
    handled_by_ai: number;
  }>(sql`
    SELECT
      c.channel_connection_id AS page_id,
      to_char(date_trunc('day', m.created_at AT TIME ZONE 'Africa/Cairo'), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT c.id)::int AS conversations,
      COUNT(DISTINCT CASE WHEN m.ai_answered = true THEN c.id END)::int AS handled_by_ai
    FROM conversations c
    INNER JOIN messages m ON m.conversation_id = c.id
    WHERE c.merchant_id = ${merchantId}
      AND c.channel_connection_id IS NOT NULL
      AND m.direction = 'INBOUND'
      AND m.created_at >= ${startExpr}
      AND m.created_at < ${endExpr}
    GROUP BY c.channel_connection_id, day
    ORDER BY day ASC
  `);

  const byPageDay = new Map<string, Map<string, { conversations: number; handled_by_ai: number }>>();
  for (const r of res.rows) {
    let dayMap = byPageDay.get(r.page_id);
    if (!dayMap) {
      dayMap = new Map();
      byPageDay.set(r.page_id, dayMap);
    }
    dayMap.set(r.day, { conversations: Number(r.conversations), handled_by_ai: Number(r.handled_by_ai) });
  }

  const out = new Map<string, PageDailyPoint[]>();
  for (const id of o.pageIds) {
    const dayMap = byPageDay.get(id);
    out.set(
      id,
      dates.map((date) => ({
        date,
        conversations: dayMap?.get(date)?.conversations ?? 0,
        handled_by_ai: dayMap?.get(date)?.handled_by_ai ?? 0,
      })),
    );
  }
  return out;
}

