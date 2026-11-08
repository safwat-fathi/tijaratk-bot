import { describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config.js';
import { RateLimitMiddleware } from '../src/core/rate-limit.middleware.js';

const settings = (o: Record<string, string> = {}) =>
  loadSettings({ ...process.env, RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_DEFAULT_MAX: '3', RATE_LIMIT_DEFAULT_WINDOW: '60', ...o });

function fakeRedis(failing = false) {
  const counts = new Map<string, number>();
  return {
    counts,
    multi: () => ({
      incr(key: string) {
        this.key = key;
        return this;
      },
      expire() {
        return this;
      },
      async exec() {
        if (failing) throw new Error('redis down');
        counts.set(this.key, (counts.get(this.key) ?? 0) + 1);
        return [[null, counts.get(this.key)], [null, 1]];
      },
      key: '',
    }),
  };
}

async function hit(mw: RateLimitMiddleware, url: string, ip = '1.1.1.1') {
  let status = 200;
  let headers: Record<string, string> = {};
  let passed = false;
  const res: any = {
    status(c: number) { status = c; return res; },
    type() { return res; },
    set(k: string, v: string) { headers = { ...headers, [k]: v }; return res; },
    send() { return res; },
  };
  await mw.use({ originalUrl: url, headers: { 'x-forwarded-for': ip }, socket: {} } as any, res, () => { passed = true; });
  return { status, headers, passed };
}

describe('RateLimitMiddleware', () => {
  it('allows `max` requests per window per IP then answers 429 with Retry-After; other IPs are independent', async () => {
    const mw = new RateLimitMiddleware(fakeRedis() as any, settings());
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await hit(mw, '/products')).status);
    expect(results).toEqual([200, 200, 200, 429, 429]);
    const limited = await hit(mw, '/products');
    expect(Number(limited.headers['Retry-After'])).toBeGreaterThan(0);
    expect(Number(limited.headers['Retry-After'])).toBeLessThanOrEqual(60);
    expect((await hit(mw, '/products', '2.2.2.2')).passed).toBe(true);
  });

  it('exempts /health (also with a query string) and /docs even when the IP is over budget', async () => {
    const mw = new RateLimitMiddleware(fakeRedis() as any, settings());
    for (let i = 0; i < 6; i++) await hit(mw, '/products');
    expect((await hit(mw, '/health')).passed).toBe(true);
    expect((await hit(mw, '/health/?x=1')).passed).toBe(true);
    expect((await hit(mw, '/docs')).passed).toBe(true);
    expect((await hit(mw, '/products')).status).toBe(429);
  });

  it('fails open when Redis is down, and does nothing when disabled', async () => {
    expect((await hit(new RateLimitMiddleware(fakeRedis(true) as any, settings()), '/products')).passed).toBe(true);
    const off = new RateLimitMiddleware(fakeRedis() as any, settings({ RATE_LIMIT_ENABLED: 'False' }));
    for (let i = 0; i < 10; i++) expect((await hit(off, '/products')).passed).toBe(true);
  });
});
