import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authHeader, makeConnection, makeConversation, makeMerchant, schema, withApp } from './harness.js';

describe('pages domain & stats API', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists active FB/IG pages, hides WhatsApp, separates disconnected pages, and enforces cross-merchant 404', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db, { name: 'Shop' });
      const other = await makeMerchant(db, { name: 'Other' });
      const fbPage = await makeConnection(db, m.id, {
        channel: 'FACEBOOK',
        accountName: 'Shop FB',
        createdAt: new Date('2026-11-01T10:00:00Z'),
      });
      const igPage = await makeConnection(db, m.id, {
        channel: 'INSTAGRAM',
        accountName: 'Shop IG',
        createdAt: new Date('2026-11-02T10:00:00Z'),
      });
      const deadPage = await makeConnection(db, m.id, { channel: 'FACEBOOK', accountName: 'Old FB', isActive: false });
      await makeConnection(db, m.id, { channel: 'WHATSAPP', accountName: 'WA' });
      const foreignPage = await makeConnection(db, other.id, { channel: 'FACEBOOK', accountName: 'Foreign' });

      const h = authHeader(m.id);
      const res = await http.get('/pages').set(h);
      expect(res.status).toBe(200);
      expect(res.body.pages.map((p: any) => p.id)).toEqual([fbPage.id, igPage.id]);
      expect(res.body.disconnected.map((p: any) => p.id)).toEqual([deadPage.id]);

      // Zero-traffic page has 7 daily entries with 0s
      expect(res.body.pages[0].summary).toEqual({
        conversations: 0,
        handled_by_ai: 0,
        handled_pct: 0,
        needed_you: 0,
        orders: 0,
        revenue: 0,
      });
      expect(res.body.pages[0].daily).toHaveLength(7);

      // Cross-merchant 404
      expect((await http.get(`/pages/${foreignPage.id}`).set(h)).status).toBe(404);
      expect((await http.patch(`/pages/${foreignPage.id}/ai`).set(h).send({ ai_enabled: false })).status).toBe(404);
      expect((await http.post(`/pages/${foreignPage.id}/disconnect`).set(h)).status).toBe(404);
    });
  });

  it('computes per-page stats, Cairo-midnight day buckets, previous-period deltas, and UTC monthly quota shares', async () => {
    // Fix clock to 2026-11-08 10:00:00Z (12:00:00 Cairo, UTC+2)
    const now = new Date('2026-11-08T10:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db, { name: 'Shop' });
      const pageA = await makeConnection(db, m.id, {
        channel: 'FACEBOOK',
        accountName: 'Shop FB',
        createdAt: new Date('2026-11-01T10:00:00Z'),
      });
      const pageB = await makeConnection(db, m.id, {
        channel: 'INSTAGRAM',
        accountName: 'Shop IG',
        createdAt: new Date('2026-11-02T10:00:00Z'),
      });

      // Cairo midnight for 2026-11-08 is 2026-11-07T22:00:00Z.
      // Message at 2026-11-07T22:15:00Z is 00:15 Cairo on 2026-11-08 (Today in Cairo, even though 2026-11-07 in UTC!)
      const cA1 = await makeConversation(db, m.id, { channelConnectionId: pageA.id });
      const [mA1] = await db
        .insert(schema.messages)
        .values({
          conversationId: cA1.id,
          direction: 'INBOUND',
          rawText: 'hi after cairo midnight',
          aiAnswered: true,
          createdAt: new Date('2026-11-07T22:15:00Z'),
        })
        .returning();

      // Order on cA1
      await db.insert(schema.orders).values({
        merchantId: m.id,
        conversationId: cA1.id,
        messageId: mA1.id,
        status: 'CONFIRMED',
        source: 'AI_EXTRACTION',
        extractedPayload: {},
        confidenceScore: 0.95,
        extractedByTier: 'DEEPSEEK',
        total: '450.00',
        subtotal: '450.00',
      });

      // Second conversation on pageA yesterday in Cairo (2026-11-07 15:00 Cairo = 13:00Z), escalated
      const cA2 = await makeConversation(db, m.id, { channelConnectionId: pageA.id });
      await db.insert(schema.messages).values({
        conversationId: cA2.id,
        direction: 'INBOUND',
        rawText: 'need human',
        aiAnswered: false,
        escalationReason: 'unanswerable',
        createdAt: new Date('2026-11-07T13:00:00Z'),
      });

      // Conversation on pageA last month (2026-10-31T23:30:00Z) -> outside UTC Nov month quota
      const cAOld = await makeConversation(db, m.id, { channelConnectionId: pageA.id });
      await db.insert(schema.messages).values({
        conversationId: cAOld.id,
        direction: 'INBOUND',
        rawText: 'october msg',
        aiAnswered: true,
        createdAt: new Date('2026-10-31T23:30:00Z'),
      });

      // Conversation on pageB this month (3 days ago)
      const cB1 = await makeConversation(db, m.id, { channelConnectionId: pageB.id });
      await db.insert(schema.messages).values({
        conversationId: cB1.id,
        direction: 'INBOUND',
        rawText: 'ig msg',
        aiAnswered: true,
        createdAt: new Date('2026-11-05T10:00:00Z'),
      });

      const h = authHeader(m.id);

      // 1. Range = today: cA1 (00:15 Cairo today) is in today, cA2 (yesterday Cairo) is in previous_summary
      const detailToday = await http.get(`/pages/${pageA.id}?range=today`).set(h);
      expect(detailToday.status).toBe(200);
      expect(detailToday.body.summary).toEqual({
        conversations: 1,
        handled_by_ai: 1,
        handled_pct: 100,
        needed_you: 0,
        orders: 1,
        revenue: 450,
      });
      expect(detailToday.body.previous_summary).toEqual({
        conversations: 1,
        handled_by_ai: 0,
        handled_pct: 0,
        needed_you: 1,
        orders: 0,
        revenue: 0,
      });
      expect(detailToday.body.daily).toEqual([{ date: '2026-11-08', conversations: 1, handled_by_ai: 1 }]);

      // 2. Range = 7d overview: pageA has 2 conversations (1 handled = 50%), pageB has 1 (1 handled = 100%)
      // Monthly quota: 2 used in Nov UTC (1 on pageA, 1 on pageB; Oct message excluded)
      const overview = await http.get('/pages?range=7d').set(h);
      expect(overview.status).toBe(200);
      expect(overview.body.usage).toEqual({
        used: 2,
        limit: 10,
        by_page: [
          { id: pageA.id, used: 1 },
          { id: pageB.id, used: 1 },
        ],
      });
      const pA = overview.body.pages.find((p: any) => p.id === pageA.id);
      const pB = overview.body.pages.find((p: any) => p.id === pageB.id);
      expect(pA.summary).toEqual({
        conversations: 2,
        handled_by_ai: 1,
        handled_pct: 50,
        needed_you: 1,
        orders: 1,
        revenue: 450,
      });
      expect(pB.summary).toEqual({
        conversations: 1,
        handled_by_ai: 1,
        handled_pct: 100,
        needed_you: 0,
        orders: 0,
        revenue: 0,
      });
    });
  });

  it('PATCH /pages/:id/ai and POST /pages/:id/disconnect update state and are idempotent', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const page = await makeConnection(db, m.id, { channel: 'FACEBOOK', accountName: 'Shop' });
      const h = authHeader(m.id);

      // Pause for 8 hours
      const paused = await http.patch(`/pages/${page.id}/ai`).set(h).send({ pause_hours: 8 });
      expect(paused.status).toBe(200);
      expect(paused.body.ai_state).toBe('paused');
      expect(paused.body.ai_paused_until).toBeTruthy();

      // Turn off + set instructions
      const off = await http
        .patch(`/pages/${page.id}/ai`)
        .set(h)
        .send({ ai_enabled: false, ai_instructions: 'صفحة مخصصة للجملة' });
      expect(off.body).toMatchObject({
        ai_enabled: false,
        ai_paused_until: null,
        ai_instructions: 'صفحة مخصصة للجملة',
        ai_state: 'off',
      });

      // Turn back on clears pause
      const on = await http.patch(`/pages/${page.id}/ai`).set(h).send({ ai_enabled: true });
      expect(on.body).toMatchObject({ ai_enabled: true, ai_paused_until: null, ai_state: 'on' });

      // Disconnect is idempotent
      const disc1 = await http.post(`/pages/${page.id}/disconnect`).set(h);
      expect(disc1.status).toBe(200);
      expect(disc1.body).toMatchObject({ id: page.id, is_active: false });
      const disc2 = await http.post(`/pages/${page.id}/disconnect`).set(h);
      expect(disc2.status).toBe(200);
      const [row] = await db.select().from(schema.channelConnections).where(eq(schema.channelConnections.id, page.id));
      expect(row.isActive).toBe(false);
    });
  });
});
