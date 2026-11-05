import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runClustering, representativeMessages } from '../src/clustering/job.js';
import { withConversationLock } from '../src/core/locks.js';
import { buildButtonsFixture } from './fixtures.js';
import { deliver, zernioBody } from '../src/domains/messaging/deliver.js';
import { buttonMessage, genericTemplateMessage, mediaMessage, quickReplyMessage, textFallback, textMessage } from '../src/domains/messaging/models.js';
import { renderFacebook } from '../src/domains/messaging/renderer.js';
import { http as senderHttp, sendFacebookMessages } from '../src/domains/messaging/sender.js';
import { ExtractionBase, ProposedAction, jsonSchemaResponseFormat, IntentClassification } from '../src/engine/schemas.js';
import { ACTION_TASK_BLOCK, buildSystemPrompt, classificationTaskBlock } from '../src/engine/prompts.js';
import { matchVariantHint } from '../src/engine/product-matching.js';
import { processChannelMessage } from '../src/worker/processor.js';
import { authHeader, fakeAi, makeConnection, makeConversation, makeMerchant, resetAi, schema, unit, withApp, withRollback } from './harness.js';
import { getSettings } from '../src/config.js';
import { createMerchantApiKey } from '../src/domains/auth/tokens.js';
import { z } from 'zod';

afterEach(() => {
  resetAi();
  vi.restoreAllMocks();
});

describe('prompts', () => {
  it('includes merchant, dialect guidance, state gloss; empty slots say so; non-empty slots keep Arabic unescaped', () => {
    const base = { taskBlock: 'TASK', merchantName: 'متجر النور', convState: 'GATHERING' as const };
    const p = buildSystemPrompt({ ...base, slots: {} });
    expect(p).toContain("متجر النور's");
    expect(p).toContain('Arabizi');
    expect(p).toContain('GATHERING (customer is actively providing order details)');
    expect(p).toContain('(nothing gathered yet)');
    expect(p.endsWith('TASK')).toBe(true);
    expect(buildSystemPrompt({ ...base, slots: { name: 'أحمد' } })).toContain('{"name": "أحمد"}');
  });

  it('does not re-interpret braces inside the task block, and keeps the generation block\'s literal placeholder', () => {
    const p = buildSystemPrompt({ taskBlock: '{merchant_name} {"reply": "..."}', merchantName: 'X', convState: 'NEW', slots: {} });
    expect(p.endsWith('{merchant_name} {"reply": "..."}')).toBe(true);
    expect(classificationTaskBlock(['a', 'b'])).toContain('Known intents so far: a, b.');
    for (const n of ['search_products', 'get_delivery_info', 'create_order']) expect(ACTION_TASK_BLOCK).toContain(n);
  });
});

describe('structured-output JSON schemas', () => {
  it('every response schema converts to a JSON schema the provider can take', () => {
    for (const [name, schema] of [
      ['intent', IntentClassification],
      ['extraction', ExtractionBase],
      ['action', ProposedAction],
    ] as const) {
      const f = jsonSchemaResponseFormat(schema as z.ZodType, name);
      expect(f.type).toBe('json_schema');
      expect(JSON.stringify(f.json_schema.schema).length).toBeGreaterThan(20);
    }
    const action = jsonSchemaResponseFormat(ProposedAction, 'a').json_schema.schema as any;
    expect((action.oneOf ?? action.anyOf)).toHaveLength(10);
    const extraction = jsonSchemaResponseFormat(ExtractionBase, 'e').json_schema.schema as any;
    expect(extraction.properties.payment_method.description).toContain('InstaPay');
  });
});

describe('variant hint matching', () => {
  const c = [
    { id: 'a', label: 'Small', attributes: { size: 'S', color: 'Red' } },
    { id: 'b', label: 'Large', attributes: { size: 'L', color: 'Blue' } },
  ];
  it('matches label first (case-insensitive), then attribute values; never throws', () => {
    expect(matchVariantHint('LARGE', c)).toBe('b');
    expect(matchVariantHint('blue', c)).toBe('b');
    expect(matchVariantHint('red', c)).toBe('a');
    expect(matchVariantHint('s', c)).toBe('a'); // substring of "Small" wins before attributes
    expect(matchVariantHint('green', c)).toBeNull();
    expect(matchVariantHint('', c)).toBeNull();
    expect(matchVariantHint(null, c)).toBeNull();
    expect(matchVariantHint('x', [])).toBeNull();
  });
});

describe('facebook renderer / sender', () => {
  it('renders each message kind to Send API JSON and falls back to readable text', () => {
    const { quick, buttons, cards, media, receipt } = buildButtonsFixture();
    expect(renderFacebook(quick)).toEqual({
      text: 'اختار',
      quick_replies: [{ content_type: 'text', title: 'السلة', payload: '{"action":"view_cart"}' }],
    });
    expect(renderFacebook(buttons)).toEqual({
      attachment: { type: 'template', payload: { template_type: 'button', text: 'ابدأ', buttons: [{ type: 'postback', title: 'نعم', payload: '{"a":1}' }, { type: 'web_url', title: 'موقعنا', url: 'https://x.test' }] } },
    });
    expect(renderFacebook(cards)).toMatchObject({ attachment: { payload: { template_type: 'generic', elements: [{ title: 'قميص', subtitle: 'جميل', image_url: 'https://i.test/1.png' }, { title: 'بنطلون' }] } } });
    expect((renderFacebook(cards) as any).attachment.payload.elements[1]).toEqual({ title: 'بنطلون' });
    expect(renderFacebook(media)).toEqual({ attachment: { type: 'image', payload: { url: 'https://i.test/1.png', is_reusable: true } } });
    expect((renderFacebook(receipt) as any).attachment.payload).toMatchObject({ template_type: 'receipt', order_number: '7', summary: { total_cost: 120 }, address: { street_1: 'Cairo', country: 'EG' } });
    expect(textFallback(quick)).toBe('اختار\n[السلة]');
    expect(textFallback(buttons)).toBe('ابدأ\n[نعم | موقعنا]');
    expect(textFallback(cards)).toBe('[2 cards: قميص, بنطلون]');
    expect(textFallback(media)).toBe('[image: https://i.test/1.png]');
    expect(textFallback(receipt)).toBe('إيصال الطلب #7 — 120.0 EGP');
  });

  it('one boolean per message; failures are logged not thrown', async () => {
    const responses = [new Response('{}', { status: 200 }), new Response('bad', { status: 400 })];
    const spy = vi.spyOn(senderHttp, 'fetch').mockImplementation(async () => responses.shift()!);
    const { quick } = buildButtonsFixture();
    const out = await sendFacebookMessages('tok', 'U1', [{ kind: 'text', text: 'a' }, quick, { kind: 'text', text: 'c' }]);
    expect(out.slice(0, 2)).toEqual([true, false]);
    expect(spy).toHaveBeenCalled();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v26.0/me/messages?access_token=tok');
    expect(JSON.parse(init.body as string)).toEqual({ recipient: { id: 'U1' }, message: { text: 'a' }, messaging_type: 'RESPONSE' });
  });

  it('a network error is a false, not an exception', async () => {
    vi.spyOn(senderHttp, 'fetch').mockRejectedValue(new TypeError('network down'));
    expect(await sendFacebookMessages('t', 'U', [{ kind: 'text', text: 'a' }])).toEqual([false]);
  });
});

describe('conversation lock (real Redis, same key/protocol as the Python worker)', () => {
  it('excludes concurrent holders and releases on exception', async () => {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/0');
    try {
      const order: string[] = [];
      const hold = (name: string, ms: number) =>
        withConversationLock(redis, 'ts-lock-test', async () => {
          order.push(`${name}-start`);
          await new Promise((r) => setTimeout(r, ms));
          order.push(`${name}-end`);
        });
      await Promise.all([hold('a', 60), hold('b', 0)]);
      expect([['a-start', 'a-end', 'b-start', 'b-end'], ['b-start', 'b-end', 'a-start', 'a-end']]).toContainEqual(order);

      await expect(withConversationLock(redis, 'ts-lock-test-2', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
      await withConversationLock(redis, 'ts-lock-test-2', async () => undefined); // would hang if the lock leaked
      expect(await redis.get('conversation:ts-lock-test-2:lock')).toBeNull();
    } finally {
      redis.disconnect();
    }
  });
});

describe('worker: processChannelMessage', () => {
  const withRedis = async (fn: (r: Redis) => Promise<void>) => {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/0');
    try { await fn(redis); } finally { redis.disconnect(); }
  };

  it('classifies a tier-0 message, sends + stores the reply, and is idempotent on redelivery', async () => {
    fakeAi([{ reply: 'أهلاً بيك' }]);
    const sent: any[] = [];
    vi.spyOn(senderHttp, 'fetch').mockImplementation(async (_u, init) => {
      sent.push(JSON.parse((init as RequestInit).body as string));
      return new Response('{}', { status: 200 });
    });
    await withRedis((redis) =>
      withRollback(async (db) => {
        const m = await makeMerchant(db, { name: 'متجر' });
        const conn = await makeConnection(db, m.id, { pageAccessToken: 'tok' });
        const conv = await makeConversation(db, m.id, { channelConnectionId: conn.id, customerRef: 'U9', state: 'NEW' });
        const [inbound] = await db.insert(schema.messages).values({ conversationId: conv.id, direction: 'INBOUND', rawText: 'hi', normalizedText: 'hi' }).returning();

        await processChannelMessage(db, redis, inbound.id);
        const [after] = await db.select().from(schema.messages).where(eq(schema.messages.id, inbound.id));
        expect(after).toMatchObject({ intent: 'greeting', modelTier: 'RULE' });
        expect(sent.map((s) => s.recipient.id)).toEqual(['U9']);
        expect(sent[0].message).toEqual({ text: 'أهلاً بيك' });
        const outbound = await db.select().from(schema.messages).where(eq(schema.messages.direction, 'OUTBOUND'));
        expect(outbound.map((o) => o.messageType)).toEqual(['text']);

        await processChannelMessage(db, redis, inbound.id); // redelivery: nothing new is sent
        expect(sent).toHaveLength(1);
        await processChannelMessage(db, redis, 'does-not-exist'); // no-op
      }),
    );
  });

  it('replies through Zernio for connections without a page token (customerRef is the Zernio conversation id)', async () => {
    fakeAi([{ reply: 'أهلاً بيك' }]);
    const calls: { path: string; body: any }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: any) => (calls.push({ path: new URL(url).pathname, body: JSON.parse(init.body) }), new Response('{}', { status: 200 })));
    try {
      await withRedis((redis) =>
        withRollback(async (db) => {
          const m = await makeMerchant(db);
          const conn = await makeConnection(db, m.id, { externalAccountId: 'ACC1' });
          const conv = await makeConversation(db, m.id, { channelConnectionId: conn.id, customerRef: 'zconv-1', state: 'NEW' });
          const [inbound] = await db.insert(schema.messages).values({ conversationId: conv.id, direction: 'INBOUND', rawText: 'hi', normalizedText: 'hi' }).returning();
          await processChannelMessage(db, redis, inbound.id);
          expect(calls.map((c) => c.path)).toEqual(['/api/v1/inbox/conversations/zconv-1/messages']);
          expect(calls[0].body).toEqual({ accountId: 'ACC1', message: 'أهلاً بيك' });
          expect(await db.select().from(schema.messages).where(eq(schema.messages.direction, 'OUTBOUND'))).toHaveLength(1);
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a reaction gets no reply but still records the intent', async () => {
    fakeAi([{ reply: 'x' }]);
    const spy = vi.spyOn(senderHttp, 'fetch');
    await withRedis((redis) =>
      withRollback(async (db) => {
        const m = await makeMerchant(db);
        const conn = await makeConnection(db, m.id);
        const conv = await makeConversation(db, m.id, { channelConnectionId: conn.id });
        const [inbound] = await db.insert(schema.messages).values({ conversationId: conv.id, direction: 'INBOUND', rawText: '👍', normalizedText: '👍' }).returning();
        await processChannelMessage(db, redis, inbound.id);
        expect(spy).not.toHaveBeenCalled();
        const [after] = await db.select().from(schema.messages).where(eq(schema.messages.id, inbound.id));
        expect(after.intent).toBe('reaction');
      }),
    );
  });
});

describe('auto-learning clustering job', () => {
  const near = (i: number, jitter: number) => {
    const v = unit(0);
    v[1 + i] = jitter;
    return v;
  };

  it('labels a tight cluster, scopes to opted-in merchants, and never re-processes clustered messages', async () => {
    fakeAi([]);
    const labels = vi.fn();
    const gw = await import('../src/engine/gateway.js');
    vi.spyOn(gw, 'completeJson').mockImplementation(async (_p, a) => {
      labels(a.userPrompt);
      return { intent: 'ask_price', summary: 's' };
    });
    await withRollback(async (db) => {
      const optedIn = await makeMerchant(db, { autoLearningEnabled: true });
      const optedOut = await makeMerchant(db, { name: 'no', autoLearningEnabled: false });
      const c1 = await makeConversation(db, optedIn.id);
      const c2 = await makeConversation(db, optedOut.id);
      const mk = (c: string, text: string, e: number[]) => ({ conversationId: c, direction: 'INBOUND' as const, rawText: text, normalizedText: text, embedding: e });
      await db.insert(schema.messages).values([
        mk(c1.id, 'بكام ده', near(0, 0.01)), mk(c1.id, 'السعر كام', near(1, 0.01)), mk(c1.id, 'ده بكام', near(2, 0.01)),
        mk(c1.id, 'مختلف تماما', unit(500)),
        mk(c2.id, 'بكام ده', near(0, 0.01)), mk(c2.id, 'السعر كام', near(1, 0.01)), mk(c2.id, 'ده بكام', near(2, 0.01)),
      ]);

      expect(await runClustering(db)).toBe(3);
      const examples = await db.select().from(schema.labeledExamples);
      expect(examples).toHaveLength(3);
      expect(examples.every((e) => e.merchantId === optedIn.id && e.intent === 'ask_price' && e.source === 'cluster_labeling')).toBe(true);
      expect(labels).toHaveBeenCalledTimes(1);

      expect(await runClustering(db)).toBe(0); // clustered_at set => not re-fetched, no duplicate examples
      expect(await db.select().from(schema.labeledExamples)).toHaveLength(3);
    });
  });

  it('falls back to unknown_intent_<n> when labeling fails; too-small groups are skipped', async () => {
    const gw = await import('../src/engine/gateway.js');
    vi.spyOn(gw, 'completeJson').mockRejectedValue(new Error('llm down'));
    await withRollback(async (db) => {
      const m = await makeMerchant(db, { autoLearningEnabled: true });
      const c = await makeConversation(db, m.id);
      await db.insert(schema.messages).values([0, 1, 2].map((i) => ({ conversationId: c.id, direction: 'INBOUND' as const, normalizedText: `m${i}`, embedding: near(i, 0.01) })));
      await runClustering(db);
      const [ex] = await db.select().from(schema.labeledExamples);
      expect(ex.intent).toMatch(/^unknown_intent_\d+$/);
    });
  });

  it('representatives are the members closest to the centroid', () => {
    const mk = (id: string, v: number[]) => ({ id, embedding: v });
    const reps = representativeMessages([mk('far', [0, 1]), mk('a', [1, 0.1]), mk('b', [1, 0]), mk('c', [1, 0.05])], 2);
    expect(reps.map((r) => r.id)).toEqual(expect.arrayContaining(['c']));
    expect(reps).toHaveLength(2);
  });
});

describe('merchant API key login', () => {
  const login = (http: any, key: string) => http.post('/auth/key-login').send({ api_key: key });

  it('a merchant key signs in that merchant, and the token works', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db, { name: 'Store A' });
      const res = await login(http, createMerchantApiKey(getSettings(), m.id));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ merchant_id: m.id, merchant_name: 'Store A' });
      const me = await http.get('/auth/me').set('Authorization', `Bearer ${res.body.access_token}`);
      expect(me.body).toMatchObject({ merchant_id: m.id, merchant_name: 'Store A' });
      expect((await login(http, `  ${createMerchantApiKey(getSettings(), m.id)}\n`)).status).toBe(200); // pasted whitespace
    });
  });

  it('every bad key gets the same 401: tampered, another merchant\'s signature, malformed, unknown merchant, suspended', async () => {
    await withApp(async ({ http, db }) => {
      const a = await makeMerchant(db, { name: 'A' });
      const b = await makeMerchant(db, { name: 'B' });
      const suspended = await makeMerchant(db, { name: 'S', status: 'SUSPENDED' });
      const keyA = createMerchantApiKey(getSettings(), a.id);
      const sigA = keyA.split('.')[1];
      const bad = [`${keyA}x`, `tk_${b.id}.${sigA}`, 'garbage', '', 'tk_.', createMerchantApiKey(getSettings(), 'no-such-merchant'), createMerchantApiKey(getSettings(), suspended.id)];
      for (const key of bad) {
        const res = await login(http, key);
        expect([res.status, res.body]).toEqual([401, { detail: 'invalid api key' }]);
      }
      expect((await http.post('/auth/key-login').send({})).status).toBeGreaterThanOrEqual(400);
    });
  });
});

describe('deliver: one send path per connection type', () => {
  const zernioCalls = (status = 200) => {
    const calls: { url: URL; auth?: string; body: any }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: any) => {
      calls.push({ url: new URL(url), auth: init.headers.authorization, body: JSON.parse(init.body) });
      return new Response('{}', { status });
    });
    return calls;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('connections without a page token go through Zernio, addressed by account + conversation id', async () => {
    const calls = zernioCalls();
    const conn = { channel: 'FACEBOOK', externalAccountId: 'ACC1', pageAccessToken: null };
    const out = await deliver(conn, 'conv-9', [textMessage('hi'), quickReplyMessage('pick', [{ title: 'Menu', payload: { action: 'main_menu' } }])]);
    expect(out).toEqual([true, true]);
    expect(calls.map((c) => c.url.pathname)).toEqual(Array(2).fill('/api/v1/inbox/conversations/conv-9/messages'));
    expect(calls[0].auth).toBe('Bearer zernio-key-for-tests');
    expect(calls[0].body).toEqual({ accountId: 'ACC1', message: 'hi' });
    expect(calls[1].body).toEqual({ accountId: 'ACC1', message: 'pick', quickReplies: [{ title: 'Menu', payload: '{"action":"main_menu"}' }] });
  });

  it('a failed Zernio send is reported false, not thrown', async () => {
    zernioCalls(500);
    expect(await deliver({ channel: 'INSTAGRAM', externalAccountId: 'A', pageAccessToken: null }, 'c', [textMessage('x')])).toEqual([false]);
  });

  it('legacy token-bearing Facebook connections keep the Graph path; channels with no path send nothing', async () => {
    const calls = zernioCalls();
    const graph = vi.spyOn(senderHttp, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await deliver({ channel: 'FACEBOOK', externalAccountId: 'PG', pageAccessToken: 'tok' }, 'psid', [textMessage('hi')])).toEqual([true]);
    expect(graph).toHaveBeenCalledOnce();
    expect(await deliver({ channel: 'WHATSAPP', externalAccountId: '+20', pageAccessToken: null }, 'x', [textMessage('hi')])).toEqual([false]);
    expect(calls).toHaveLength(0);
  });

  it('maps buttons to quick replies, cards to a text list, media to an attachment', () => {
    const b = buttonMessage('detail', [{ type: 'postback', title: 'Add', payload: { a: 1 } }, { type: 'web_url', title: 'Site', url: 'https://x.test' }]);
    expect(zernioBody('A', b)).toEqual({ accountId: 'A', message: 'detail\nSite: https://x.test', quickReplies: [{ title: 'Add', payload: '{"a":1}' }] });
    expect(zernioBody('A', genericTemplateMessage([{ title: 'Shirt', subtitle: '100 EGP' }, { title: 'Hat' }]))).toEqual({ accountId: 'A', message: 'Shirt — 100 EGP\nHat' });
    expect(zernioBody('A', mediaMessage('https://x.test/a.png'))).toEqual({ accountId: 'A', attachmentUrl: 'https://x.test/a.png', attachmentType: 'image' });
  });
});
