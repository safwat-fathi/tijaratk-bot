import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSettings } from '../../config.js';
import { ApiError, notFound, parse } from '../../core/http.js';
import { DB } from '../../core/tokens.js';
import type { Db } from '../../db/index.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { clearProductImage, createProduct, deleteProduct, getProductImage, listProducts, setProductImage, updateProduct } from './service.js';

const Variant = z.object({
  label: z.string(),
  sku: z.string().nullable().default(null),
  price: z.number().nullable().default(null),
  stock: z.number().int().nullable().default(null),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
const ProductCreate = z.object({
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  price: z.number().nullable().default(null),
  category: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  image_url: z.string().nullable().default(null),
  variants: z.array(Variant).default([]),
});
const ProductUpdate = z.object({
  name: z.string().nullish(),
  aliases: z.array(z.string()).nullish(),
  price: z.number().nullish(),
  category: z.string().nullish(),
  description: z.string().nullish(),
  image_url: z.string().nullish(),
});

@Controller('products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  list(@CurrentMerchant() m: Merchant) {
    return listProducts(this.db, m.id);
  }

  @Post()
  create(@CurrentMerchant() m: Merchant, @Body() body: unknown) {
    const payload = parse(ProductCreate, body);
    return this.db.transaction((tx) => createProduct(tx, m.id, payload));
  }

  @Put(':id')
  async update(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const payload = parse(ProductUpdate, body);
    const r = await this.db.transaction((tx) => updateProduct(tx, m.id, id, payload as any));
    if (!r) throw notFound('product not found');
    return r;
  }

  @Put(':id/image')
  async setImage(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Req() req: Request) {
    if (!getSettings().PUBLIC_API_URL) throw new ApiError(500, 'PUBLIC_API_URL is not configured');
    // The raw parser (http-setup.ts) only fills the body for jpeg/png/webp up to 5mb.
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(415, 'send a jpeg, png or webp image (max 5 MB) as the request body');
    const r = await this.db.transaction((tx) => setProductImage(tx, m.id, id, req.headers['content-type']!, req.body));
    if (!r) throw notFound('product not found');
    return r;
  }

  @Delete(':id/image')
  async clearImage(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    const r = await this.db.transaction((tx) => clearProductImage(tx, m.id, id));
    if (!r) throw notFound('product not found');
    return r;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentMerchant() m: Merchant, @Param('id') id: string) {
    if (!(await this.db.transaction((tx) => deleteProduct(tx, m.id, id)))) throw notFound('product not found');
  }
}

/** Public: Meta/Zernio and the browser fetch product photos by URL without credentials. Ids are unguessable UUIDs. */
@Controller('product-images')
export class ProductImagesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get(':id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const img = await getProductImage(this.db, id);
    if (!img) throw notFound('image not found');
    res.set({ 'Content-Type': img.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' }).send(img.data);
  }
}
