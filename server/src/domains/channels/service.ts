import { Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import type { ParsedInboundMessage } from './meta.js';

const log = new Logger('channels.service');

async function findOrCreateConversation(db: DbOrTx, connection: { id: string; merchantId: string }, customerRef: string): Promise<string> {
  const c = schema.conversations;
  const where = and(eq(c.channelConnectionId, connection.id), eq(c.customerRef, customerRef));
  const [existing] = await db.select({ id: c.id }).from(c).where(where);
  if (existing) return existing.id;

  const [created] = await db
    .insert(c)
    .values({
      merchantId: connection.merchantId,
      channelConnectionId: connection.id,
      customerRef,
      state: 'NEW',
      slots: {},
      lastMessageAt: new Date(),
    })
    .onConflictDoNothing({ target: [c.channelConnectionId, c.customerRef] })
    .returning({ id: c.id });
  if (created) return created.id;

  // Lost the race to a concurrent webhook delivery for the same customer: re-select.
  return (await db.select({ id: c.id }).from(c).where(where))[0].id;
}

/** Returns the message id (new or pre-existing for redelivered webhooks), or null if the account is unmapped. */
export async function ingestChannelMessage(db: DbOrTx, parsed: ParsedInboundMessage): Promise<string | null> {
  const cc = schema.channelConnections;
  const [connection] = await db
    .select()
    .from(cc)
    .where(and(eq(cc.channel, parsed.channel), eq(cc.externalAccountId, parsed.externalAccountId), eq(cc.isActive, true)));
  if (!connection) {
    log.warn(`unmapped_channel_account channel=${parsed.channel} external_account_id=${parsed.externalAccountId}`);
    return null;
  }

  const conversationId = await findOrCreateConversation(db, connection, parsed.externalCustomerId);
  const m = schema.messages;
  const [inserted] = await db
    .insert(m)
    .values({
      conversationId,
      direction: 'INBOUND',
      rawText: parsed.text,
      normalizedText: parsed.text,
      externalMessageId: parsed.externalMessageId,
      postbackPayload: parsed.postbackPayload,
    })
    .onConflictDoNothing({ target: m.externalMessageId, where: sql`external_message_id IS NOT NULL` })
    .returning({ id: m.id });
  if (inserted) return inserted.id;

  const [existing] = await db.select({ id: m.id }).from(m).where(eq(m.externalMessageId, parsed.externalMessageId));
  return existing?.id ?? null;
}
