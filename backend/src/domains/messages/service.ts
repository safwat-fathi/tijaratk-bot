import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Message } from '../../db/types.js';
import { processMessage } from '../../engine/pipeline.js';

export class ConversationNotFoundError extends Error {}

export interface MessageIngestRequest {
  conversation_id: string;
  raw_text: string;
  normalized_text: string;
}

export async function ingestMessage(db: DbOrTx, payload: MessageIngestRequest, merchantId: string) {
  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, payload.conversation_id));
  if (!conversation || conversation.merchantId !== merchantId) throw new ConversationNotFoundError(payload.conversation_id);

  const message: Message = {
    id: randomUUID(),
    conversationId: conversation.id,
    direction: 'INBOUND',
    rawText: payload.raw_text,
    normalizedText: payload.normalized_text,
    intent: null,
    intentConfidence: null,
    modelTier: null,
    escalationReason: null,
    externalMessageId: null,
    embedding: null,
    createdAt: new Date(),
    clusteredAt: null,
    messageType: null,
    richPayload: null,
    postbackPayload: null,
  };
  const result = await processMessage(db, conversation, message);

  let order = null;
  if (result.order) {
    const extracted = (result.order.extractedPayload ?? {}) as Record<string, any>;
    order = {
      id: result.order.id,
      status: result.order.status,
      confidence_score: result.order.confidenceScore,
      extracted_by_tier: result.order.extractedByTier,
      line_items: ((extracted.line_items ?? []) as any[]).map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        notes: i.notes ?? null,
        product_id: i.product_id ?? null,
      })),
      address: extracted.address ?? null,
      phone: extracted.phone ?? null,
      payment_method: extracted.payment_method ?? null,
      ambiguous_fields: extracted.ambiguous_fields ?? [],
    };
  }

  return {
    message_id: result.message.id,
    intent: result.message.intent,
    intent_confidence: result.message.intentConfidence,
    model_tier: result.message.modelTier,
    escalation_reason: result.message.escalationReason,
    order_id: result.order?.id ?? null,
    order_status: result.order?.status ?? null,
    order,
    answer_messages: result.messages,
  };
}
