import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { createDeliveryArea, deleteDeliveryArea, listDeliveryAreas, toDeliveryAreaRead, updateDeliveryArea } from './service.js';

const Create = z.object({
  area: z.string(),
  delivery_fee: z.number(),
  estimated_delivery: z.string().nullable().default(null),
});
const Update = z.object({
  area: z.string().optional(),
  delivery_fee: z.number().nullish(),
  estimated_delivery: z.string().nullish(),
});

// NOTE: unlike the Python router (which never committed - its writes were rolled back on session close),
// mutations here run in a committed transaction.
@Controller('delivery-areas')
@UseGuards(AuthGuard)
export class DeliveryController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(@CurrentMerchant() m: Merchant) {
    return (await listDeliveryAreas(this.db, m.id)).map(toDeliveryAreaRead);
  }

  @Post()
  async create(@CurrentMerchant() m: Merchant, @Body() body: unknown) {
    const d = parse(Create, body);
    return toDeliveryAreaRead(await this.db.transaction((tx) => createDeliveryArea(tx, m.id, d)));
  }

  @Patch(':id')
  async patch(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const d = parse(Update, body);
    const row = await this.db.transaction((tx) => updateDeliveryArea(tx, m.id, id, d));
    if (!row) throw notFound('delivery area not found');
    return toDeliveryAreaRead(row);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    if (!(await this.db.transaction((tx) => deleteDeliveryArea(tx, m.id, id)))) throw notFound('delivery area not found');
  }
}
