import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/index.js';
import type { Conversation, Message } from '../src/db/types.js';
import { AICallError } from '../src/engine/clients.js';
import { recordHumanActivity } from '../src/domains/handoff/service.js';
import { processMessage } from '../src/engine/pipeline.js';
import { fakeAi, makeConversation, makeMerchant, makeProduct, resetAi, schema, unit, withRollback } from './harness.js';

afterEach(resetAi);

const msg = (c: Conversation, text: string, o: Partial<Message> = {}): Message => ({
  id: randomUUID(), conversationId: c.id, direction: 'INBOUND', rawText: text, normalizedText: text, intent: null,
  intentConfidence: null, modelTier: null, escalationReason: null, externalMessageId: null, embedding: null,
  createdAt: new Date(), clusteredAt: null, messageType: null, richPayload: null, postbackPayload: null, ...o,
});

const purchase = { intent: 'purchase_intent', confidence: 0.95 };
const extraction = (o: any = {}) => ({ line_items: [{ product_name: 'قميص', quantity: 2 }], confidence: 0.9, ...o });
const kinds = (r: { messages: { kind: string }[] }) => r.messages.map((m) => m.kind);
const userPromptOf = (call: any) => call.messages[1].content as string;

async function world(db: Db, o: { toolOrdering?: boolean; productEmbedding?: number[] | null } = {}) {
  const m = await makeMerchant(db, { name: 'متجر النور', aiToolOrderingEnabled: o.toolOrdering ?? false });
  const c = await makeConversation(db, m.id);
  const p = await makeProduct(db, m.id, { price: '100.00', embedding: o.productEmbedding === undefined ? unit(0) : o.productEmbedding });
  return { m, c, p };
}

describe('tier 0 and routing without AI classification', () => {
  it('spam / reactions short-circuit with no AI call and no reply', async () => {
    const ai = fakeAi([]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const spam = await processMessage(db, c, msg(c, 'https://spam.example'));
      expect(spam).toMatchObject({ order: null, messages: [], message: { intent: 'spam', intentConfidence: 1, modelTier: 'RULE' } });
      const react = await processMessage(db, c, msg(c, '👍'));
      expect(react.message.intent).toBe('reaction');
      expect(ai.calls).toHaveLength(0);
      const stored = await db.select().from(schema.messages).where(eq(schema.messages.id, spam.message.id));
      expect(stored[0]).toMatchObject({ intent: 'spam', modelTier: 'RULE' }); // persisted
    });
  });

  it('greeting: AI reply only; generation failure falls back to a plain text greeting', async () => {
    const ai = fakeAi([{ reply: 'أهلاً بيك!' }, new AICallError('boom')]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      await db.insert(schema.channelConnections).values({ id: 'cc1', merchantId: c.merchantId, channel: 'FACEBOOK', externalAccountId: 'p', accountName: 'صفحة النور' });
      await db.update(schema.conversations).set({ channelConnectionId: 'cc1' }).where(eq(schema.conversations.id, c.id));
      const conv = { ...c, channelConnectionId: 'cc1' };

      const ok = await processMessage(db, conv, msg(c, 'السلام عليكم'));
      expect(kinds(ok)).toEqual(['text']);
      expect((ok.messages[0] as any).text).toBe('أهلاً بيك!');
      expect(ai.calls).toHaveLength(1);

      const failed = await processMessage(db, conv, msg(c, 'hello'));
      expect(kinds(failed)).toEqual(['text']);
      expect((failed.messages[0] as any).text).toContain('صفحة النور'); // channel account name wins over merchant name
      const events = await db.select().from(schema.aiUsageEvents);
      expect(events.map((e) => e.success).sort()).toEqual([false, true]);
    });
  });

  it('human takeover / AI disabled: no AI, no reply', async () => {
    const ai = fakeAi([]);
    await withRollback(async (db) => {
      const { m, c } = await world(db);
      const taken = await processMessage(db, { ...c, humanTakeover: true }, msg(c, 'عايز اطلب'));
      expect(taken.messages).toEqual([]);
      await db.update(schema.merchants).set({ aiEnabled: false }).where(eq(schema.merchants.id, m.id));
      const off = await processMessage(db, c, msg(c, 'عايز اطلب'));
      expect(off.message).toMatchObject({ intent: 'fallback:no_ai', modelTier: 'RULE' });
      expect(off.messages).toEqual([]);
      expect(ai.calls).toHaveLength(0);
    });
  });

  it('human takeover: stays silent (even on a greeting) until the idle window passes, then the AI resumes', async () => {
    const ai = fakeAi([{ reply: 'أهلاً بيك!' }]);
    await withRollback(async (db) => {
      const { m, c } = await world(db);
      await recordHumanActivity(db, m.id, c.id);
      const paused = { ...c, humanTakeover: true };

      const quiet = await processMessage(db, paused, msg(c, 'السلام عليكم'));
      expect(quiet.messages).toEqual([]); // no AI reply and no menu while a human has the conversation
      expect(ai.calls).toHaveLength(0);
      const [still] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(still.humanTakeover).toBe(true);

      const h = schema.humanHandoffs;
      await db.update(h).set({ updatedAt: new Date(Date.now() - 31 * 60_000) }).where(eq(h.conversationId, c.id)); // idle > 30 min
      const resumed = await processMessage(db, paused, msg(c, 'السلام عليكم'));
      expect(kinds(resumed)).toEqual(['text']); // the AI answers a greeting alone
      expect(ai.calls).toHaveLength(1);
      const [after] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(after.humanTakeover).toBe(false);
      const [handoff] = await db.select().from(h).where(eq(h.conversationId, c.id));
      expect(handoff.resolvedAt).not.toBeNull();
    });
  });

  it('postback payloads are routed deterministically', async () => {
    const ai = fakeAi([]);
    await withRollback(async (db) => {
      const { c, p } = await world(db);
      await db.update(schema.products).set({ category: 'ملابس' }).where(eq(schema.products.id, p.id));
      const r = await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'browse_categories' } }));
      expect(r.message).toMatchObject({ intent: 'postback:browse_categories', modelTier: 'RULE' });
      expect((r.messages[0] as any).quick_replies[0]).toEqual({ title: 'ملابس', payload: { action: 'view_category', category: 'ملابس' } });
      const menu = await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'main_menu' } }));
      expect(kinds(menu)).toEqual(['text']); // no buttons
      const unknown = await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'zzz' } }));
      expect((unknown.messages[0] as any).text).toContain('مش متأكد');
      expect(ai.calls).toHaveLength(0);
    });
  });

  it('add_to_cart postback then view_cart renders totals; escalate hands the conversation to a human', async () => {
    fakeAi([]);
    await withRollback(async (db) => {
      const { c, p } = await world(db);
      const add = await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'add_to_cart', product_id: p.id } }));
      expect((add.messages[0] as any).text).toBe('✅ تم إضافة قميص للسلة (الكمية: 1)');
      const cart = await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'view_cart' } }));
      expect((cart.messages[0] as any).text).toBe('🛒 السلة\n\n• 1x قميص\n  100 جنيه\n\n💰 الإجمالي: 100 جنيه');
      const esc = await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'escalate', reason: 'because' } }));
      expect((esc.messages[0] as any).text).toContain('تم تحويلك');
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(conv.humanTakeover).toBe(true);
    });
  });
});

describe('classification + extraction flow', () => {
  it('purchase intent in GATHERING creates an AUTO_CONFIRMED order linked to the matched product', async () => {
    const ai = fakeAi([{ intent: 'purchase_intent', confidence: 0.95 }, extraction()]);
    await withRollback(async (db) => {
      const { m, c, p } = await world(db);
      const r = await processMessage(db, c, msg(c, 'عايز قميصين'));
      expect(r.message).toMatchObject({ intent: 'purchase_intent', intentConfidence: 0.95, modelTier: 'DEEPSEEK' });
      expect(r.order).toMatchObject({ status: 'AUTO_CONFIRMED', source: 'AI_EXTRACTION', orderNumber: null, merchantId: m.id, subtotal: '200.00', total: '200.00', deliveryFee: null });
      expect((r.messages[0] as any).text).toBe(`تم استلام طلبك #${r.order!.id.slice(0, 8)}. هنتواصل معاك قريب!`);
      const [item] = await db.select().from(schema.orderItems);
      expect(item).toMatchObject({ productId: p.id, unitPrice: '100.00', quantity: 2, nameSnapshot: 'قميص' });
      expect((r.order!.extractedPayload as any).line_items[0]).toMatchObject({ product_name: 'قميص', product_id: p.id, quantity: 2 });
      expect(ai.calls).toHaveLength(2); // classify + extract, no reply generation when an order exists
      expect(ai.calls[0]).toMatchObject({ max_tokens: 4096, temperature: 0.1, stream: false });
      expect(ai.calls[0].response_format.json_schema.schema.properties.intent.enum).toEqual(['greeting', 'other', 'purchase_intent', 'question', 'reaction', 'spam']);
      const events = await db.select().from(schema.aiUsageEvents);
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ tier: 'deepseek', provider: 'openrouter', inputTokens: 10, outputTokens: 5, success: true });
    });
  });

  it('an unmatched product forces PENDING_REVIEW', async () => {
    fakeAi([purchase, extraction()]);
    await withRollback(async (db) => {
      const { c } = await world(db, { productEmbedding: unit(7) }); // far from the query embedding
      const r = await processMessage(db, c, msg(c, 'عايز قميصين'));
      expect(r.order!.status).toBe('PENDING_REVIEW');
      expect(await db.select().from(schema.orderItems)).toHaveLength(0);
    });
  });

  it('variants: no hint => PENDING_REVIEW; matching hint => AUTO_CONFIRMED with the variant priced', async () => {
    await withRollback(async (db) => {
      fakeAi([purchase, extraction()]);
      const { c, p } = await world(db);
      await db.insert(schema.productVariants).values({ productId: p.id, label: 'XL', price: '120.00' });
      const noHint = await processMessage(db, c, msg(c, 'عايز قميصين'));
      expect(noHint.order!.status).toBe('PENDING_REVIEW');
      expect((noHint.order!.extractedPayload as any).line_items[0]).toMatchObject({ variant_required: true, variant_id: null });

      fakeAi([purchase, extraction({ line_items: [{ product_name: 'قميص', quantity: 1, variant_hint: 'xl' }] })]);
      const hint = await processMessage(db, c, msg(c, 'عايز قميص xl'));
      expect(hint.order).toMatchObject({ status: 'AUTO_CONFIRMED', subtotal: '120.00' });
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, hint.order!.id));
      expect(items[0]).toMatchObject({ variantSnapshot: 'XL', unitPrice: '120.00' });
    });
  });

  it('ambiguous fields or low extraction confidence escalate instead of ordering', async () => {
    fakeAi([purchase, extraction({ ambiguous_fields: ['phone'] })]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const r = await processMessage(db, c, msg(c, 'عايز قميصين'));
      expect(r.order).toBeNull();
      expect(r.message.escalationReason).toBe('ambiguous_fields_present');
      expect((r.messages[0] as any).quick_replies[0].payload).toEqual({ action: 'escalate', reason: 'ambiguous_fields_present' });
    });
  });

  it('empty low-confidence extraction falls through to the knowledge base (misclassified FAQ)', async () => {
    fakeAi([purchase, { line_items: [], confidence: 0.2 }, { reply: 'بنشحن لكل مصر' }]);
    await withRollback(async (db) => {
      const { m, c } = await world(db);
      await db.insert(schema.storeKnowledge).values({ merchantId: m.id, knowledgeType: 'shipping', title: 'الشحن', content: 'الشحن لكل المحافظات', keywords: ['الشحن'] });
      const r = await processMessage(db, c, msg(c, 'الشحن بكام'));
      expect(r.order).toBeNull();
      expect(r.messages).toEqual([{ kind: 'text', text: 'بنشحن لكل مصر' }]);
    });
  });

  it('low-confidence classification escalates without an automatic reply', async () => {
    const ai = fakeAi([{ intent: 'question', confidence: 0.3 }]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const r = await processMessage(db, c, msg(c, 'ايه ده'));
      expect(r.message).toMatchObject({ intent: 'question', escalationReason: 'confidence_below_threshold' });
      expect(r.messages[0]).toMatchObject({ kind: 'quick_reply', quick_replies: [{ payload: { action: 'escalate', reason: 'confidence_below_threshold' } }, { payload: { action: 'main_menu' } }] });
      expect(ai.calls).toHaveLength(1);
    });
  });

  it('repeated corrections / reasoning-heavy text escalate before any model call', async () => {
    const ai = fakeAi([]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const r = await processMessage(db, c, msg(c, 'لو المقاس كبير يبقى هاخد الاصغر'));
      expect(r.message.escalationReason).toBe('reasoning_heavy_content');
      expect(ai.calls).toHaveLength(0);
    });
  });

  it('classification failure persists the message with ai_call_failed and a support offer', async () => {
    fakeAi([new AICallError('down')]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const m = msg(c, 'عايز اطلب');
      const r = await processMessage(db, c, m);
      expect(r.messages[0]).toMatchObject({ kind: 'quick_reply', quick_replies: [{ payload: { action: 'escalate', reason: 'ai_call_failed' } }, {}] });
      const [stored] = await db.select().from(schema.messages).where(eq(schema.messages.id, m.id));
      expect(stored.escalationReason).toBe('ai_call_failed');
      const [event] = await db.select().from(schema.aiUsageEvents);
      expect(event).toMatchObject({ success: false, model: 'unknown', latencyMs: 0 });
    });
  });

  it('extraction failure keeps the classification and flags ai_call_failed', async () => {
    fakeAi([purchase, new AICallError('down')]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const m = msg(c, 'عايز قميصين');
      const r = await processMessage(db, c, m);
      expect(r.message).toMatchObject({ intent: 'purchase_intent', escalationReason: 'ai_call_failed' });
      expect(r.order).toBeNull();
    });
  });

  it('schema-invalid model output is an AI failure, not a crash', async () => {
    fakeAi([{ intent: 'question' /* no confidence */ }]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const r = await processMessage(db, c, msg(c, 'ايه ده'));
      expect(r.message.escalationReason).toBe('ai_call_failed');
    });
  });

  it('non-purchase intent answers from the best-matching store knowledge', async () => {
    const ai = fakeAi([{ intent: 'question', confidence: 0.9 }, { reply: 'مواعيد العمل ١٠ للـ ١٠' }]);
    await withRollback(async (db) => {
      const { m, c } = await world(db);
      await db.insert(schema.storeKnowledge).values([
        { merchantId: m.id, knowledgeType: 'faq', title: 'مواعيد', content: 'عام', keywords: ['مواعيد'] },
        { merchantId: m.id, knowledgeType: 'faq', title: 'مواعيد العمل', content: 'من ١٠ ل ١٠', keywords: ['مواعيد العمل'] },
      ]);
      const r = await processMessage(db, c, msg(c, 'ايه مواعيد العمل؟'));
      expect(r.order).toBeNull();
      expect(r.messages).toEqual([{ kind: 'text', text: 'مواعيد العمل ١٠ للـ ١٠' }]);
      expect(userPromptOf(ai.calls[1])).toContain('store_info: من ١٠ ل ١٠');
    });
  });

  it('with no knowledge match the reply prompt says so; reply failure yields no outbound', async () => {
    const ai = fakeAi([{ intent: 'question', confidence: 0.9 }, new AICallError('x')]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      const r = await processMessage(db, c, msg(c, 'ايه ده'));
      expect(r.messages).toEqual([]);
      expect(userPromptOf(ai.calls[1])).toContain('No store_info is available');
    });
  });

  it('few-shot examples are merchant-scoped first, then global', async () => {
    const ai = fakeAi([{ intent: 'question', confidence: 0.9 }, { reply: 'ok' }]);
    await withRollback(async (db) => {
      const { m, c } = await world(db);
      await db.insert(schema.labeledExamples).values([
        { merchantId: m.id, normalizedText: 'سؤال خاص', intent: 'question', embedding: unit(0), source: 'merchant' },
        { merchantId: null, normalizedText: 'سؤال عام', intent: 'question', embedding: unit(0), source: 'seed' },
      ]);
      await processMessage(db, c, msg(c, 'ايه ده'));
      const prompt = userPromptOf(ai.calls[0]);
      expect(prompt).toContain('- customer: سؤال خاص -> intent: question');
      expect(prompt).not.toContain('سؤال عام');
    });
  });

  it('known intents include observed merchant labels (and only this merchant\'s)', async () => {
    const ai = fakeAi([{ intent: 'other', confidence: 0.9 }, { reply: 'ok' }]);
    await withRollback(async (db) => {
      const { m, c } = await world(db);
      const other = await makeMerchant(db, { name: 'O' });
      await db.insert(schema.labeledExamples).values([
        { merchantId: m.id, normalizedText: 'a', intent: 'complaint', source: 'merchant' },
        { merchantId: other.id, normalizedText: 'b', intent: 'secret_other_tenant', source: 'merchant' },
      ]);
      await processMessage(db, c, msg(c, 'ايه ده'));
      expect(ai.calls[0].response_format.json_schema.schema.properties.intent.enum).toContain('complaint');
      expect(ai.calls[0].response_format.json_schema.schema.properties.intent.enum).not.toContain('secret_other_tenant');
    });
  });
});

describe('tool ordering mode', () => {
  it('routes through action resolution and replies from the action result', async () => {
    const ai = fakeAi([{ action: 'search_products', query: 'قميص', confidence: 0.9 }, { reply: 'لقيت قميص' }]);
    await withRollback(async (db) => {
      const { c } = await world(db, { toolOrdering: true });
      const r = await processMessage(db, c, msg(c, 'عندكم قمصان؟'));
      expect(r.message.modelTier).toBe('DEEPSEEK');
      expect(r.messages).toEqual([{ kind: 'text', text: 'لقيت قميص' }]);
      expect(userPromptOf(ai.calls[1])).toContain('action_result: وجدت 1 منتج(ات): قميص');
      const [act] = await db.select().from(schema.aiActions);
      expect(act).toMatchObject({ actionType: 'search_products', status: 'executed', arguments: { query: 'قميص', filters: {} } });
    });
  });

  it('a rejected action escalates (action_rejected:code) and hands over to a human', async () => {
    fakeAi([{ action: 'get_product', product_id: 'does-not-exist', confidence: 0.9 }]);
    await withRollback(async (db) => {
      const { c } = await world(db, { toolOrdering: true });
      const r = await processMessage(db, c, msg(c, 'تفاصيل المنتج'));
      expect(r.message.escalationReason).toBe('action_rejected:product_not_found');
      expect(r.messages).toEqual([]);
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(conv.humanTakeover).toBe(true);
      const [act] = await db.select().from(schema.aiActions);
      expect(act).toMatchObject({ status: 'rejected', errors: [{ code: 'product_not_found' }] });
    });
  });

  it('invalid JSON twice => ai_call_failed escalation; once => retried', async () => {
    await withRollback(async (db) => {
      fakeAi([{ action: 'nope', confidence: 1 }, { action: 'nope', confidence: 1 }]);
      const { c } = await world(db, { toolOrdering: true });
      const r = await processMessage(db, c, msg(c, 'x y'));
      expect(r.message.escalationReason).toBe('ai_call_failed');

      fakeAi([{ action: 'nope' }, { action: 'get_checkout_state', confidence: 80 }, { reply: 'السلة فاضية' }]);
      const ok = await processMessage(db, { ...c, humanTakeover: false }, msg(c, 'السلة فيها ايه'));
      expect(ok.messages).toEqual([{ kind: 'text', text: 'السلة فاضية' }]);
    });
  });

  it('update_customer_info rewrites slots and the reply prompt sees them; bad phone is rejected without writes', async () => {
    const ai = fakeAi([{ action: 'update_customer_info', name: 'علي', phone: '01012345678', address: 'القاهرة', confidence: 0.9 }, { reply: 'تمام' }, { action: 'update_customer_info', phone: '123', confidence: 0.9 }]);
    await withRollback(async (db) => {
      const { c } = await world(db, { toolOrdering: true });
      await processMessage(db, c, msg(c, 'اسمي علي'));
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(conv.slots).toEqual({ customer_name: 'علي', customer_phone: '01012345678', customer_address: 'القاهرة' });
      expect(ai.calls[1].messages[0].content).toContain('"customer_name": "علي"');

      const bad = await processMessage(db, conv, msg(c, 'رقمي 123'));
      expect(bad.message.escalationReason).toBe('action_rejected:argument_invalid');
    });
  });

  it('create_order through the tool layer produces a numbered cart order', async () => {
    fakeAi([{ action: 'add_to_cart', product_id: 'P', quantity: 2, confidence: 0.9 }]);
    await withRollback(async (db) => {
      const { m, c, p } = await world(db, { toolOrdering: true });
      const [ai] = [fakeAi([{ action: 'add_to_cart', product_id: p.id, quantity: 2, confidence: 0.9 }, { reply: 'اتضاف' }, { action: 'create_order', confirm: true, confidence: 0.9 }, { reply: 'تم' }])];
      void ai;
      await db.update(schema.conversations).set({ slots: { customer_name: 'A', customer_phone: '01012345678', customer_address: 'Cairo' } }).where(eq(schema.conversations.id, c.id));
      const fresh = { ...c, slots: { customer_name: 'A', customer_phone: '01012345678', customer_address: 'Cairo' } };
      await processMessage(db, fresh, msg(c, 'ضيف قميصين'));
      await processMessage(db, fresh, msg(c, 'أكد الطلب'));
      const [order] = await db.select().from(schema.orders);
      expect(order).toMatchObject({ orderNumber: 1, source: 'CART_CHECKOUT', status: 'CONFIRMED', total: '200.00', merchantId: m.id });
    });
  });
});

describe('deterministic checkout (postback-driven, no AI)', () => {
  it('collects name -> phone -> address and places the order', async () => {
    const ai = fakeAi([]);
    await withRollback(async (db) => {
      const { c, p } = await world(db);
      const turn = async (text: string, o: Partial<Message> = {}) => {
        const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
        // AI disabled for the conversation, which is how the pipeline reaches the deterministic steps
        return processMessage(db, { ...conv, aiEnabled: false }, msg(c, text, o));
      };
      await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'add_to_cart', product_id: p.id } }));
      await processMessage(db, c, msg(c, 'x', { postbackPayload: { action: 'start_checkout' } }));
      expect(((await turn('علي حسن')).messages[0] as any).text).toContain('أهلاً بك يا علي حسن');
      expect(((await turn('123')).messages[0] as any).text).toContain('رقم الموبايل غير صحيح');
      expect(((await turn('010 1234 5678')).messages[0] as any).text).toContain('عنوان التوصيل');
      const done = await turn('القاهرة، مدينة نصر');
      expect((done.messages[0] as any).text).toBe('تم تأكيد طلبك بنجاح! رقم الطلب: 1 وسيتم التوصيل قريباً.');
      const [order] = await db.select().from(schema.orders);
      expect(order).toMatchObject({ customerName: 'علي حسن', customerPhone: '01012345678', deliveryAddress: 'القاهرة، مدينة نصر', total: '100.00' });
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(conv.slots).not.toHaveProperty('deterministic_checkout_step');
      expect(ai.calls).toHaveLength(0);
    });
  });

  it('a failing checkout (empty cart) apologises instead of crashing', async () => {
    fakeAi([]);
    await withRollback(async (db) => {
      const { c } = await world(db);
      await db.update(schema.conversations).set({ slots: { deterministic_checkout_step: 'address', customer_name: 'A', customer_phone: '01012345678' } }).where(eq(schema.conversations.id, c.id));
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      const r = await processMessage(db, { ...conv, aiEnabled: false }, msg(c, 'Cairo'));
      expect((r.messages[0] as any).text).toContain('حدثت مشكلة');
    });
  });
});
