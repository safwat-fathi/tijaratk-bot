import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { authHeader, fakeAi, makeConnection, makeConversation, makeMerchant, makeProduct, resetAi, schema, unit, withApp } from './harness.js';

afterEach(resetAi);

describe('auth', () => {
  it('rejects missing, malformed, expired tokens and unknown/suspended merchants', async () => {
    await withApp(async ({ http, db }) => {
      expect((await http.get('/products')).body).toEqual({ detail: 'not authenticated' });
      const bad = await http.get('/products').set('Authorization', 'Bearer nope');
      expect(bad.status).toBe(401);
      expect(bad.body).toEqual({ detail: 'invalid or expired token' });
      const ghost = await http.get('/products').set(authHeader('missing-merchant'));
      expect(ghost.body).toEqual({ detail: 'merchant not found' });
      const m = await makeMerchant(db, { status: 'SUSPENDED' });
      const suspended = await http.get('/products').set(authHeader(m.id));
      expect(suspended.status).toBe(403);
      expect(suspended.body).toEqual({ detail: 'merchant suspended' });
    });
  });

  it('/auth/me lists active connections only', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db, { name: 'Shop' });
      await makeConnection(db, m.id, { accountName: 'Live Page' });
      await makeConnection(db, m.id, { accountName: 'Dead Page', isActive: false });
      const res = await http.get('/auth/me').set(authHeader(m.id));
      expect(res.body).toEqual({ merchant_id: m.id, merchant_name: 'Shop', is_active: true, channels: [{ channel: 'FACEBOOK', account_name: 'Live Page' }] });
    });
  });

  it('encrypts page_access_token at rest and decrypts on read', async () => {
    await withApp(async ({ db }) => {
      const m = await makeMerchant(db);
      const conn = await makeConnection(db, m.id, { pageAccessToken: 'EAAB-secret' });
      expect(conn.pageAccessToken).toBe('EAAB-secret');
      const raw = await db.execute<{ t: string }>(`select page_access_token as t from channel_connections where id = '${conn.id}'` as any);
      expect(raw.rows[0].t).not.toBe('EAAB-secret');
      expect(raw.rows[0].t.startsWith('gAAAA')).toBe(true);
    });
  });
});

describe('products', () => {
  it('CRUD with variants, embeddings and merchant scoping', async () => {
    fakeAi([], unit(3));
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const other = await makeMerchant(db, { name: 'Other' });
      const h = authHeader(m.id);

      const created = await http
        .post('/products')
        .set(h)
        .send({ name: 'قميص', aliases: ['shirt'], price: 150.5, category: 'ملابس', variants: [{ label: 'XL', price: 160, stock: 3, attributes: { size: 'XL' } }] });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'قميص', aliases: ['shirt'], price: 150.5, category: 'ملابس', description: null, image_url: null });
      expect(created.body.variants).toEqual([{ id: expect.any(String), product_id: created.body.id, label: 'XL', sku: null, price: 160, stock: 3, status: 'ACTIVE', attributes: { size: 'XL' } }]);
      const [row] = await db.select().from(schema.products).where(eq(schema.products.id, created.body.id));
      expect(row.embedding).toHaveLength(1024);

      const list = await http.get('/products').set(h);
      expect(list.body.map((p: any) => p.id)).toEqual([created.body.id]);
      expect((await http.get('/products').set(authHeader(other.id))).body).toEqual([]);

      const updated = await http.put(`/products/${created.body.id}`).set(h).send({ name: 'قميص قطن', price: 99 });
      expect(updated.body).toMatchObject({ name: 'قميص قطن', price: 99, aliases: ['shirt'] });

      expect((await http.put(`/products/${created.body.id}`).set(authHeader(other.id)).send({ name: 'x' })).status).toBe(404);
      expect((await http.delete(`/products/${created.body.id}`).set(authHeader(other.id))).body).toEqual({ detail: 'product not found' });
      expect((await http.delete(`/products/${created.body.id}`).set(h)).status).toBe(204);
      expect((await http.get('/products').set(h)).body).toEqual([]);
    });
  });

  it('image upload: stored, served publicly, scoped to the merchant, clearable', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const other = await makeMerchant(db, { name: 'Other' });
      const p = await makeProduct(db, m.id);
      const png = Buffer.from('89504e470d0a1a0a00', 'hex');
      const put = (h: Record<string, string>, type: string, body: Buffer) => http.put(`/products/${p.id}/image`).set(h).set('Content-Type', type).send(body);

      const up = await put(authHeader(m.id), 'image/png', png);
      expect(up.status).toBe(200);
      expect(up.body.image_url).toMatch(new RegExp(`^https://api\\.example\\.test/product-images/${p.id}\\?v=\\d+$`));

      const pub = await http.get(`/product-images/${p.id}`).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); });
      expect(pub.status).toBe(200);
      expect(pub.headers['content-type']).toBe('image/png');
      expect(pub.body.equals(png)).toBe(true);

      expect((await put(authHeader(other.id), 'image/png', png)).status).toBe(404);
      expect((await put(authHeader(m.id), 'image/gif', png)).status).toBe(415);
      expect((await http.delete(`/products/${p.id}/image`).set(authHeader(other.id))).status).toBe(404);

      expect((await http.delete(`/products/${p.id}/image`).set(authHeader(m.id))).body.image_url).toBeNull();
      expect((await http.get(`/product-images/${p.id}`)).status).toBe(404);
    });
  });

  it('422 in FastAPI shape on invalid body', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const res = await http.post('/products').set(authHeader(m.id)).send({ price: 'abc' });
      expect(res.status).toBe(422);
      expect(res.body.detail[0]).toMatchObject({ loc: ['body', 'name'] });
    });
  });
});

describe('store knowledge', () => {
  it('CRUD + 404s', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const h = authHeader(m.id);
      const c = await http.post('/store-knowledge').set(h).send({ knowledge_type: 'shipping', title: 'الشحن', content: 'بنشحن لكل مصر', keywords: ['شحن'] });
      expect(c.status).toBe(201);
      expect(c.body).toMatchObject({ merchant_id: m.id, keywords: ['شحن'], created_at: expect.stringMatching(/Z$/) });
      const u = await http.put(`/store-knowledge/${c.body.id}`).set(h).send({ title: 'الشحن 2' });
      expect(u.body.title).toBe('الشحن 2');
      expect((await http.get('/store-knowledge').set(h)).body).toHaveLength(1);
      expect((await http.put('/store-knowledge/nope').set(h).send({})).body).toEqual({ detail: 'knowledge entry not found' });
      expect((await http.delete(`/store-knowledge/${c.body.id}`).set(h)).status).toBe(204);
      expect((await http.delete(`/store-knowledge/${c.body.id}`).set(h)).status).toBe(404);
    });
  });
});

describe('delivery areas', () => {
  it('persists (unlike the Python router), quantizes the fee, scopes by merchant', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const other = await makeMerchant(db, { name: 'Other' });
      const h = authHeader(m.id);
      const created = await http.post('/delivery-areas').set(h).send({ area: 'Maadi', delivery_fee: 25 });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ area: 'Maadi', delivery_fee: '25.00', estimated_delivery: null, status: 'ACTIVE' });
      expect(await db.select().from(schema.deliveryAreas)).toHaveLength(1);

      const patched = await http.patch(`/delivery-areas/${created.body.id}`).set(h).send({ delivery_fee: 40 });
      expect(patched.body.delivery_fee).toBe('40.00');
      expect((await http.patch(`/delivery-areas/${created.body.id}`).set(authHeader(other.id)).send({ delivery_fee: 1 })).status).toBe(404);
      expect((await http.delete(`/delivery-areas/${created.body.id}`).set(authHeader(other.id))).status).toBe(404);
      expect((await http.delete(`/delivery-areas/${created.body.id}`).set(h)).status).toBe(204);
      expect((await http.get('/delivery-areas').set(h)).body).toEqual([]);
    });
  });
});

describe('labeled examples', () => {
  it('validates intent format, embeds on create (fail-open), lists intents', async () => {
    fakeAi([], unit(1));
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const h = authHeader(m.id);
      expect((await http.get('/labeled-examples/intents').set(h)).body).toContain('purchase_intent');
      const bad = await http.post('/labeled-examples').set(h).send({ normalized_text: 'x', intent: 'Bad Intent' });
      expect(bad.status).toBe(422);
      const ok = await http.post('/labeled-examples').set(h).send({ normalized_text: 'عايز قميص', intent: 'purchase_intent', extraction: { a: 1 } });
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ merchant_id: m.id, source: 'merchant', extraction: { a: 1 } });
      const upd = await http.put(`/labeled-examples/${ok.body.id}`).set(h).send({ intent: 'question' });
      expect(upd.body.intent).toBe('question');
      expect((await http.delete(`/labeled-examples/${ok.body.id}`).set(h)).status).toBe(204);
    });
  });

  it('saves even when the embedding call fails', async () => {
    const { AICallError } = await import('../src/engine/clients.js');
    const ai = fakeAi([]);
    void ai;
    const { setAiClientsForTests } = await import('../src/engine/clients.js');
    setAiClientsForTests({
      embedding: { chat: null as any, embeddings: { create: async () => { throw new AICallError('down'); } } },
    });
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const res = await http.post('/labeled-examples').set(authHeader(m.id)).send({ normalized_text: 'x y', intent: 'other' });
      expect(res.status).toBe(201);
      const [row] = await db.select().from(schema.labeledExamples).where(eq(schema.labeledExamples.id, res.body.id));
      expect(row.embedding).toBeNull();
    });
  });
});

describe('merchant settings', () => {
  it('reads and partially updates', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const h = authHeader(m.id);
      expect((await http.get('/merchants/me/settings').set(h)).body).toMatchObject({ auto_learning_enabled: false });
      const res = await http.patch('/merchants/me/settings').set(h).send({ auto_learning_enabled: true });
      expect(res.body.auto_learning_enabled).toBe(true);
      expect(res.body.welcome_message).toContain('{store_name}');
      const res2 = await http.patch('/merchants/me/settings').set(h).send({ welcome_message: 'hello {store_name}' });
      expect(res2.body).toEqual({ auto_learning_enabled: true, welcome_message: 'hello {store_name}' });
    });
  });
});

describe('conversations & handoff', () => {
  it('lists, shows messages in order, and is merchant-scoped', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const other = await makeMerchant(db, { name: 'O' });
      const c = await makeConversation(db, m.id);
      await db.insert(schema.messages).values([
        { conversationId: c.id, direction: 'INBOUND', rawText: 'one', createdAt: new Date('2025-01-01T10:00:00Z') },
        { conversationId: c.id, direction: 'OUTBOUND', rawText: 'two', createdAt: new Date('2025-01-01T10:01:00Z') },
      ]);
      const list = await http.get('/conversations').set(authHeader(m.id));
      expect(list.body[0]).toMatchObject({ id: c.id, state: 'GATHERING', ai_enabled: true, human_takeover: false, slots: {} });
      const msgs = await http.get(`/conversations/${c.id}/messages`).set(authHeader(m.id));
      expect(msgs.body.map((x: any) => x.raw_text)).toEqual(['one', 'two']);
      expect(msgs.body[0].created_at).toBe('2025-01-01T10:00:00.000Z');
      expect((await http.get(`/conversations/${c.id}/messages`).set(authHeader(other.id))).status).toBe(404);
    });
  });

  it('merchant reply is persisted; not sent without a connected page', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const c = await makeConversation(db, m.id);
      const res = await http.post(`/conversations/${c.id}/reply`).set(authHeader(m.id)).send({ text: 'أهلاً' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ message_id: expect.any(String), sent: false });
      const [row] = await db.select().from(schema.messages).where(eq(schema.messages.id, res.body.message_id));
      expect(row).toMatchObject({ direction: 'OUTBOUND', rawText: 'أهلاً', messageType: 'text', richPayload: { kind: 'text', text: 'أهلاً' } });
    });
  });

  it('takeover creates a handoff, return-to-ai resolves it', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const c = await makeConversation(db, m.id);
      const h = authHeader(m.id);
      expect((await http.post(`/conversations/${c.id}/takeover`).set(h).send({})).status).toBe(204);
      let [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(conv.humanTakeover).toBe(true);
      const [handoff] = await db.select().from(schema.humanHandoffs);
      expect(handoff).toMatchObject({ reason: 'MERCHANT_TAKEOVER', resolvedAt: null });
      expect((await http.post(`/conversations/${c.id}/return-to-ai`).set(h).send({ notes: 'done' })).status).toBe(204);
      [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.id));
      expect(conv.humanTakeover).toBe(false);
      const [resolved] = await db.select().from(schema.humanHandoffs);
      expect(resolved.resolvedAt).not.toBeNull();
      expect(resolved.notes).toBe('done');
      expect((await http.post('/conversations/nope/takeover').set(h).send({})).body).toEqual({ detail: 'Conversation not found' });
    });
  });
});

describe('orders', () => {
  it('manual order: numbering, snapshot prices, variants, scoping', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const c = await makeConversation(db, m.id);
      const p = await makeProduct(db, m.id, { price: '100.00' });
      const [v] = await db.insert(schema.productVariants).values({ productId: p.id, label: 'XL', price: '120.00' }).returning();
      const h = authHeader(m.id);

      const res = await http.post('/orders/manual').set(h).send({
        conversation_id: c.id,
        line_items: [{ product_id: p.id, quantity: 2 }, { product_id: p.id, variant_id: v.id, quantity: 1.5 }],
        customer_name: 'Ali',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ order_number: 1, status: 'CONFIRMED', subtotal: 380, total: 380 });
      const second = await http.post('/orders/manual').set(h).send({ conversation_id: c.id, line_items: [{ product_id: p.id }] });
      expect(second.body.order_number).toBe(2);

      const list = await http.get('/orders').set(h);
      expect(list.body).toHaveLength(2);
      const first = list.body.find((o: any) => o.order_number === 1);
      expect(first).toMatchObject({ customer_name: 'Ali', created_at: expect.any(String) });
      expect(first.items.map((i: any) => [i.name_snapshot, i.variant_snapshot, i.unit_price, i.quantity]).sort()).toEqual([
        ['قميص', null, 100, 2],
        ['قميص', 'XL', 120, 1.5],
      ]);

      expect((await http.post('/orders/manual').set(h).send({ conversation_id: 'nope', line_items: [{ product_id: p.id }] })).body).toEqual({ detail: 'conversation not found' });
      expect((await http.post('/orders/manual').set(h).send({ conversation_id: c.id, line_items: [{ product_id: 'zzz' }] })).body).toEqual({ detail: 'product not found: zzz' });
      expect((await http.post('/orders/manual').set(h).send({ conversation_id: c.id, line_items: [] })).status).toBe(422);
    });
  });

  it('status update validates and 404s across merchants', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const other = await makeMerchant(db, { name: 'O' });
      const c = await makeConversation(db, m.id);
      const p = await makeProduct(db, m.id);
      const h = authHeader(m.id);
      const o = await http.post('/orders/manual').set(h).send({ conversation_id: c.id, line_items: [{ product_id: p.id }] });
      const ok = await http.patch(`/orders/${o.body.id}/status`).set(h).send({ status: 'PREPARING' });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe('PREPARING');
      expect((await http.patch(`/orders/${o.body.id}/status`).set(h).send({ status: 'WAT' })).body).toEqual({ detail: 'invalid status' });
      expect((await http.patch(`/orders/${o.body.id}/status`).set(authHeader(other.id)).send({ status: 'COMPLETED' })).status).toBe(404);
    });
  });
});

describe('demo', () => {
  it('503 when unconfigured', async () => {
    await withApp(async ({ http }) => {
      const res = await http.get('/demo/products');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ detail: 'Demo merchant is not configured' });
    });
  });
});
