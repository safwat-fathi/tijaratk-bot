import { afterEach, describe, expect, it } from 'vitest';
import { AICallError } from '../src/engine/clients.js';
import { authHeader, fakeAi, makeConversation, makeMerchant, makeProduct, resetAi, schema, withApp } from './harness.js';

afterEach(resetAi);

describe('POST /messages', () => {
  it('200 with the full response shape (answer messages included)', async () => {
    fakeAi([{ intent: 'question', confidence: 0.9 }, { reply: 'أهلاً' }]);
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const c = await makeConversation(db, m.id);
      const res = await http.post('/messages').set(authHeader(m.id)).send({ conversation_id: c.id, raw_text: 'ايه ده', normalized_text: 'ايه ده' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message_id: expect.any(String),
        intent: 'question',
        intent_confidence: 0.9,
        model_tier: 'DEEPSEEK',
        escalation_reason: null,
        order_id: null,
        order_status: null,
        order: null,
        answer_messages: [{ kind: 'text', text: 'أهلاً' }],
      });
    });
  });

  it('returns the order detail for a purchase (line items trimmed to the 4 public fields)', async () => {
    const { unit } = await import('./harness.js');
    fakeAi([{ intent: 'purchase_intent', confidence: 0.95 }, { line_items: [{ product_name: 'قميص', quantity: 2, notes: 'أزرق' }], address: 'القاهرة', confidence: 0.9 }], unit(0));
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const c = await makeConversation(db, m.id);
      const p = await makeProduct(db, m.id, { embedding: unit(0) });
      const res = await http.post('/messages').set(authHeader(m.id)).send({ conversation_id: c.id, raw_text: 'عايز قميصين', normalized_text: 'عايز قميصين' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ order_status: 'AUTO_CONFIRMED', order: { status: 'AUTO_CONFIRMED', extracted_by_tier: 'DEEPSEEK', address: 'القاهرة', phone: null, payment_method: null, ambiguous_fields: [] } });
      expect(res.body.order.line_items).toEqual([{ product_name: 'قميص', quantity: 2, notes: 'أزرق', product_id: p.id }]);
    });
  });

  it('202 (not Nest\'s default 201) when the AI call failed, and the message is still stored', async () => {
    fakeAi([new AICallError('down')]);
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const c = await makeConversation(db, m.id);
      const res = await http.post('/messages').set(authHeader(m.id)).send({ conversation_id: c.id, raw_text: 'عايز اطلب', normalized_text: 'عايز اطلب' });
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ escalation_reason: 'ai_call_failed' });
      expect((await db.select().from(schema.messages)).map((x) => x.escalationReason)).toEqual(['ai_call_failed']);
    });
  });

  it('404 for another merchant\'s conversation; 422 for >2000 chars / missing fields; 401 without a token', async () => {
    fakeAi([]);
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const other = await makeMerchant(db, { name: 'O' });
      const c = await makeConversation(db, other.id);
      const body = { conversation_id: c.id, raw_text: 'x', normalized_text: 'x' };
      expect((await http.post('/messages').set(authHeader(m.id)).send(body)).body).toEqual({ detail: 'conversation not found' });
      const long = await http.post('/messages').set(authHeader(m.id)).send({ ...body, raw_text: 'x'.repeat(2001) });
      expect(long.status).toBe(422);
      expect(long.body.detail[0].loc).toEqual(['body', 'raw_text']);
      expect((await http.post('/messages').set(authHeader(m.id)).send({})).status).toBe(422);
      expect((await http.post('/messages').send(body)).status).toBe(401);
    });
  });
});

