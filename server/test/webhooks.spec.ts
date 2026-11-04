import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import twilio from 'twilio';
import { describe, expect, it } from 'vitest';
import { makeConnection, makeMerchant, queued, schema, withApp } from './harness.js';

const sign = (body: string) => 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET!).update(body).digest('hex');
const metaBody = (o: { page: string; mid: string; text?: string; user?: string; object?: string }) =>
  JSON.stringify({
    object: o.object ?? 'page',
    entry: [{ id: o.page, messaging: [{ sender: { id: o.user ?? 'U1' }, message: { mid: o.mid, text: o.text ?? 'مرحبا' } }] }],
  });

describe('GET /webhooks/meta', () => {
  it('echoes the challenge for the right token, 403 otherwise', async () => {
    await withApp(async ({ http }) => {
      const ok = await http.get('/webhooks/meta').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '12345' });
      expect(ok.status).toBe(200);
      expect(ok.text).toBe('12345');
      expect(ok.headers['content-type']).toMatch(/text\/plain/);
      const bad = await http.get('/webhooks/meta').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' });
      expect(bad.status).toBe(403);
      expect(bad.body).toEqual({ detail: 'verification failed' });
      expect((await http.get('/webhooks/meta')).status).toBe(403);
    });
  });
});

describe('POST /webhooks/meta', () => {
  it('rejects bad / missing signatures', async () => {
    await withApp(async ({ http }) => {
      const body = metaBody({ page: 'P', mid: 'm' });
      expect((await http.post('/webhooks/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', 'sha256=00').send(body)).status).toBe(403);
      expect((await http.post('/webhooks/meta').set('Content-Type', 'application/json').send(body)).body).toEqual({ detail: 'invalid signature' });
      expect(queued).toHaveLength(0);
    });
  });

  it('creates conversation + message, enqueues once per delivery, dedupes the stored message', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const conn = await makeConnection(db, m.id, { externalAccountId: 'PAGE-1' });
      const body = metaBody({ page: 'PAGE-1', mid: 'mid-1', text: 'عايز قميص' });
      const post = () => http.post('/webhooks/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);

      const res = await post();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'received' });
      const msgs = await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, 'mid-1'));
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({ direction: 'INBOUND', rawText: 'عايز قميص', intent: null });
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.channelConnectionId, conn.id));
      expect(conv).toMatchObject({ customerRef: 'U1', state: 'NEW', merchantId: m.id });
      expect(queued).toEqual([{ name: 'process_channel_message', data: { messageId: msgs[0].id }, opts: expect.objectContaining({ jobId: msgs[0].id, attempts: 1 }) }]);
      expect(await db.select().from(schema.webhookEvents)).toHaveLength(1);

      // Meta redelivers: still one stored message; the enqueue repeats but with the same jobId, which BullMQ drops
      await post();
      expect(await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, 'mid-1'))).toHaveLength(1);
      expect(queued).toHaveLength(2);
      expect(queued[1].opts.jobId).toBe(queued[0].opts.jobId);
    });
  });

  it('a second customer on the same page gets their own conversation; unmapped pages are dropped', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      await makeConnection(db, m.id, { externalAccountId: 'PAGE-2' });
      const send = (b: string) => http.post('/webhooks/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(b)).send(b);
      await send(metaBody({ page: 'PAGE-2', mid: 'a', user: 'U1' }));
      await send(metaBody({ page: 'PAGE-2', mid: 'b', user: 'U2' }));
      await send(metaBody({ page: 'UNKNOWN', mid: 'c' }));
      expect(await db.select().from(schema.conversations)).toHaveLength(2);
      expect(queued).toHaveLength(2);
    });
  });

  it('instagram payloads are tagged INSTAGRAM; unparseable bodies still ack 200 and are recorded', async () => {
    await withApp(async ({ http, db }) => {
      const ig = metaBody({ page: 'IG', mid: 'x', object: 'instagram' });
      await http.post('/webhooks/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(ig)).send(ig);
      const garbage = '{not json';
      const res = await http.post('/webhooks/meta').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(garbage)).send(garbage);
      expect(res.status).toBe(200);
      const events = await db.select().from(schema.webhookEvents);
      expect(events.map((e) => e.channel).sort()).toEqual(['FACEBOOK', 'INSTAGRAM']);
      expect(events.find((e) => e.processingError)).toBeTruthy();
    });
  });
});

describe('POST /webhooks/whatsapp/twilio', () => {
  const params = { Body: 'مرحبا', From: 'whatsapp:+201000000000', To: 'whatsapp:+14155238886', MessageSid: 'SM123' };
  const signed = () => twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN!, process.env.TWILIO_WEBHOOK_URL!, params);

  it('rejects an invalid signature', async () => {
    await withApp(async ({ http }) => {
      const res = await http.post('/webhooks/whatsapp/twilio').set('X-Twilio-Signature', 'bad').type('form').send(params);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ detail: 'invalid signature' });
    });
  });

  it('creates a message and enqueues a job', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      await makeConnection(db, m.id, { channel: 'WHATSAPP', externalAccountId: params.To });
      const res = await http.post('/webhooks/whatsapp/twilio').set('X-Twilio-Signature', signed()).type('form').send(params);
      expect(res.status).toBe(200);
      const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, 'SM123'));
      expect(msg.rawText).toBe('مرحبا');
      expect(queued).toEqual([{ name: 'process_channel_message', data: { messageId: msg.id }, opts: expect.objectContaining({ jobId: msg.id }) }]);
    });
  });
});
