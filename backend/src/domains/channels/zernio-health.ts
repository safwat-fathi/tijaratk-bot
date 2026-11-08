import { Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { getSettings } from '../../config.js';
import { type Db, schema } from '../../db/index.js';
import { ZERNIO_API } from '../messaging/deliver.js';

const log = new Logger('channels.zernio-health');

/**
 * Zernio stops calling our webhook without any failed delivery when its own side breaks (billing block, disconnected
 * account), so nothing in the webhook path can say why messages stopped. Ask Zernio directly and log what it answers.
 */
export async function checkZernioHealth(db: Db): Promise<void> {
  const s = getSettings();
  if (!s.ZERNIO_API_KEY || !s.ZERNIO_PROFILE_ID) return;
  let accounts: { _id?: string; id?: string }[];
  try {
    const res = await fetch(`${ZERNIO_API}/accounts?${new URLSearchParams({ profileId: s.ZERNIO_PROFILE_ID })}`, {
      headers: { authorization: `Bearer ${s.ZERNIO_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      log.warn(`zernio_health_failed status=${res.status} body=${(await res.text()).slice(0, 300)}`);
      return;
    }
    accounts = ((await res.json()) as any).accounts ?? [];
  } catch (e) {
    log.warn(`zernio_health_error error=${e}`);
    return;
  }

  const t = schema.channelConnections;
  const connections = await db
    .select({ id: t.id, channel: t.channel, externalAccountId: t.externalAccountId, accountName: t.accountName })
    .from(t)
    .where(and(eq(t.isActive, true), isNull(t.pageAccessToken))); // token-bearing rows are legacy Graph connections, not Zernio's
  const known = new Set(accounts.map((a) => a._id ?? a.id));
  const missing = connections.filter((c) => !known.has(c.externalAccountId));
  for (const c of missing) {
    log.warn(`zernio_health_account_missing channel=${c.channel} account_id=${c.externalAccountId} name=${c.accountName ?? '-'}`);
  }
  log.log(`zernio_health zernio_accounts=${accounts.length} active_connections=${connections.length} missing=${missing.length}`);
}
