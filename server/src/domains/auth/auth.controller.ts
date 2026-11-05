import { Controller, Get, Headers, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Settings } from '../../config.js';
import { ApiError } from '../../core/http.js';
import { safeEqual } from '../../core/safe-equal.js';
import { DB, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from './auth.guard.js';
import { findOpenMerchant } from './service.js';
import { createAccessToken } from './tokens.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  /** Called only by the web app's server (never the browser): trades OPEN_ACCESS_KEY for the owner merchant's JWT. */
  @Post('open')
  @HttpCode(200)
  async open(@Headers('x-open-key') key: string | undefined) {
    if (!this.s.OPEN_ACCESS_KEY) throw new ApiError(404, 'not found');
    if (!key || !safeEqual(key, this.s.OPEN_ACCESS_KEY)) throw new ApiError(403, 'invalid key');
    const merchant = await findOpenMerchant(this.db, this.s);
    if (!merchant) throw new ApiError(404, 'OPEN_MERCHANT_ID does not match a merchant');
    if (merchant.status !== 'ACTIVE') throw new ApiError(403, 'merchant suspended');
    return { access_token: createAccessToken(this.s, merchant.id), merchant_id: merchant.id, merchant_name: merchant.name };
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
}
