import { type CanActivate, type ExecutionContext, Inject, Injectable, createParamDecorator } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import type { Settings } from '../../config.js';
import { ApiError } from '../../core/http.js';
import { DB, SETTINGS } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { decodeAccessToken } from './tokens.js';

export type Merchant = typeof schema.merchants.$inferSelect;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { merchant?: Merchant }>();
    const header = req.headers.authorization;
    const match = header ? /^bearer\s+(.+)$/i.exec(header) : null;
    if (!match) throw new ApiError(401, 'not authenticated');
    const merchantId = decodeAccessToken(this.settings, match[1]);
    if (merchantId === null) throw new ApiError(401, 'invalid or expired token');
    const [merchant] = await this.db.select().from(schema.merchants).where(eq(schema.merchants.id, merchantId));
    if (!merchant) throw new ApiError(401, 'merchant not found');
    if (merchant.status !== 'ACTIVE') throw new ApiError(403, 'merchant suspended');
    req.merchant = merchant;
    return true;
  }
}

export const CurrentMerchant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Merchant => ctx.switchToHttp().getRequest().merchant,
);
