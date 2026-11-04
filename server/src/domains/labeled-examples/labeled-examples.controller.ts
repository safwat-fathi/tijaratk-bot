import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { createExample, deleteExample, listExamples, updateExample } from './service.js';

export const DEFAULT_INTENTS = ['greeting', 'spam', 'reaction', 'purchase_intent', 'question', 'other'];

const intent = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,49}$/, 'intent must be snake_case (lowercase letters, digits, underscores, max 50 chars)');
const extraction = z.record(z.string(), z.unknown());
const Create = z.object({ normalized_text: z.string(), intent, extraction: extraction.nullable().default(null) });
const Update = z.object({ normalized_text: z.string().nullish(), intent: intent.nullish(), extraction: extraction.nullish() });

@Controller('labeled-examples')
@UseGuards(AuthGuard)
export class LabeledExamplesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('intents')
  intents() {
    return DEFAULT_INTENTS;
  }

  @Get()
  list(@CurrentMerchant() m: Merchant) {
    return listExamples(this.db, m.id);
  }

  @Post()
  create(@CurrentMerchant() m: Merchant, @Body() body: unknown) {
    const p = parse(Create, body);
    return this.db.transaction((tx) => createExample(tx, m.id, p));
  }

  @Put(':id')
  async update(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const p = parse(Update, body);
    const r = await this.db.transaction((tx) => updateExample(tx, m.id, id, p));
    if (!r) throw notFound('labeled example not found');
    return r;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    if (!(await this.db.transaction((tx) => deleteExample(tx, m.id, id)))) throw notFound('labeled example not found');
  }
}
