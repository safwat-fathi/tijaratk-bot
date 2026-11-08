import { and, asc, eq, inArray } from 'drizzle-orm';
import { getSettings } from '../../config.js';
import { iso } from '../../core/serialize.js';
import { type DbOrTx, schema } from '../../db/index.js';
import { sanitizePageNote } from '../../engine/prompts.js';
import { conversationsThisMonthByPage } from '../usage/service.js';
import { pageAiState } from './ai-state.js';
import {
  RANGE_DAYS,
  type StatsRange,
  emptySummary,
  queryPageDailySeries,
  queryPageSummaries,
} from './stats.js';

const PAGE_CHANNELS = ['FACEBOOK', 'INSTAGRAM'] as const;

function serializePageBase(
  row: typeof schema.channelConnections.$inferSelect,
  merchantAiEnabled: boolean,
  overQuota: boolean,
  now: Date,
) {
  return {
    id: row.id,
    channel: row.channel as 'FACEBOOK' | 'INSTAGRAM',
    account_name: row.accountName ? String(row.accountName) : null,
    is_active: row.isActive,
    created_at: iso(row.createdAt)!,
    ai_enabled: row.aiEnabled,
    ai_paused_until: iso(row.aiPausedUntil),
    ai_instructions: row.aiInstructions ?? null,
    ai_state: pageAiState({
      merchantAiEnabled,
      overQuota,
      page: { aiEnabled: row.aiEnabled, aiPausedUntil: row.aiPausedUntil },
      now,
    }),
  };
}

export async function listPagesOverview(
  db: DbOrTx,
  merchant: { id: string; aiEnabled: boolean },
  range: StatsRange,
  now = new Date(),
) {
  const t = schema.channelConnections;
  const rows = await db
    .select()
    .from(t)
    .where(and(eq(t.merchantId, merchant.id), inArray(t.channel, [...PAGE_CHANNELS])))
    .orderBy(asc(t.createdAt), asc(t.id));

  const active = rows.filter((r) => r.isActive);
  const disconnected = rows
    .filter((r) => !r.isActive)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));

  const allIds = rows.map((r) => r.id);
  const activeIds = active.map((r) => r.id);
  const days = RANGE_DAYS[range];

  const [usage, summaries, dailyMap] = await Promise.all([
    conversationsThisMonthByPage(db, merchant.id, allIds, now),
    queryPageSummaries(db, merchant.id, { days, now }),
    queryPageDailySeries(db, merchant.id, { days, pageIds: activeIds, now }),
  ]);

  return {
    range,
    merchant_ai_enabled: merchant.aiEnabled,
    max_pages: getSettings().MAX_ACTIVE_PAGES_PER_MERCHANT,
    usage: {
      used: usage.used,
      limit: usage.limit,
      by_page: usage.by_page,
    },
    pages: active.map((r) => ({
      ...serializePageBase(r, merchant.aiEnabled, usage.overQuota, now),
      summary: summaries.get(r.id) ?? emptySummary(),
      daily: dailyMap.get(r.id) ?? [],
    })),
    disconnected: disconnected.map((r) => ({
      id: r.id,
      channel: r.channel as 'FACEBOOK' | 'INSTAGRAM',
      account_name: r.accountName ? String(r.accountName) : null,
      is_active: false,
      created_at: iso(r.createdAt)!,
    })),
  };
}

export async function getPageDetail(
  db: DbOrTx,
  merchant: { id: string; aiEnabled: boolean },
  pageId: string,
  range: StatsRange,
  now = new Date(),
) {
  const t = schema.channelConnections;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, pageId), eq(t.merchantId, merchant.id), inArray(t.channel, [...PAGE_CHANNELS])));
  if (!row) return null;

  const days = RANGE_DAYS[range];
  const [usage, currentMap, prevMap, dailyMap] = await Promise.all([
    conversationsThisMonthByPage(db, merchant.id, [row.id], now),
    queryPageSummaries(db, merchant.id, { days, pageId: row.id, now }),
    queryPageSummaries(db, merchant.id, { days, previous: true, pageId: row.id, now }),
    queryPageDailySeries(db, merchant.id, { days, pageIds: [row.id], now }),
  ]);

  return {
    ...serializePageBase(row, merchant.aiEnabled, usage.overQuota, now),
    range,
    merchant_ai_enabled: merchant.aiEnabled,
    usage: {
      used: usage.used,
      limit: usage.limit,
      page_used: usage.by_page[0]?.used ?? 0,
    },
    summary: currentMap.get(row.id) ?? emptySummary(),
    previous_summary: prevMap.get(row.id) ?? emptySummary(),
    daily: dailyMap.get(row.id) ?? [],
  };
}

export async function updatePageAiSettings(
  db: DbOrTx,
  merchant: { id: string; aiEnabled: boolean },
  pageId: string,
  patch: { ai_enabled?: boolean; pause_hours?: number | null; ai_instructions?: string | null },
  now = new Date(),
) {
  const t = schema.channelConnections;
  const [existing] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, pageId), eq(t.merchantId, merchant.id), inArray(t.channel, [...PAGE_CHANNELS])));
  if (!existing) return null;

  let aiEnabled = existing.aiEnabled;
  let aiPausedUntil = existing.aiPausedUntil;
  let aiInstructions = existing.aiInstructions;

  if (patch.ai_enabled !== undefined) {
    aiEnabled = patch.ai_enabled;
    aiPausedUntil = null;
  }
  if (patch.pause_hours !== undefined) {
    if (patch.pause_hours === null) {
      aiPausedUntil = null;
    } else {
      if (patch.ai_enabled === undefined) aiEnabled = true;
      aiPausedUntil = new Date(now.getTime() + patch.pause_hours * 3_600_000);
    }
  }
  if (patch.ai_instructions !== undefined) {
    aiInstructions = sanitizePageNote(patch.ai_instructions);
  }

  const [updated] = await db
    .update(t)
    .set({ aiEnabled, aiPausedUntil, aiInstructions })
    .where(eq(t.id, pageId))
    .returning();

  const usage = await conversationsThisMonthByPage(db, merchant.id, [updated.id], now);
  return serializePageBase(updated, merchant.aiEnabled, usage.overQuota, now);
}

export async function disconnectPageById(
  db: DbOrTx,
  merchantId: string,
  pageId: string,
) {
  const t = schema.channelConnections;
  const [existing] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, pageId), eq(t.merchantId, merchantId), inArray(t.channel, [...PAGE_CHANNELS])));
  if (!existing) return null;

  const [updated] = await db
    .update(t)
    .set({ isActive: false, aiPausedUntil: null })
    .where(eq(t.id, pageId))
    .returning();

  return {
    id: updated.id,
    channel: updated.channel as 'FACEBOOK' | 'INSTAGRAM',
    account_name: updated.accountName ? String(updated.accountName) : null,
    is_active: false,
  };
}
