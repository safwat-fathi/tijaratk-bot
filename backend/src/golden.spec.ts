import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { agglomerativeCosine } from './clustering/agglomerative.js';
import { Fernet } from './core/fernet.js';
import {
  centsToString,
  roundScaledToCents,
  scaledProduct,
} from './core/money.js';
import { decodeAccessToken } from './domains/auth/tokens.js';
import {
  parseMetaPayload,
  verifyMetaSignature,
} from './domains/channels/meta.js';
import { verifyTwilioSignature } from './domains/channels/twilio.js';
import { loadSettings } from './config.js';

const g = JSON.parse(
  readFileSync(
    new URL('../../docs/contract/golden.json', import.meta.url),
    'utf8',
  ),
);

describe('golden: crypto and signature vectors', () => {
  const c = g.crypto;
  it('decrypts a known Fernet token', () => {
    expect(new Fernet(c.fernet_key).decrypt(c.fernet_token)).toBe(c.plaintext);
  });
  it('round-trips and rejects foreign/garbled tokens', () => {
    const f = new Fernet(c.fernet_key);
    expect(f.decrypt(f.encrypt('héllo ع'))).toBe('héllo ع');
    expect(f.decrypt(c.legacy_plaintext_passthrough)).toBeNull();
    expect(f.decrypt(c.fernet_token.slice(0, -4) + 'AAAA')).toBeNull();
    expect(
      new Fernet(Buffer.alloc(32, 1).toString('base64url')).decrypt(
        c.fernet_token,
      ),
    ).toBeNull();
  });
  it('verifies known JWTs, rejects expired / wrong-signature', () => {
    const s = loadSettings({ ...process.env, JWT_SECRET_KEY: c.jwt_secret });
    expect(decodeAccessToken(s, c['jwt_valid_sub_merchant-123'])).toBe(
      'merchant-123',
    );
    expect(decodeAccessToken(s, c.jwt_expired)).toBeNull();
    expect(decodeAccessToken(s, c.jwt_bad_sig)).toBeNull();
    expect(decodeAccessToken(s, 'garbage')).toBeNull();
  });
  it('verifies the Meta HMAC signature over the raw body', () => {
    const body = Buffer.from(c.meta_body, 'utf8');
    expect(verifyMetaSignature(body, c.meta_signature, c.meta_secret)).toBe(
      true,
    );
    expect(
      verifyMetaSignature(
        Buffer.from(c.meta_body + ' '),
        c.meta_signature,
        c.meta_secret,
      ),
    ).toBe(false);
    expect(verifyMetaSignature(body, undefined, c.meta_secret)).toBe(false);
    expect(verifyMetaSignature(body, c.meta_signature, '')).toBe(false);
  });
  it('verifies the Twilio signature', () => {
    const s = loadSettings({
      ...process.env,
      TWILIO_AUTH_TOKEN: c.twilio_token,
      TWILIO_WEBHOOK_URL: c.twilio_url,
    });
    expect(verifyTwilioSignature(c.twilio_params, c.twilio_signature, s)).toBe(
      true,
    );
    expect(
      verifyTwilioSignature(
        { ...c.twilio_params, Body: 'x' },
        c.twilio_signature,
        s,
      ),
    ).toBe(false);
    expect(verifyTwilioSignature(c.twilio_params, undefined, s)).toBe(false);
  });
});

describe('golden: money rounding', () => {
  it.each(g.money)('%j', (c: any) => {
    const sum = c.lines.reduce(
      (acc: bigint, [p, q]: [string, number]) => acc + scaledProduct(p, q),
      0n,
    );
    expect(centsToString(roundScaledToCents(sum))).toBe(c.subtotal);
    c.lines.forEach(([p, q]: [string, number], i: number) => {
      expect(centsToString(roundScaledToCents(scaledProduct(p, q)))).toBe(
        c.each[i],
      );
    });
  });
});

describe('golden: agglomerative clustering partitions', () => {
  it.each(g.clustering.map((c: any, i: number) => [i, c.threshold, c]))(
    'case %i threshold %f',
    (_i: number, _t: number, c: any) => {
      const labels = agglomerativeCosine(c.vectors, c.threshold);
      const groups = new Map<number, number[]>();
      labels.forEach((l, i) => groups.set(l, [...(groups.get(l) ?? []), i]));
      const partition = [...groups.values()].sort((a, b) => a[0] - b[0]);
      expect(partition).toEqual(c.partition);
    },
  );
});

describe('settings parsing', () => {
  const base = { ...process.env } as NodeJS.ProcessEnv;
  it('accepts true/false/yes/no/on/off/1/0, case-insensitively', () => {
    for (const [v, want] of [
      ['True', true],
      ['FALSE', false],
      ['yes', true],
      ['off', false],
      ['1', true],
      ['0', false],
      ['On', true],
    ] as const) {
      expect(
        loadSettings({ ...base, RATE_LIMIT_ENABLED: v }).RATE_LIMIT_ENABLED,
      ).toBe(want);
    }
    expect(() =>
      loadSettings({ ...base, RATE_LIMIT_ENABLED: 'maybe' }),
    ).toThrow(/RATE_LIMIT_ENABLED/);
  });
  it('refuses to start without required settings', () => {
    for (const k of [
      'JWT_SECRET_KEY',
      'OPENROUTER_API_KEY',
      'EMBEDDING_MODEL',
      'OPENROUTER_BASE_URL',
    ]) {
      expect(() => loadSettings({ ...base, [k]: undefined })).toThrow(
        new RegExp(k),
      );
    }
    expect(() =>
      loadSettings({ ...base, LLM_MODEL: undefined, DEEPSEEK_MODEL: undefined }),
    ).toThrow(/LLM_MODEL/);
    expect(
      loadSettings({
        ...base,
        LLM_MODEL: undefined,
        DEEPSEEK_MODEL: 'legacy-model',
      }).LLM_MODEL,
    ).toBe('legacy-model');
    expect(() => loadSettings({ ...base, DB_URL: undefined })).toThrow(/DB_URL/);
  });
  it('parses list settings as JSON or comma-separated', () => {
    expect(
      loadSettings({ ...base, CORS_ORIGINS: '["http://a","http://b"]' })
        .CORS_ORIGINS,
    ).toEqual(['http://a', 'http://b']);
    expect(
      loadSettings({ ...base, CORS_ORIGINS: 'http://a, http://b' })
        .CORS_ORIGINS,
    ).toEqual(['http://a', 'http://b']);
  });
});

describe('meta payload parsing', () => {
  const evt = (message: any) => ({
    object: 'page',
    entry: [{ id: 'P1', messaging: [{ sender: { id: 'U1' }, ...message }] }],
  });
  it('parses text, skips echoes and mid-less messages', () => {
    expect(
      parseMetaPayload(evt({ message: { mid: 'm1', text: 'hi' } })),
    ).toHaveLength(1);
    expect(
      parseMetaPayload(
        evt({ message: { mid: 'm1', text: 'hi', is_echo: true } }),
      ),
    ).toHaveLength(0);
    expect(parseMetaPayload(evt({ message: { text: 'hi' } }))).toHaveLength(0);
    expect(parseMetaPayload({ object: 'other', entry: [] })).toEqual([]);
  });
  it('quick replies carry payload and fall back to the title', () => {
    const [p] = parseMetaPayload(
      evt({
        message: {
          mid: 'm2',
          quick_reply: { payload: '{"action":"view_cart"}', title: 'السلة' },
        },
      }),
    );
    expect(p.text).toBe('السلة');
    expect(p.postbackPayload).toEqual({ action: 'view_cart' });
  });
  it('postbacks use _echo for display and a synthetic dedup key', () => {
    const [p] = parseMetaPayload(
      evt({
        timestamp: 99,
        postback: {
          title: 'btn',
          payload: '{"action":"x","_echo":"أضف قميص"}',
        },
      }),
    );
    expect(p.text).toBe('أضف قميص');
    expect(p.externalMessageId).toBe('pb:U1:99');
  });
  it('non-object postback JSON is ignored', () => {
    const [p] = parseMetaPayload(
      evt({ postback: { title: 't', payload: '[1,2]', mid: 'x' } }),
    );
    expect(p.postbackPayload).toBeNull();
  });
});
