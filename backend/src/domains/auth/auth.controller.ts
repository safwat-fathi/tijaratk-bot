import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Settings } from '../../config.js';
import { ApiError, parse } from '../../core/http.js';
import { DB, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from './auth.guard.js';
import { createAccessToken, merchantIdFromApiKey } from './tokens.js';

const KeyLogin = z.object({ api_key: z.string() });

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  /** The merchant portal login: trades a merchant API key (see scripts/merchant-key.ts) for a session token. */
  @Post('key-login')
  @HttpCode(200)
  async keyLogin(@Body() body: unknown) {
    const { api_key } = parse(KeyLogin, body);
    const id = merchantIdFromApiKey(this.s, api_key);
    const [merchant] = id ? await this.db.select().from(schema.merchants).where(eq(schema.merchants.id, id)) : [];
    // One answer for every failure, so the response never reveals which merchants exist.
    if (!merchant || merchant.status !== 'ACTIVE') throw new ApiError(401, 'invalid api key');
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
      channels: conns.map((c) => ({ id: c.id, channel: c.channel, account_name: c.accountName ? String(c.accountName) : null })),
    };
  }
}
