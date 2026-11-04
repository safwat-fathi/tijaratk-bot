import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Settings } from '../../config.js';
import { ApiError, parse } from '../../core/http.js';
import { DB, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from './auth.guard.js';
import { fetchUserPages, isPageAccessTokenValid, verifyFacebookAccessToken } from './meta-client.js';
import { findOrCreateMerchantByFacebookId, provisionChannelConnections } from './service.js';
import { createAccessToken } from './tokens.js';

const Callback = z.object({ access_token: z.string() });

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  @Post('facebook/callback')
  @HttpCode(200)
  async facebookCallback(@Body() body: unknown) {
    const { access_token } = parse(Callback, body);
    const identity = await verifyFacebookAccessToken(access_token);
    if (!identity) throw new ApiError(401, 'invalid facebook access token');

    const merchant = await findOrCreateMerchantByFacebookId(this.db, identity);
    if (merchant.status !== 'ACTIVE') throw new ApiError(403, 'merchant suspended');

    const pages = await fetchUserPages(access_token);
    const { connected, conflicts } = await this.db.transaction((tx) => provisionChannelConnections(tx, merchant.id, pages));

    return {
      access_token: createAccessToken(this.s, merchant.id),
      merchant_id: merchant.id,
      merchant_name: merchant.name,
      pages_connected: connected,
      conflicted_pages: conflicts,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentMerchant() m: Merchant) {
    const t = schema.channelConnections;
    const conns = await this.db.select().from(t).where(and(eq(t.merchantId, m.id), eq(t.isActive, true)));
    return {
      merchant_id: m.id,
      merchant_name: m.name,
      is_active: m.status === 'ACTIVE',
      channels: conns.map((c) => ({ channel: c.channel, account_name: c.accountName ? String(c.accountName) : null })),
    };
  }

  @Get('me/verify-tokens')
  @UseGuards(AuthGuard)
  async verifyTokens(@CurrentMerchant() m: Merchant) {
    const t = schema.channelConnections;
    const conns = await this.db.select().from(t).where(and(eq(t.merchantId, m.id), eq(t.isActive, true)));
    let valid = 0;
    let invalid = 0;
    for (const c of conns) {
      if (c.channel === 'FACEBOOK' && c.pageAccessToken && !(await isPageAccessTokenValid(c.pageAccessToken))) {
        await this.db.update(t).set({ isActive: false }).where(eq(t.id, c.id));
        invalid++;
        continue;
      }
      valid++;
    }
    if (conns.length && !valid) throw new ApiError(401, 'Facebook token expired. Please log in again.');
    return { status: 'ok' };
  }
}
