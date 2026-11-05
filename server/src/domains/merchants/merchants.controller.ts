import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import { type Db, schema } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';

const Update = z.object({
  ai_enabled: z.boolean().nullish(),
  auto_learning_enabled: z.boolean().nullish(),
});
const read = (m: Merchant) => ({
  ai_enabled: m.aiEnabled,
  auto_learning_enabled: m.autoLearningEnabled,
});

@Controller('merchants')
@UseGuards(AuthGuard)
export class MerchantsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('me/settings')
  get(@CurrentMerchant() m: Merchant) {
    return read(m);
  }

  @Patch('me/settings')
  async update(@CurrentMerchant() m: Merchant, @Body() body: unknown) {
    const p = parse(Update, body);
    const set: Partial<typeof schema.merchants.$inferInsert> = {};
    if (p.ai_enabled != null) set.aiEnabled = p.ai_enabled;
    if (p.auto_learning_enabled != null) set.autoLearningEnabled = p.auto_learning_enabled;
    if (!Object.keys(set).length) return read(m);
    const [row] = await this.db.update(schema.merchants).set(set).where(eq(schema.merchants.id, m.id)).returning();
    return read(row);
  }
}
