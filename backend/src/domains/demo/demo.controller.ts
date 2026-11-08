import { Body, Controller, Get, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Settings } from '../../config.js';
import { ApiError } from '../../core/http.js';
import { DB, SETTINGS } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { listConversations } from '../conversations/service.js';
import { ingestInTransaction } from '../messages/messages.controller.js';
import { listProducts } from '../products/service.js';
import { listKnowledge } from '../store-knowledge/service.js';

/** Unauthenticated read-only demo surface pinned to DEMO_STOPGAP_MERCHANT_ID (rate-limited by its own tier). */
@Controller('demo')
export class DemoController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  private demoId(): string {
    if (!this.s.DEMO_STOPGAP_MERCHANT_ID) throw new ApiError(503, 'Demo merchant is not configured');
    return this.s.DEMO_STOPGAP_MERCHANT_ID;
  }

  @Get('conversations')
  conversations() {
    return listConversations(this.db, this.demoId());
  }

  @Get('products')
  products() {
    return listProducts(this.db, this.demoId());
  }

  @Get('knowledge')
  knowledge() {
    return listKnowledge(this.db, this.demoId());
  }

  @Post('messages')
  message(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    res.status(200);
    return ingestInTransaction(this.db, body, this.demoId(), res);
  }
}
