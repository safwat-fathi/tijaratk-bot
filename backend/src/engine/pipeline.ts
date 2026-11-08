import { Logger } from '@nestjs/common';
import { and, count, desc, eq, isNotNull, ne, or, sql } from 'drizzle-orm';
import { getSettings } from '../config.js';
import { type DbOrTx, schema } from '../db/index.js';
import type { Conversation, Message, Order } from '../db/types.js';
import { writeOrder } from '../domains/checkout/order-writer.js';
import { createOrder } from '../domains/checkout/service.js';
import { resumeIfIdle, takeoverConversation } from '../domains/handoff/service.js';
import {
  type OutboundMessage,
  quickReplyMessage,
  textMessage,
} from '../domains/messaging/models.js';
import { pageAiState } from '../domains/pages/ai-state.js';
import { isOverConversationLimit } from '../domains/usage/service.js';
import { resolveAction } from './action-resolution.js';
import { classifyMessage } from './classification.js';
import { AICallError } from './clients.js';
import { type HistoryMessage, buildContextPrompt } from './context-budget.js';
import { estimateCost } from './cost.js';
import { embedText, findSimilarExamples } from './embeddings.js';
import { extractOrder } from './extraction.js';
import type { CallUsage } from './gateway.js';
import { detectGenderFromName, resolveCustomerGender } from './gender.js';
import { generateReply } from './generation.js';
import { handlePostback } from './postback-router.js';
import {
  buildResolvedOrderLines,
  matchLineItemsToProducts,
  resolveVariantsForLineItems,
} from './product-matching.js';
import type { GeneratedReply } from './schemas.js';
import { buildStoreFacts } from './store-facts.js';
import { matchTier0 } from './tier0-rules.js';

const log = new Logger('pipeline');
const DEFAULT_INTENTS = ['greeting', 'spam', 'reaction', 'purchase_intent', 'question', 'other'];

const greetingFallback = (storeName: string) => `أهلاً بيك في ${storeName}! 👋\nتحب أساعدك إزاي؟`;

export interface PipelineResult {
  message: Message;
  order: Order | null;
  messages: OutboundMessage[];
}

type Slots = Record<string, any>;

/** The pipeline owns the mutable fields of `message` and writes them back at every exit (SQLAlchemy flush equivalent). */
export async function saveMessage(db: DbOrTx, m: Message): Promise<void> {
  const { createdAt: _c, clusteredAt: _k, ...values } = m;
  await db
    .insert(schema.messages)
    .values(values)
    .onConflictDoUpdate({
      target: schema.messages.id,
      set: {
        intent: m.intent,
        intentConfidence: m.intentConfidence,
        modelTier: m.modelTier,
        escalationReason: m.escalationReason,
        embedding: m.embedding,
        aiAnswered: m.aiAnswered,
      },
    });
}

async function addUsageEvent(
  db: DbOrTx,
  conversationId: string,
  messageId: string,
  usage: CallUsage | null,
  o: { success: boolean; failedTier?: string },
) {
  await db.insert(schema.aiUsageEvents).values(
    usage
      ? {
          conversationId,
          messageId,
          tier: usage.tier,
          provider: usage.provider,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          latencyMs: usage.latencyMs,
          estimatedCost: estimateCost(usage.model, usage.inputTokens, usage.outputTokens),
          success: o.success,
        }
      : {
          conversationId,
          messageId,
          tier: o.failedTier ?? 'unknown',
          provider: 'openrouter',
          model: 'unknown',
          inputTokens: null,
          outputTokens: null,
          latencyMs: 0.0,
          estimatedCost: null,
          success: false,
        },
  );
}

async function triggerEscalation(db: DbOrTx, conversation: Conversation, message: Message, reason: string) {
  if (!message.escalationReason) message.escalationReason = reason;
  await takeoverConversation(db, conversation.merchantId, conversation.id, 'AI_ESCALATION', reason);
}

async function knownIntents(db: DbOrTx, merchantId: string): Promise<string[]> {
  const fromMessages = await db
    .selectDistinct({ intent: schema.messages.intent })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.conversations.id, schema.messages.conversationId))
    .where(and(isNotNull(schema.messages.intent), eq(schema.conversations.merchantId, merchantId)));
  const fromLabeled = await db
    .selectDistinct({ intent: schema.labeledExamples.intent })
    .from(schema.labeledExamples)
    .where(and(isNotNull(schema.labeledExamples.intent), eq(schema.labeledExamples.merchantId, merchantId)));
  const observed = new Set<string>([...fromMessages.map((r) => r.intent!), ...fromLabeled.map((r) => r.intent), ...DEFAULT_INTENTS]);
  return [...observed].sort();
}

async function correctionCount(db: DbOrTx, conversationId: string): Promise<number> {
  const o = schema.orders;
  const [row] = await db
    .select({ n: count() })
    .from(o)
    .where(
      and(
        eq(o.conversationId, conversationId),
        or(
          eq(o.status, 'REJECTED'),
          and(isNotNull(o.confirmedPayload), sql`${o.confirmedPayload}::text != ${o.extractedPayload}::text`),
        ),
      ),
    );
  return Number(row.n);
}

async function generateAiReply(
  db: DbOrTx,
  conversation: Conversation,
  message: Message,
  p: {
    merchantName: string;
    userPrompt: string;
    catalog?: string;
    policies?: string;
    history?: HistoryMessage[];
    pageNote?: string | null;
  },
): Promise<GeneratedReply | null> {
  try {
    const [reply, usage] = await generateReply({
      userPrompt: p.userPrompt,
      merchantName: p.merchantName,
      convState: conversation.state,
      slots: conversation.slots as Slots,
      catalog: p.catalog,
      policies: p.policies,
      history: p.history,
      pageNote: p.pageNote,
    });
    await addUsageEvent(db, conversation.id, message.id, usage, { success: true });
    return reply;
  } catch (e) {
    if (!(e instanceof AICallError)) throw e;
    log.warn(`generation_failed message_id=${message.id} error=${e.message}`);
    await addUsageEvent(db, conversation.id, message.id, null, { success: false, failedTier: 'llm' });
    return null;
  }
}

const supportOffer = (text: string, reason: string) =>
  quickReplyMessage(text, [
    { title: 'نعم، تواصل مع الدعم', payload: { action: 'escalate', reason } },
    { title: 'لا، القائمة الرئيسية', payload: { action: 'main_menu' } },
  ]);

function replyMessages(message: Message, generated: GeneratedReply | null): OutboundMessage[] {
  if (!generated) return [];
  if (generated.needs_human) {
    if (!message.escalationReason) message.escalationReason = 'unanswerable';
    return [supportOffer(generated.reply, 'unanswerable')];
  }
  message.aiAnswered = true;
  return [textMessage(generated.reply)];
}

async function setSlots(db: DbOrTx, conversation: Conversation, slots: Slots) {
  conversation.slots = slots;
  await db.update(schema.conversations).set({ slots }).where(eq(schema.conversations.id, conversation.id));
}

export async function processMessage(db: DbOrTx, conversation: Conversation, message: Message): Promise<PipelineResult> {
  const s = getSettings();
  conversation = await resumeIfIdle(db, conversation, s.HUMAN_TAKEOVER_IDLE_MINUTES); // a human who went quiet hands back to the AI
  const finish = async (order: Order | null, messages: OutboundMessage[]): Promise<PipelineResult> => {
    await saveMessage(db, message);
    return { message, order, messages };
  };
  await saveMessage(db, message); // session.add(message): orders reference it by FK
  const normalizedText = message.normalizedText ?? '';

  const [row] = await db
    .select({
      name: schema.merchants.name,
      currency: schema.merchants.currency,
      toolOrdering: schema.merchants.aiToolOrderingEnabled,
      merchantAiEnabled: schema.merchants.aiEnabled,
      ccId: schema.channelConnections.id,
      ccName: schema.channelConnections.accountName,
      ccAiEnabled: schema.channelConnections.aiEnabled,
      ccAiPausedUntil: schema.channelConnections.aiPausedUntil,
      ccAiInstructions: schema.channelConnections.aiInstructions,
    })
    .from(schema.merchants)
    .leftJoin(
      schema.channelConnections,
      conversation.channelConnectionId
        ? eq(schema.channelConnections.id, conversation.channelConnectionId)
        : sql`false`,
    )
    .where(eq(schema.merchants.id, conversation.merchantId));
  const merchantName = row.name;
  const page = row.ccId
    ? { aiEnabled: row.ccAiEnabled ?? true, aiPausedUntil: row.ccAiPausedUntil ?? null }
    : null;
  const pageNote = row.ccAiInstructions ?? null;
  // Past the plan's monthly quota: behave like AI off (the message is saved; the merchant answers by hand).
  const overQuota = row.merchantAiEnabled && (await isOverConversationLimit(db, conversation.merchantId, conversation.id));
  const aiState = pageAiState({ merchantAiEnabled: row.merchantAiEnabled, overQuota, page });
  const info = {
    name: row.name,
    currency: row.currency,
    toolOrdering: row.toolOrdering,
    aiEnabled: aiState === 'on',
  };
  const displayName = row.ccName || merchantName || 'المتجر';

  // --- Postback routing (L0 deterministic, no AI) ---
  if (message.postbackPayload && typeof message.postbackPayload === 'object') {
    const payload = message.postbackPayload as Slots;
    message.intent = `postback:${payload.action ?? 'unknown'}`;
    message.intentConfidence = 1.0;
    message.modelTier = 'RULE';
    return finish(null, await handlePostback(db, conversation.merchantId, conversation.id, payload));
  }

  // The AI stays silent in these cases with nothing else in the logs, so say which one applied.
  const skipReason =
    aiState === 'over_quota'
      ? 'over_quota'
      : aiState === 'master_off'
        ? 'merchant_ai_off'
        : aiState === 'off'
          ? 'page_ai_off'
          : aiState === 'paused'
            ? 'page_paused'
            : !conversation.aiEnabled
              ? 'conversation_ai_off'
              : conversation.humanTakeover
                ? 'human_takeover'
                : null;
  if (skipReason) log.warn(`ai_skipped reason=${skipReason} message_id=${message.id} conversation_id=${conversation.id} merchant_id=${conversation.merchantId}`);

  const tier0 = matchTier0(normalizedText);
  if (tier0) {
    message.intent = tier0;
    message.intentConfidence = 1.0;
    message.modelTier = 'RULE';
    const outbound: OutboundMessage[] = [];
    if (tier0 === 'greeting' && !conversation.humanTakeover) { // a human is in the conversation: no bot greeting or menu
      let aiReply: GeneratedReply | null = null;
      if (info.aiEnabled && conversation.aiEnabled) {
        aiReply = await generateAiReply(db, conversation, message, {
          merchantName,
          pageNote,
          userPrompt: `customer: ${normalizedText}\nThe customer just greeted you. Greet them back and ask how you can help.`,
        });
      }
      // Plain-text fallback only when AI is on but the call failed; AI off = stay silent.
      const aiOn = info.aiEnabled && conversation.aiEnabled && !conversation.humanTakeover;
      if (aiReply) {
        outbound.push(...replyMessages(message, aiReply));
      } else if (aiOn) {
        outbound.push(textMessage(greetingFallback(displayName)));
      }
    }
    return finish(null, outbound);
  }

  if (!info.aiEnabled || !conversation.aiEnabled || conversation.humanTakeover) {
    let outbound: OutboundMessage[] = [];
    if (!conversation.humanTakeover) {
      if ((conversation.slots as Slots).deterministic_checkout_step) {
        outbound = await handleDeterministicCheckoutStep(db, conversation, message);
      } else {
        message.intent = 'fallback:no_ai';
        message.intentConfidence = 1.0;
        message.modelTier = 'RULE';
      }
    }
    return finish(null, outbound);
  }

  // Read history BEFORE any further writes to `message`
  const m = schema.messages;
  const historyRows = await db
    .select()
    .from(m)
    .where(and(eq(m.conversationId, conversation.id), ne(m.id, message.id)))
    .orderBy(desc(m.createdAt))
    .limit(s.CONTEXT_HISTORY_TURNS);
  const history = historyRows.reverse();

  const detectedGender = resolveCustomerGender({
    slots: conversation.slots as Slots,
    text: normalizedText,
    history,
  });
  if (detectedGender !== 'UNKNOWN' && (conversation.slots as Slots).customer_gender !== detectedGender) {
    await setSlots(db, conversation, { ...(conversation.slots as Slots), customer_gender: detectedGender });
  }

  let examples: Awaited<ReturnType<typeof findSimilarExamples>> = [];
  try {
    message.embedding = await embedText(normalizedText);
    examples = await findSimilarExamples(db, message.embedding, conversation.merchantId);
  } catch (e) {
    if (!(e instanceof AICallError)) throw e;
    log.warn(`embedding_failed message_id=${message.id} error=${e.message}`);
  }

  const slotsNow = () => conversation.slots as Slots;
  const prompt = buildContextPrompt({
    history,
    slots: slotsNow(),
    currentText: normalizedText,
    maxTurns: s.CONTEXT_HISTORY_TURNS,
    examples,
  });
  const intents = await knownIntents(db, conversation.merchantId);
  const corrections = await correctionCount(db, conversation.id);

  if (info.toolOrdering) {
    const facts = await buildStoreFacts(db, conversation.merchantId, {
      embedding: message.embedding,
      query: normalizedText,
      currency: info.currency,
    });
    const resolution = await resolveAction(db, conversation, message, facts, pageNote);
    message.modelTier = 'DEEPSEEK';
    // Tools may have rewritten the conversation's slots (update_customer_info): re-read for the reply prompt.
    const [fresh] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversation.id));
    conversation.slots = fresh.slots;

    let outbound: OutboundMessage[] = [];
    if (resolution.escalationReason) {
      await triggerEscalation(db, conversation, message, resolution.escalationReason);
    } else {
      const aiReply = await generateAiReply(db, conversation, message, {
        merchantName,
        catalog: facts.catalog,
        policies: facts.policies,
        history,
        pageNote,
        userPrompt:
          `customer: ${normalizedText}\n` +
          `action_result: ${resolution.responseText}\n` +
          'Turn the action_result facts into a natural reply to the customer.',
      });
      outbound = replyMessages(message, aiReply);
    }
    return finish(null, outbound);
  }

  let classification: Awaited<ReturnType<typeof classifyMessage>>;
  try {
    classification = await classifyMessage({
      prompt,
      knownIntents: intents,
      threshold: s.CLASSIFICATION_CONFIDENCE_THRESHOLD,
      correctionCount: corrections,
      text: normalizedText,
      merchantName,
      convState: conversation.state,
      slots: slotsNow(),
    });
  } catch (e) {
    if (!(e instanceof AICallError)) throw e;
    log.warn(`classification_failed message_id=${message.id} error=${e.message}`);
    await addUsageEvent(db, conversation.id, message.id, null, { success: false, failedTier: 'llm' });
    if (!message.escalationReason) message.escalationReason = 'ai_call_failed';
    return finish(null, [supportOffer('عذراً، حصلت مشكلة في النظام. تحب نحولك لخدمة العملاء؟', 'ai_call_failed')]);
  }
  const [intent, reason, usage] = classification;

  if (usage) await addUsageEvent(db, conversation.id, message.id, usage, { success: true });
  message.intent = intent.intent;
  message.intentConfidence = intent.confidence;
  message.modelTier = 'DEEPSEEK';

  if (reason) {
    if (!message.escalationReason) message.escalationReason = reason;
    return finish(null, [supportOffer('عذراً، مش قادرين نفهم طلبك بالظبط. تحب نحولك لخدمة العملاء؟', reason)]);
  }

  let order: Order | null = null;
  if (intent.intent === 'purchase_intent' && (conversation.state === 'GATHERING' || conversation.state === 'CONFIRMING')) {
    const extractionPrompt = buildContextPrompt({
      history,
      slots: slotsNow(),
      currentText: normalizedText,
      maxTurns: s.CONTEXT_HISTORY_TURNS,
      examples,
      mode: 'extraction',
    });
    let extracted: Awaited<ReturnType<typeof extractOrder>>;
    try {
      extracted = await extractOrder({
        prompt: extractionPrompt,
        threshold: s.CLASSIFICATION_CONFIDENCE_THRESHOLD,
        correctionCount: corrections,
        text: normalizedText,
        merchantName,
        convState: conversation.state,
        slots: slotsNow(),
      });
    } catch (e) {
      if (!(e instanceof AICallError)) throw e;
      log.warn(`extraction_failed message_id=${message.id} error=${e.message}`);
      await addUsageEvent(db, conversation.id, message.id, null, { success: false, failedTier: 'llm' });
      if (!message.escalationReason) message.escalationReason = 'ai_call_failed';
      return finish(null, [supportOffer('عذراً، حصلت مشكلة في النظام. تحب نحولك لخدمة العملاء؟', 'ai_call_failed')]);
    }
    const [extraction, extractionReason, extractionUsage] = extracted;
    if (extractionUsage) await addUsageEvent(db, conversation.id, message.id, extractionUsage, { success: true });

    if (!extraction.line_items.length && extractionReason === 'confidence_below_threshold') {
      // Likely a misclassified policy question: drop order extraction, fall through to the knowledge base.
      order = null;
    } else {
      if (extractionReason) {
        if (!message.escalationReason) message.escalationReason = extractionReason;
        return finish(null, [supportOffer('عذراً، مش قادرين نفهم تفاصيل الطلب بالظبط. تحب نحولك لخدمة العملاء؟', extractionReason)]);
      }
      let items = await matchLineItemsToProducts(db, conversation.merchantId, extraction.line_items);
      items = await resolveVariantsForLineItems(db, items);
      extraction.line_items = items;
      const [lines, allResolved] = await buildResolvedOrderLines(db, items);
      const status =
        allResolved && !extraction.ambiguous_fields.length && extraction.confidence >= s.CLASSIFICATION_CONFIDENCE_THRESHOLD
          ? 'AUTO_CONFIRMED'
          : 'PENDING_REVIEW';
      order = await writeOrder(db, {
        merchantId: conversation.merchantId,
        conversationId: conversation.id,
        messageId: message.id,
        status,
        source: 'AI_EXTRACTION',
        lines,
        extractedPayload: extraction,
        confidenceScore: extraction.confidence,
        extractedByTier: 'DEEPSEEK',
        escalationReason: null,
        assignOrderNumber: false,
      });
    }
  }

  let outbound: OutboundMessage[];
  if (order) {
    message.aiAnswered = true;
    const display = order.orderNumber || order.id.slice(0, 8);
    outbound = [textMessage(`تم استلام طلبك #${display}. هنتواصل معاك قريب!`)];
  } else {
    const facts = await buildStoreFacts(db, conversation.merchantId, {
      embedding: message.embedding,
      query: normalizedText,
      currency: info.currency,
    });
    const aiReply = await generateAiReply(db, conversation, message, {
      merchantName,
      catalog: facts.catalog,
      policies: facts.policies,
      history,
      pageNote,
      userPrompt: `customer: ${normalizedText}`,
    });
    outbound = replyMessages(message, aiReply);
  }
  return finish(order, outbound);
}

async function handleDeterministicCheckoutStep(db: DbOrTx, conversation: Conversation, message: Message): Promise<OutboundMessage[]> {
  const step = (conversation.slots as Slots).deterministic_checkout_step as string;
  const slots: Slots = { ...(conversation.slots as Slots) };
  const outbound: OutboundMessage[] = [];
  const text = message.normalizedText ?? '';

  message.intent = `checkout_step:${step}`;
  message.intentConfidence = 1.0;
  message.modelTier = 'RULE';

  if (step === 'name') {
    slots.customer_name = text;
    const nameGender = detectGenderFromName(text);
    if (nameGender !== 'UNKNOWN' && !slots.customer_gender) {
      slots.customer_gender = nameGender;
    }
    slots.deterministic_checkout_step = 'phone';
    outbound.push(textMessage(`أهلاً بك يا ${text}!\n\nبرجاء إدخال رقم الموبايل للتواصل:`));
  } else if (step === 'phone') {
    const phone = text.replaceAll(' ', '');
    if (!/^01[0125]\d{8}$/.test(phone)) {
      outbound.push(textMessage('رقم الموبايل غير صحيح. يرجى إدخال رقم مصري صحيح (مثال: 01012345678):'));
    } else {
      slots.customer_phone = phone;
      slots.deterministic_checkout_step = 'address';
      outbound.push(textMessage('شكراً لك.\n\nأخيراً، برجاء كتابة عنوان التوصيل بالتفصيل:'));
    }
  } else if (step === 'address') {
    slots.customer_address = text;
    delete slots.deterministic_checkout_step;
    await setSlots(db, conversation, slots); // create_order reads the slots from the DB
    try {
      // savepoint: a failed checkout must not leave a half-converted cart behind
      const orderData = (await db.transaction((tx) => createOrder(tx, conversation.merchantId, conversation.id, true, message.id))) as any;
      outbound.push(textMessage(`تم تأكيد طلبك بنجاح! رقم الطلب: ${orderData.order_number} وسيتم التوصيل قريباً.`));
      outbound.push(quickReplyMessage('تحب تعمل حاجة تانية؟', [{ title: '🏠 القائمة', payload: { action: 'main_menu' } }]));
    } catch (e) {
      log.error(`deterministic_checkout_failed error=${e}`);
      outbound.push(textMessage('عفواً، حدثت مشكلة أثناء إتمام الطلب. يرجى مراجعة السلة أو المحاولة لاحقاً.'));
      outbound.push(quickReplyMessage('الرجوع للقائمة الرئيسية:', [{ title: '🏠 القائمة', payload: { action: 'main_menu' } }]));
    }
  }

  await setSlots(db, conversation, slots);
  return outbound;
}
