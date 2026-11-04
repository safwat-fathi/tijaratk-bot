import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { createKnowledge, deleteKnowledge, listKnowledge, updateKnowledge } from './service.js';

const Create = z.object({
  knowledge_type: z.string(),
  title: z.string(),
  content: z.string(),
  keywords: z.array(z.string()).default([]),
});
const Update = z.object({
  knowledge_type: z.string().nullish(),
  title: z.string().nullish(),
  content: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
});

@Controller('store-knowledge')
@UseGuards(AuthGuard)
export class StoreKnowledgeController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  list(@CurrentMerchant() m: Merchant) {
    return listKnowledge(this.db, m.id);
  }

  @Post()
  create(@CurrentMerchant() m: Merchant, @Body() body: unknown) {
    const p = parse(Create, body);
    return this.db.transaction((tx) => createKnowledge(tx, m.id, p));
  }

  @Put(':id')
  async update(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const p = parse(Update, body);
    const r = await this.db.transaction((tx) => updateKnowledge(tx, m.id, id, p));
    if (!r) throw notFound('knowledge entry not found');
    return r;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    if (!(await this.db.transaction((tx) => deleteKnowledge(tx, m.id, id)))) throw notFound('knowledge entry not found');
  }
}
