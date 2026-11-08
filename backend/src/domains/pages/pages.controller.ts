import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import {
  disconnectPageById,
  getPageDetail,
  listPagesOverview,
  updatePageAiSettings,
} from './service.js';
import type { StatsRange } from './stats.js';

const RangeQuery = z.object({
  range: z.enum(['today', '7d', '30d']).default('7d'),
});

const PatchPageAi = z.object({
  ai_enabled: z.boolean().optional(),
  pause_hours: z.number().gt(0).max(72).nullable().optional(),
  ai_instructions: z.string().max(500).nullable().optional(),
});

function parseRange(range?: string): StatsRange {
  return parse(RangeQuery, { range: range || undefined }).range;
}

@Controller('pages')
@UseGuards(AuthGuard)
export class PagesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  list(@CurrentMerchant() m: Merchant, @Query('range') range?: string) {
    return listPagesOverview(this.db, m, parseRange(range));
  }

  @Get(':id')
  async detail(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Query('range') range?: string) {
    const page = await getPageDetail(this.db, m, id, parseRange(range));
    if (!page) throw notFound('page not found');
    return page;
  }

  @Patch(':id/ai')
  async updateAi(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const payload = parse(PatchPageAi, body);
    const updated = await updatePageAiSettings(this.db, m, id, payload);
    if (!updated) throw notFound('page not found');
    return updated;
  }

  @Post(':id/disconnect')
  @HttpCode(200)
  async disconnect(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    const res = await disconnectPageById(this.db, m.id, id);
    if (!res) throw notFound('page not found');
    return res;
  }
}

