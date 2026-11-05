import { Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import { recordHumanActivity } from '../handoff/service.js';
import type { ParsedInboundMessage } from './meta.js';
import type { ParsedOutgoingMessage } from './zernio.js';

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

async function findConnection(db: DbOrTx, channel: ParsedInboundMessage['channel'], externalAccountId: string) {
  const cc = schema.channelConnections;
  const [connection] = await db
    .select()
    .from(cc)
    .where(and(eq(cc.channel, channel), eq(cc.externalAccountId, externalAccountId), eq(cc.isActive, true)));
  return connection;
}

/** Returns the message id (new or pre-existing for redelivered webhooks), or null if the account is unmapped. */
export async function ingestChannelMessage(db: DbOrTx, parsed: ParsedInboundMessage): Promise<string | null> {
  const connection = await findConnection(db, parsed.channel, parsed.externalAccountId);
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

/**
 * A person replied from our side outside the portal (Zernio inbox, native FB/IG inbox). Stores it in the history and
 * pauses the AI for that conversation. Never creates a conversation: an outgoing message to someone we have no
 * conversation with is not ours to track. Returns true when it was new (a redelivery returns false and changes nothing).
 */
export async function ingestHumanReply(db: DbOrTx, parsed: ParsedOutgoingMessage): Promise<boolean> {
  const connection = await findConnection(db, parsed.channel, parsed.externalAccountId);
  if (!connection) return false;
  const c = schema.conversations;
  const [conversation] = await db
    .select({ id: c.id })
    .from(c)
    .where(and(eq(c.channelConnectionId, connection.id), eq(c.customerRef, parsed.externalCustomerId)));
  if (!conversation) return false;

  const m = schema.messages;
  const [inserted] = await db
    .insert(m)
    .values({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      rawText: parsed.text,
      normalizedText: parsed.text,
      externalMessageId: parsed.externalMessageId,
    })
    .onConflictDoNothing({ target: m.externalMessageId, where: sql`external_message_id IS NOT NULL` })
    .returning({ id: m.id });
  if (!inserted) return false;
  await recordHumanActivity(db, connection.merchantId, conversation.id);
  return true;
}
