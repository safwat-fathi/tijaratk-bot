import { Controller, Get, Inject, Logger, Param, Query, Res, UseGuards } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { and, count, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { Response } from 'express';
import type { Settings } from '../../config.js';
import { ApiError } from '../../core/http.js';
import { safeEqual } from '../../core/safe-equal.js';
import { DB, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import type { Channel } from './meta.js';

const log = new Logger('channels.zernio-connect');
const API = 'https://zernio.com/api/v1';
const CHANNELS: Record<string, Channel> = { facebook: 'FACEBOOK', instagram: 'INSTAGRAM' };
const STATE_TTL_MS = 30 * 60_000;
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

@Controller()
export class ZernioConnectController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  private zernio(path: string) {
    return fetch(`${API}${path}`, { headers: { authorization: `Bearer ${this.s.ZERNIO_API_KEY}` }, signal: AbortSignal.timeout(15_000) });
  }

  // The state names the merchant that started the flow and expires; its key is derived, not the raw JWT secret.
  private mac(body: string) {
    const key = createHmac('sha256', this.s.JWT_SECRET_KEY).update('zernio-connect-state').digest();
    return createHmac('sha256', key).update(body).digest('hex');
  }
  private makeState(merchantId: string) {
    const body = `${merchantId}.${Date.now() + STATE_TTL_MS}`;
    return `${body}.${this.mac(body)}`;
  }
  private readState(state: string | undefined): string | null {
    const [merchantId, exp, sig] = (state ?? '').split('.');
    if (!merchantId || !exp || !sig || !safeEqual(sig, this.mac(`${merchantId}.${exp}`)) || Number(exp) < Date.now()) return null;
    return merchantId;
  }

  /** Frontend calls this with the merchant's bearer token, then navigates the browser to `auth_url`. */
  @Get('merchants/me/connect/:platform')
  @UseGuards(AuthGuard)
  async start(@CurrentMerchant() m: Merchant, @Param('platform') platform: string) {
    if (!CHANNELS[platform]) throw new ApiError(400, 'unsupported platform');
    if (!this.s.ZERNIO_API_KEY || !this.s.ZERNIO_PROFILE_ID || !this.s.PUBLIC_API_URL) throw new ApiError(500, 'channel connect not configured');
    // A bare host (bot-dev.example.com) means https; Zernio rejects redirect URLs without a scheme.
    const host = this.s.PUBLIC_API_URL.trim().replace(/\/+$/, '');
    const base = host.includes('://') ? host : `https://${host}`;
    if (!/^https?:\/\/./.test(base)) throw new ApiError(500, 'PUBLIC_API_URL must be an http(s) URL');
    const redirect = `${base}/zernio/callback?${new URLSearchParams({ state: this.makeState(m.id) })}`;
    // Ask Facebook/Instagram for page messages + comments only, not Zernio's full posting/ads/analytics set.
    const q = new URLSearchParams({ profileId: this.s.ZERNIO_PROFILE_ID, redirect_url: redirect, scopes: 'messaging,comments' });
    if (this.s.ZERNIO_OAUTH_APP_ID) q.set('oauthAppId', this.s.ZERNIO_OAUTH_APP_ID);
    let body: any;
    try {
      const res = await this.zernio(`/connect/${platform}?${q}`);
      if (!res.ok) {
        log.warn(`zernio_connect_failed status=${res.status} body=${(await res.text()).slice(0, 200)}`);
        // 402 = the Zernio account itself needs a payment method; retrying will not help, and the merchant cannot fix it.
        throw res.status === 402 ? new ApiError(402, 'billing_required') : new ApiError(502, 'channel connect failed');
      }
      body = await res.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      log.warn(`zernio_connect_error error=${e}`);
      throw new ApiError(502, 'channel connect failed');
    }
    if (typeof body?.authUrl === 'string') return { auth_url: body.authUrl };

    // Zernio re-enabled a previously disconnected account instead of starting OAuth.
    const accountId = body?.account?._id ?? body?.account?.id ?? body?._id ?? body?.accountId;
    if (typeof accountId === 'string') {
      const r = await this.connectAccount(m.id, accountId);
      if ('connected' in r) return { connected: r.connected };
      throw new ApiError(409, r.error);
    }
    throw new ApiError(502, 'channel connect failed');
  }

  /** Browser lands here after Zernio finishes OAuth. The signed state identifies the merchant. */
  @Get('zernio/callback')
  async callback(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const back = (params: Record<string, string>) => {
      const url = new URL(this.s.ZERNIO_RETURN_URL);
      if (url.pathname === '/') url.pathname = '/merchant/settings'; // an origin-only setting means the app's settings page
      url.search = new URLSearchParams(params).toString();
      return res.redirect(url.toString());
    };
    const merchantId = this.readState(str(q.state));
    if (!merchantId) throw new ApiError(403, 'bad state');
    const accountId = str(q.accountId);
    if (q.error || !accountId) {
      log.warn(`zernio_connect_denied error=${str(q.error)} reason=${str(q.reason)}`);
      return back({ error: 'connect_failed' });
    }
    return back(await this.connectAccount(merchantId, accountId));
  }

  /** The accountId arrives via the browser: confirm with Zernio that it is in our profile, then bind it to the merchant. */
  private async connectAccount(merchantId: string, accountId: string): Promise<{ connected: string } | { error: string }> {
    let account: any;
    try {
      const r = await this.zernio(`/accounts?${new URLSearchParams({ profileId: this.s.ZERNIO_PROFILE_ID, search: accountId })}`);
      if (!r.ok) {
        log.warn(`zernio_accounts_failed status=${r.status}`);
        return { error: 'zernio_unavailable' };
      }
      account = ((await r.json()) as any).accounts?.find((a: any) => (a._id ?? a.id) === accountId);
    } catch (e) {
      log.warn(`zernio_accounts_error error=${e}`);
      return { error: 'zernio_unavailable' };
    }
    if (!account) return { error: 'account_not_found' };
    const channel = CHANNELS[account.platform];
    if (!channel) return { error: 'unsupported_platform' };

    const t = schema.channelConnections;
    try {
      const outcome = await this.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: t.id, merchantId: t.merchantId, isActive: t.isActive })
          .from(t)
          .where(and(eq(t.channel, channel), eq(t.externalAccountId, accountId)));
        if (existing && existing.merchantId !== merchantId && existing.isActive) {
          return 'account_in_use' as const;
        }
        if (!existing || existing.merchantId !== merchantId) {
          const [{ n }] = await tx
            .select({ n: count() })
            .from(t)
            .where(and(eq(t.merchantId, merchantId), eq(t.isActive, true), inArray(t.channel, ['FACEBOOK', 'INSTAGRAM'])));
          if (Number(n) >= this.s.MAX_ACTIVE_PAGES_PER_MERCHANT) return 'page_limit_reached' as const;
        }
        const [row] = await tx
          .insert(t)
          .values({ merchantId, channel, externalAccountId: accountId, accountName: account.displayName ?? account.username ?? null })
          .onConflictDoUpdate({
            target: [t.channel, t.externalAccountId],
            set: {
              merchantId,
              isActive: true,
              accountName: account.displayName ?? account.username ?? null,
              aiEnabled: sql`CASE WHEN ${t.merchantId} = ${merchantId} THEN ${t.aiEnabled} ELSE true END`,
              aiPausedUntil: sql`CASE WHEN ${t.merchantId} = ${merchantId} THEN ${t.aiPausedUntil} ELSE NULL END`,
              aiInstructions: sql`CASE WHEN ${t.merchantId} = ${merchantId} THEN ${t.aiInstructions} ELSE NULL END`,
            },
            setWhere: or(eq(t.merchantId, merchantId), eq(t.isActive, false)), // never take an active account over from another merchant
          })
          .returning({ id: t.id });
        if (!row) return 'account_in_use' as const;
        // Old Meta-app connections for this channel would deliver every message twice.
        await tx.update(t).set({ isActive: false }).where(and(eq(t.merchantId, merchantId), eq(t.channel, channel), isNotNull(t.pageAccessToken)));
        return 'connected' as const;
      });
      return outcome === 'connected' ? { connected: account.platform } : { error: outcome };
    } catch (e) {
      log.warn(`zernio_connect_store_failed error=${e}`);
      return { error: 'connect_failed' };
    }
  }
}
