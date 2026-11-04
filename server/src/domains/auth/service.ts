import { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Merchant } from '../../db/types.js';
import { type FacebookIdentity, type FacebookPage, subscribePageToApp } from './meta-client.js';

const log = new Logger('auth.service');

/** One function serves signup and login by design (no separate registration step). */
export async function findOrCreateMerchantByFacebookId(db: DbOrTx, identity: FacebookIdentity): Promise<Merchant> {
  const t = schema.merchants;
  const find = async () => (await db.select().from(t).where(eq(t.facebookUserId, identity.facebookUserId)))[0];
  const existing = await find();
  if (existing) return existing;
  // ON CONFLICT instead of the Python flush/rollback dance: a concurrent signup just loses and re-selects.
  const [created] = await db.insert(t).values({ name: identity.name, facebookUserId: identity.facebookUserId }).onConflictDoNothing().returning();
  return created ?? (await find());
}

/** Upserts a ChannelConnection per FB page and deactivates pages the user unchecked. */
export async function provisionChannelConnections(
  db: DbOrTx,
  merchantId: string,
  pages: FacebookPage[],
): Promise<{ connected: number; conflicts: string[] }> {
  const t = schema.channelConnections;
  let connected = 0;
  const conflicts: string[] = [];
  const provisioned = new Set<string>();

  for (const page of pages) {
    provisioned.add(page.pageId);
    const [existing] = await db.select().from(t).where(and(eq(t.channel, 'FACEBOOK'), eq(t.externalAccountId, page.pageId)));
    if (existing) {
      if (existing.merchantId !== merchantId) {
        log.warn(`page_conflict page_id=${page.pageId} owned_by=${existing.merchantId} requested_by=${merchantId}`);
        conflicts.push(page.pageId);
        continue;
      }
      await db.update(t).set({ pageAccessToken: page.accessToken, accountName: page.name, isActive: true }).where(eq(t.id, existing.id));
    } else {
      await db.insert(t).values({
        merchantId,
        channel: 'FACEBOOK',
        externalAccountId: page.pageId,
        accountName: page.name,
        pageAccessToken: page.accessToken,
      });
    }
    await subscribePageToApp(page);
    connected++;
    log.log(`channel_connection_provisioned merchant_id=${merchantId} page_id=${page.pageId} page_name=${page.name}`);
  }

  const all = await db.select().from(t).where(and(eq(t.merchantId, merchantId), eq(t.channel, 'FACEBOOK')));
  for (const conn of all) {
    if (!provisioned.has(conn.externalAccountId)) await db.update(t).set({ isActive: false }).where(eq(t.id, conn.id));
  }
  return { connected, conflicts };
}
