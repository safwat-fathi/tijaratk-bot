import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { ConversationNotFoundError, returnToAi, takeoverConversation } from './service.js';

const Takeover = z.object({
  reason: z.enum(['USER_REQUEST', 'AI_ESCALATION', 'MERCHANT_TAKEOVER']).default('MERCHANT_TAKEOVER'),
  notes: z.string().nullable().default(null),
});
const Return = z.object({ notes: z.string().nullable().default(null) });

@Controller('conversations')
@UseGuards(AuthGuard)
export class HandoffController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post(':id/takeover')
  @HttpCode(204)
  async takeover(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const p = parse(Takeover, body);
    try {
      await this.db.transaction((tx) => takeoverConversation(tx, m.id, id, p.reason, p.notes));
    } catch (e) {
      if (e instanceof ConversationNotFoundError) throw notFound('Conversation not found');
      throw e;
    }
  }

  @Post(':id/return-to-ai')
  @HttpCode(204)
  async returnToAi(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const p = parse(Return, body);
    try {
      await this.db.transaction((tx) => returnToAi(tx, m.id, id, p.notes));
    } catch (e) {
      if (e instanceof ConversationNotFoundError) throw notFound('Conversation not found');
      throw e;
    }
  }
}
