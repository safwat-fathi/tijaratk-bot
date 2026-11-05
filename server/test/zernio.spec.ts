import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type supertest from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authHeader, makeConnection, makeMerchant, queued, schema, setSettingsForTests, withApp } from './harness.js';

type Http = ReturnType<typeof supertest>;

const sign = (b: string) => createHmac('sha256', process.env.ZERNIO_WEBHOOK_SECRET!).update(b).digest('hex');
const event = (o: { account?: string; mid?: string; text?: string | null; platform?: string; event?: string; direction?: string; test?: boolean } = {}) =>
  JSON.stringify({
    id: 'evt-1',
    event: o.event ?? 'message.received',
    ...(o.test ? { test: true } : {}),
    message: {
      id: 'z1',
      platform: o.platform ?? 'facebook',
      platformMessageId: o.mid ?? 'mid.1',
      direction: o.direction ?? 'incoming',
      text: o.text === undefined ? 'عايز قميص' : o.text,
      sender: { id: 'U1', name: 'Customer' },
    },
    conversation: { id: 'conv-1' },
    account: { accountId: o.account ?? 'ACC1', profileId: 'p' },
    metadata: null,
    timestamp: new Date().toISOString(),
  });
const post = (http: Http, body: string, sig = sign(body)) =>
  http.post('/webhooks/zernio').set('Content-Type', 'application/json').set('X-Zernio-Signature', sig).send(body);

describe('POST /webhooks/zernio', () => {
  it('rejects bad / missing signatures', async () => {
    await withApp(async ({ http, db }) => {
      const body = event();
      expect((await post(http, body, '00')).status).toBe(403);
      expect((await http.post('/webhooks/zernio').set('Content-Type', 'application/json').send(body)).body).toEqual({ detail: 'invalid signature' });
      expect(queued).toHaveLength(0);
      expect(await db.select().from(schema.webhookEvents)).toHaveLength(0);
    });
  });

  it('creates conversation + message, enqueues, and dedupes a redelivery', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      const conn = await makeConnection(db, m.id, { externalAccountId: 'ACC1' });
      const body = event();
      const res = await post(http, body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'received' });
      const msgs = await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, 'mid.1'));
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({ direction: 'INBOUND', rawText: 'عايز قميص' });
      const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.channelConnectionId, conn.id));
      expect(conv).toMatchObject({ customerRef: 'conv-1', merchantId: m.id }); // Zernio's conversation id is the reply handle
      expect(queued).toHaveLength(1);
      expect(queued[0].data).toEqual({ messageId: msgs[0].id });

      await post(http, body);
      expect(await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, 'mid.1'))).toHaveLength(1);
      expect(queued[1].opts.jobId).toBe(queued[0].opts.jobId);
    });
  });

  it('acks but ignores outgoing, non-message, test and empty-text events', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      await makeConnection(db, m.id, { externalAccountId: 'ACC1' });
      for (const b of [
        event({ direction: 'outgoing' }),
        event({ event: 'message.sent' }),
        event({ test: true }),
        event({ text: null, mid: 'mid.2' }),
      ]) {
        expect((await post(http, b)).status).toBe(200);
      }
      expect(await db.select().from(schema.messages)).toHaveLength(0);
      expect(queued).toHaveLength(0);
      expect(await db.select().from(schema.webhookEvents)).toHaveLength(4);
    });
  });

  it('drops unmapped accounts; routes by platform to the matching channel connection', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      await makeConnection(db, m.id, { externalAccountId: 'ACC1', channel: 'FACEBOOK' });
      await makeConnection(db, m.id, { externalAccountId: 'ACC-IG', channel: 'INSTAGRAM' });
      await post(http, event({ account: 'UNKNOWN', mid: 'a' }));
      await post(http, event({ account: 'ACC-IG', platform: 'instagram', mid: 'b' }));
      await post(http, event({ account: 'ACC-IG', platform: 'facebook', mid: 'c' })); // right id, wrong channel
      const msgs = await db.select().from(schema.messages);
      expect(msgs.map((x) => x.externalMessageId)).toEqual(['b']);
    });
  });

  it('records an unparseable (but correctly signed) body and still acks 200', async () => {
    await withApp(async ({ http, db }) => {
      const res = await post(http, 'not json');
      expect(res.status).toBe(200);
      const [row] = await db.select().from(schema.webhookEvents);
      expect(row.processingError).toBeTruthy();
    });
  });
});

/** Stubs Zernio's REST API; `accounts` is what `/accounts?search=<id>` can find. */
function stubZernio(accounts: { _id: string; platform?: string; displayName?: string }[] = [], o: { connect?: unknown; accountsStatus?: number } = {}) {
  const calls: { url: URL; auth?: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: { headers?: Record<string, string> }) => {
    const u = new URL(url);
    calls.push({ url: u, auth: init?.headers?.authorization });
    if (u.pathname.startsWith('/api/v1/connect/')) return Response.json(o.connect ?? { authUrl: 'https://zernio.com/oauth/xyz' });
    if (u.pathname === '/api/v1/accounts') {
      if (o.accountsStatus) return new Response('down', { status: o.accountsStatus });
      return Response.json({ accounts: accounts.filter((a) => a._id === u.searchParams.get('search')) });
    }
    return new Response('nope', { status: 404 });
  });
  return calls;
}

/** Runs the real start step, then plays the browser: Zernio appends its params to our redirect_url. */
async function callback(http: Http, merchantId: string, zernioParams: Record<string, string>, calls: ReturnType<typeof stubZernio>) {
  const start = await http.get('/merchants/me/connect/facebook').set(authHeader(merchantId));
  expect(start.status).toBe(200);
  const redirect = new URL(calls.at(-1)!.url.searchParams.get('redirect_url')!);
  for (const [k, v] of Object.entries(zernioParams)) redirect.searchParams.set(k, v);
  return http.get(`/zernio/callback${redirect.search}`);
}

const fb = (id: string, o: { platform?: string; displayName?: string } = {}) => ({ _id: id, platform: 'facebook', displayName: 'My Page', ...o });
const rows = (db: any, accountId: string) => db.select().from(schema.channelConnections).where(eq(schema.channelConnections.externalAccountId, accountId));

describe('Zernio connect flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('start: requires auth and a supported platform, and asks Zernio for the right URL', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio();
      const m = await makeMerchant(db);
      expect((await http.get('/merchants/me/connect/facebook')).status).toBe(401);
      expect((await http.get('/merchants/me/connect/tiktok').set(authHeader(m.id))).status).toBe(400);
      const res = await http.get('/merchants/me/connect/facebook').set(authHeader(m.id));
      expect(res.body).toEqual({ auth_url: 'https://zernio.com/oauth/xyz' });
      expect(calls).toHaveLength(1);
      expect(calls[0].url.pathname).toBe('/api/v1/connect/facebook');
      expect(calls[0].auth).toBe('Bearer zernio-key-for-tests');
      expect(calls[0].url.searchParams.get('profileId')).toBe('profile-for-tests');
      expect(calls[0].url.searchParams.get('scopes')).toBe('messaging,comments');
      expect(calls[0].url.searchParams.has('oauthAppId')).toBe(false);
      expect(calls[0].url.searchParams.get('redirect_url')).toMatch(/^https:\/\/api\.example\.test\/zernio\/callback\?state=/);
    });
  });

  it('start: passes our own Meta app to Zernio when ZERNIO_OAUTH_APP_ID is set', async () => {
    const calls = stubZernio();
    setSettingsForTests({ ZERNIO_OAUTH_APP_ID: 'app-1' });
    try {
      await withApp(async ({ http, db }) => {
        const m = await makeMerchant(db);
        await http.get('/merchants/me/connect/facebook').set(authHeader(m.id));
        expect(calls[0].url.searchParams.get('oauthAppId')).toBe('app-1');
      });
    } finally {
      setSettingsForTests(undefined);
    }
  });

  it('start: PUBLIC_API_URL may be a bare host (read as https) or have a trailing slash; other schemes are a config error', async () => {
    const calls = stubZernio();
    const redirectFor = async (url: string) => {
      setSettingsForTests({ PUBLIC_API_URL: url });
      let out = '';
      await withApp(async ({ http, db }) => {
        const m = await makeMerchant(db);
        const res = await http.get('/merchants/me/connect/facebook').set(authHeader(m.id));
        out = res.status === 200 ? calls.at(-1)!.url.searchParams.get('redirect_url')!.split('?')[0] : `${res.status} ${res.body.detail}`;
      });
      return out;
    };
    try {
      expect(await redirectFor('bot-dev.example.com')).toBe('https://bot-dev.example.com/zernio/callback');
      expect(await redirectFor('http://localhost:8000/')).toBe('http://localhost:8000/zernio/callback');
      expect(await redirectFor('ftp://x.test')).toBe('500 PUBLIC_API_URL must be an http(s) URL');
    } finally {
      setSettingsForTests(undefined);
    }
  });

  it('start: Zernio failure is a clean 502; a re-enabled account (no authUrl) connects directly', async () => {
    await withApp(async ({ http, db }) => {
      const m = await makeMerchant(db);
      vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }));
      expect((await http.get('/merchants/me/connect/facebook').set(authHeader(m.id))).status).toBe(502);
      stubZernio([fb('ACC1')], { connect: { account: { _id: 'ACC1' } } });
      const res = await http.get('/merchants/me/connect/facebook').set(authHeader(m.id));
      expect(res.body).toEqual({ connected: 'facebook' });
      expect((await rows(db, 'ACC1'))[0]).toMatchObject({ merchantId: m.id, channel: 'FACEBOOK' });
    });
  });

  it('callback: stores the connection for the merchant in the state and returns to the app', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio([fb('ACC1')]);
      const m = await makeMerchant(db);
      const res = await callback(http, m.id, { connected: 'facebook', accountId: 'ACC1', profileId: 'profile-for-tests', username: 'mypage' }, calls);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://app.example.test/channels?connected=facebook');
      expect((await rows(db, 'ACC1'))[0]).toMatchObject({ merchantId: m.id, channel: 'FACEBOOK', accountName: 'My Page', isActive: true });
    });
  });

  it('callback: rejects a forged, re-targeted or expired state; unknown accounts and Zernio outages redirect with an error', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio([]);
      const a = await makeMerchant(db);
      const b = await makeMerchant(db);
      expect((await http.get('/zernio/callback?state=garbage&accountId=ACC1')).status).toBe(403);
      expect((await http.get('/zernio/callback?accountId=ACC1')).status).toBe(403);

      await http.get('/merchants/me/connect/facebook').set(authHeader(a.id));
      const state = new URL(calls[0].url.searchParams.get('redirect_url')!).searchParams.get('state')!;
      const [, exp, sig] = state.split('.');
      expect((await http.get(`/zernio/callback?state=${b.id}.${exp}.${sig}&accountId=ACC1`)).status).toBe(403); // a's signature, b's id

      const res = await callback(http, a.id, { connected: 'facebook', accountId: 'ACC1' }, calls);
      expect(res.headers.location).toBe('https://app.example.test/channels?error=account_not_found');

      const downCalls = stubZernio([fb('ACC1')], { accountsStatus: 503 });
      const down = await callback(http, a.id, { connected: 'facebook', accountId: 'ACC1' }, downCalls);
      expect(down.headers.location).toBe('https://app.example.test/channels?error=zernio_unavailable');

      stubZernio([fb('ACC1')]);
      await http.get('/merchants/me/connect/facebook').set(authHeader(a.id));
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 31 * 60_000);
      expect((await http.get(`/zernio/callback?state=${state}&accountId=ACC1`)).status).toBe(403);
      expect(await db.select().from(schema.channelConnections)).toHaveLength(0);
    });
  });

  it('callback: a ZERNIO_RETURN_URL that is only an origin returns to the settings page', async () => {
    const calls = stubZernio();
    setSettingsForTests({ ZERNIO_RETURN_URL: 'http://localhost:3000' });
    try {
      await withApp(async ({ http, db }) => {
        const m = await makeMerchant(db);
        const res = await callback(http, m.id, { error: 'x' }, calls);
        expect(res.headers.location).toBe('http://localhost:3000/merchant/settings?error=connect_failed');
      });
    } finally {
      setSettingsForTests(undefined);
    }
  });

  it('callback: surfaces a Zernio failure redirect without storing anything', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio();
      const m = await makeMerchant(db);
      const res = await callback(http, m.id, { error: 'access_denied', platform: 'facebook' }, calls);
      expect(res.headers.location).toBe('https://app.example.test/channels?error=connect_failed');
      expect(await db.select().from(schema.channelConnections)).toHaveLength(0);
    });
  });

  // SECURITY: all merchants share one Zernio profile, so "account exists in the profile" does not prove
  // this merchant connected it. Merchant B must not be able to take over merchant A's connection.
  it('callback: does not rebind an account that already belongs to another merchant', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio([fb('ACC1', { displayName: 'A Page' })]);
      const a = await makeMerchant(db);
      const b = await makeMerchant(db);
      await makeConnection(db, a.id, { externalAccountId: 'ACC1', channel: 'FACEBOOK' });
      const res = await callback(http, b.id, { connected: 'facebook', accountId: 'ACC1' }, calls);
      expect(res.headers.location).toBe('https://app.example.test/channels?error=account_in_use');
      expect((await rows(db, 'ACC1'))[0].merchantId).toBe(a.id);
    });
  });

  it('callback: reconnecting your own account reactivates it', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio([fb('ACC1', { displayName: 'Renamed' })]);
      const m = await makeMerchant(db);
      await makeConnection(db, m.id, { externalAccountId: 'ACC1', channel: 'FACEBOOK', isActive: false, accountName: 'Old' });
      await callback(http, m.id, { accountId: 'ACC1' }, calls);
      expect(await rows(db, 'ACC1')).toMatchObject([{ merchantId: m.id, isActive: true, accountName: 'Renamed' }]);
    });
  });

  // The query string is not signed; the channel must come from Zernio's account record.
  it('callback: stores the channel Zernio reports for the account, not the one in the query string', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio([fb('IG1', { platform: 'instagram' }), fb('WA1', { platform: 'whatsapp' })]);
      const m = await makeMerchant(db);
      await callback(http, m.id, { connected: 'facebook', accountId: 'IG1' }, calls);
      expect((await rows(db, 'IG1'))[0].channel).toBe('INSTAGRAM');
      const res = await callback(http, m.id, { connected: 'facebook', accountId: 'WA1' }, calls);
      expect(res.headers.location).toBe('https://app.example.test/channels?error=unsupported_platform');
      expect(await rows(db, 'WA1')).toHaveLength(0);
    });
  });

  it('callback: retires this merchant\'s old Meta-app connections for the channel (they would double-deliver)', async () => {
    await withApp(async ({ http, db }) => {
      const calls = stubZernio([fb('ACC1')]);
      const m = await makeMerchant(db);
      const other = await makeMerchant(db);
      const legacy = await makeConnection(db, m.id, { externalAccountId: 'PAGE-OLD', pageAccessToken: 'tok' });
      const othersLegacy = await makeConnection(db, other.id, { externalAccountId: 'PAGE-OTHER', pageAccessToken: 'tok' });
      await callback(http, m.id, { accountId: 'ACC1' }, calls);
      const active = async (id: string) => (await db.select().from(schema.channelConnections).where(eq(schema.channelConnections.id, id)))[0].isActive;
      expect(await active(legacy.id)).toBe(false);
      expect(await active(othersLegacy.id)).toBe(true);
      expect((await rows(db, 'ACC1'))[0].isActive).toBe(true);
    });
  });
});
