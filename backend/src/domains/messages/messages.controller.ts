import { Body, Controller, Inject, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { ConversationNotFoundError, ingestMessage } from './service.js';

export const MessageIngestRequest = z.object({
  conversation_id: z.string(),
  raw_text: z.string().max(2000),
  normalized_text: z.string().max(2000),
});

export async function ingestInTransaction(db: Db, body: unknown, merchantId: string, res: Response) {
  const payload = parse(MessageIngestRequest, body);
  try {
    const result = await db.transaction((tx) => ingestMessage(tx, payload, merchantId));
    if (result.escalation_reason === 'ai_call_failed') res.status(202);
    return result;
  } catch (e) {
    if (e instanceof ConversationNotFoundError) throw notFound('conversation not found');
    throw e;
  }
}

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  ingest(@CurrentMerchant() m: Merchant, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    res.status(200); // pydantic route default; 202 is set below when the AI call failed
    return ingestInTransaction(this.db, body, m.id, res);
  }
}
