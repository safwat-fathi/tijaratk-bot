import { Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { runClustering } from '../clustering/job.js';
import { withConversationLock } from '../core/locks.js';
import { type Db, type DbOrTx, schema } from '../db/index.js';
import type { Conversation } from '../db/types.js';
import { type OutboundMessage, textFallback, textMessage } from '../domains/messaging/models.js';
import { markBotSent } from '../domains/messaging/bot-sent.js';
import { deliver } from '../domains/messaging/deliver.js';
import { processMessage } from '../engine/pipeline.js';

const log = new Logger('worker');

/** Send rich messages via the channel and persist each one that went out. Returns whether anything was delivered. */
async function sendOutbound(db: DbOrTx, redis: Redis, conversation: Conversation, outbound: OutboundMessage[]): Promise<boolean> {
  if (!outbound.length || !conversation.channelConnectionId) return false;
  const [conn] = await db.select().from(schema.channelConnections).where(eq(schema.channelConnections.id, conversation.channelConnectionId));
  if (!conn) return false;
  await markBotSent(redis, conversation.customerRef); // before AND after: the echo can land at either end of the send
  const results = await deliver(conn, conversation.customerRef, outbound);
  await markBotSent(redis, conversation.customerRef);
  for (const [i, msg] of outbound.entries()) {
    if (!results[i]) continue;
    await db.insert(schema.messages).values({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      rawText: textFallback(msg),
      normalizedText: textFallback(msg),
      messageType: msg.kind,
      richPayload: msg,
    });
  }
  return results.some(Boolean);
}

/** One inbound channel message: lock the conversation, run the pipeline, send + persist replies, commit. */
export async function processChannelMessage(db: Db, redis: Redis, messageId: string): Promise<void> {
  const [message] = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId));
  if (!message || message.intent !== null) return; // gone, or already processed (redelivery)
  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, message.conversationId));

  await withConversationLock(redis, conversation.id, () =>
    db.transaction(async (tx) => {
      // Re-read inside the lock: a previous holder may have just processed this message or changed the slots.
      const [fresh] = await tx.select().from(schema.messages).where(eq(schema.messages.id, messageId));
      if (fresh.intent !== null) return;
      const [conv] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, conversation.id));

      const result = await processMessage(tx, conv, fresh);
      let outbound = result.messages;
      if (!outbound.length && result.order) {
        // Shouldn't happen: fall back to a deterministic order confirmation.
        outbound = [textMessage(`تم استلام طلبك #${result.order.orderNumber || result.order.id.slice(0, 8)}. هنتواصل معاك قريب!`)];
      }
      const delivered = await sendOutbound(tx, redis, conv, outbound);
      // The pipeline marks a message answered before the send; a reply that never reached the customer must not use quota.
      if (result.message.aiAnswered && !delivered) {
        await tx.update(schema.messages).set({ aiAnswered: false }).where(eq(schema.messages.id, messageId));
        log.warn(`ai_reply_not_delivered message_id=${messageId} conversation_id=${conv.id}`);
      }
    }),
  );
}

export async function runAutoLearning(db: Db): Promise<number> {
  const created = await db.transaction((tx) => runClustering(tx));
  log.log(`auto_learning_run created=${created}`);
  return created;
}
