import { Logger } from '@nestjs/common';
import { and, asc, cosineDistance, count, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { getSettings } from '../../config.js';
import { iso, num } from '../../core/serialize.js';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Product, ProductVariant } from '../../db/types.js';
import { embedText } from '../../engine/embeddings.js';
import { isOfferActive } from './offers.js';

const log = new Logger('products');

export interface ProductVariantRead {
  id: string;
  product_id: string;
  label: string;
  sku: string | null;
  price: number | null;
  stock: number | null;
  status: string;
  attributes: Record<string, unknown>;
}
export interface ProductRead {
  id: string;
  merchant_id: string;
  name: string;
  aliases: string[];
  variants: ProductVariantRead[];
  price: number | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  /** Sale price and optional end; offer_active is false once the end has passed. */
  offer_price: number | null;
  offer_ends_at: string | null;
  offer_active: boolean;
}

export interface ProductCreate {
  name: string;
  aliases: string[];
  price: number | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  offer_price: number | null;
  offer_ends_at: string | null;
  variants: { label: string; sku: string | null; price: number | null; stock: number | null; attributes: Record<string, unknown> }[];
}
export type ProductUpdate = Partial<Pick<ProductCreate, 'name' | 'aliases' | 'price' | 'category' | 'description' | 'image_url' | 'offer_price' | 'offer_ends_at'>>;

const toVariantRead = (v: ProductVariant): ProductVariantRead => ({
  id: v.id,
  product_id: v.productId,
  label: v.label,
  sku: v.sku,
  price: num(v.price),
  stock: v.stock,
  status: v.status,
  attributes: (v.attributes ?? {}) as Record<string, unknown>,
});

export const toProductRead = (p: Product, variants: ProductVariant[]): ProductRead => ({
  id: p.id,
  merchant_id: p.merchantId,
  name: p.name,
  aliases: p.aliases,
  variants: variants.map(toVariantRead),
  price: num(p.price),
  category: p.category,
  description: p.description,
  image_url: p.imageUrl,
  offer_price: num(p.offerPrice),
  offer_ends_at: iso(p.offerEndsAt),
  offer_active: isOfferActive(p),
});

async function withVariants(db: DbOrTx, products: Product[]): Promise<ProductRead[]> {
  if (!products.length) return [];
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(inArray(schema.productVariants.productId, products.map((p) => p.id)))
    .orderBy(asc(schema.productVariants.createdAt));
  const byProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
  return products.map((p) => toProductRead(p, byProduct.get(p.id) ?? []));
}

const embeddingText = (name: string, aliases: string[]) => `${name} ${aliases.join(' ')}`;

export async function listProducts(db: DbOrTx, merchantId: string): Promise<ProductRead[]> {
  const rows = await db.select().from(schema.products).where(eq(schema.products.merchantId, merchantId)).orderBy(asc(schema.products.name));
  return withVariants(db, rows);
}

export function extractSearchTokens(query: string): string[] {
  const out = new Set<string>();
  for (const raw of query.split(/[^\p{L}\p{N}]+/u)) {
    const stripped = raw.startsWith('ال') && raw.length >= 5 ? raw.slice(2) : raw;
    if (stripped.length >= 3) out.add(stripped);
    if (raw.length >= 3) out.add(raw);
  }
  return [...out];
}

const NEAREST_K = 8;
const CATALOG_MAX_ALL = 40;

/**
 * The products the AI reply may quote. Up to 40 products: all of them. Above that: the nearest 8 by embedding
 * plus anything whose name/alias shares a word with the question (so products with a NULL embedding are still
 * found). `total` lets the caller tell the model when the list is only a subset.
 */
export async function catalogForAi(
  db: DbOrTx,
  merchantId: string,
  o: { embedding?: number[] | null; query?: string } = {},
): Promise<{ products: ProductRead[]; total: number }> {
  const t = schema.products;
  const [{ n }] = await db.select({ n: count() }).from(t).where(eq(t.merchantId, merchantId));
  const total = Number(n);
  if (total === 0) return { products: [], total };
  if (total <= CATALOG_MAX_ALL) return { products: await listProducts(db, merchantId), total };

  const picked = new Map<string, Product>();
  if (o.embedding?.length) {
    const nearest = await db
      .select()
      .from(t)
      .where(and(eq(t.merchantId, merchantId), isNotNull(t.embedding)))
      .orderBy(asc(cosineDistance(t.embedding, o.embedding)))
      .limit(NEAREST_K);
    for (const r of nearest) picked.set(r.id, r);
  }
  if (!picked.size) log.warn(`catalog_nearest_fallback merchant_id=${merchantId}`);

  const tokens = extractSearchTokens(o.query ?? '');
  if (tokens.length) {
    const conds = tokens.flatMap((tok) => [
      ilike(t.name, `%${tok}%`),
      ilike(sql`array_to_string(${t.aliases}, ' ')`, `%${tok}%`),
    ]);
    const matched = await db
      .select()
      .from(t)
      .where(and(eq(t.merchantId, merchantId), or(...conds)))
      .orderBy(asc(t.name))
      .limit(picked.size ? NEAREST_K : CATALOG_MAX_ALL);
    for (const r of matched) picked.set(r.id, r);
  }

  if (!picked.size) {
    const first = await db.select().from(t).where(eq(t.merchantId, merchantId)).orderBy(asc(t.name)).limit(CATALOG_MAX_ALL);
    return { products: await withVariants(db, first), total };
  }
  return { products: await withVariants(db, [...picked.values()]), total };
}

export async function searchProducts(db: DbOrTx, merchantId: string, query: string, _filters: unknown): Promise<ProductRead[]> {
  const t = schema.products;
  let rows = await db
    .select()
    .from(t)
    .where(and(eq(t.merchantId, merchantId), or(ilike(t.name, `%${query}%`), sql`${query} = ANY(${t.aliases})`)));
  // Generic asks ("what do you have?") match no name: fall back to a catalog sample.
  if (!rows.length) rows = await db.select().from(t).where(eq(t.merchantId, merchantId)).orderBy(asc(t.name)).limit(10);
  return withVariants(db, rows);
}

/** Products with a running offer, for the AI's get_offers tool. */
export async function listActiveOffers(db: DbOrTx, merchantId: string): Promise<ProductRead[]> {
  const t = schema.products;
  const rows = await db
    .select()
    .from(t)
    .where(and(eq(t.merchantId, merchantId), sql`${t.offerPrice} IS NOT NULL`, or(sql`${t.offerEndsAt} IS NULL`, sql`${t.offerEndsAt} > now()`)))
    .orderBy(asc(t.name));
  return withVariants(db, rows);
}

export async function getProduct(db: DbOrTx, merchantId: string, productId: string): Promise<ProductRead | null> {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!p || p.merchantId !== merchantId) return null;
  return (await withVariants(db, [p]))[0];
}

export async function createProduct(db: DbOrTx, merchantId: string, payload: ProductCreate): Promise<ProductRead> {
  const embedding = await embedText(embeddingText(payload.name, payload.aliases));
  const [product] = await db
    .insert(schema.products)
    .values({
      merchantId,
      name: payload.name,
      aliases: payload.aliases,
      price: payload.price != null ? String(payload.price) : null,
      category: payload.category,
      description: payload.description,
      imageUrl: payload.image_url,
      offerPrice: payload.offer_price != null ? String(payload.offer_price) : null,
      offerEndsAt: payload.offer_ends_at ? new Date(payload.offer_ends_at) : null,
      embedding,
    })
    .returning();
  if (payload.variants.length) {
    await db.insert(schema.productVariants).values(
      payload.variants.map((v) => ({
        productId: product.id,
        label: v.label,
        sku: v.sku,
        price: v.price != null ? String(v.price) : null,
        stock: v.stock,
        attributes: v.attributes,
      })),
    );
  }
  return (await withVariants(db, [product]))[0];
}

export async function updateProduct(db: DbOrTx, merchantId: string, productId: string, payload: ProductUpdate): Promise<ProductRead | null> {
  const [existing] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!existing || existing.merchantId !== merchantId) return null;

  const set: Partial<typeof schema.products.$inferInsert> = {};
  if (payload.name != null) set.name = payload.name;
  if (payload.aliases != null) set.aliases = payload.aliases;
  if (payload.price != null) set.price = String(payload.price);
  if (payload.category != null) set.category = payload.category;
  if (payload.description != null) set.description = payload.description;
  if (payload.image_url != null) set.imageUrl = payload.image_url;
  // Offer fields: null clears the offer, undefined leaves it alone.
  if (payload.offer_price !== undefined) set.offerPrice = payload.offer_price == null ? null : String(payload.offer_price);
  if (payload.offer_ends_at !== undefined) set.offerEndsAt = payload.offer_ends_at ? new Date(payload.offer_ends_at) : null;
  if (payload.name != null || payload.aliases != null) {
    set.embedding = await embedText(embeddingText(set.name ?? existing.name, set.aliases ?? existing.aliases));
  }
  const [updated] = Object.keys(set).length
    ? await db.update(schema.products).set(set).where(eq(schema.products.id, productId)).returning()
    : [existing];
  return (await withVariants(db, [updated]))[0];
}

export async function deleteProduct(db: DbOrTx, merchantId: string, productId: string): Promise<boolean> {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!p || p.merchantId !== merchantId) return false;
  await db.delete(schema.products).where(eq(schema.products.id, productId));
  return true;
}

/** Stores the image and points products.image_url at its public URL. Null when the product isn't the merchant's. */
export async function setProductImage(db: DbOrTx, merchantId: string, productId: string, contentType: string, data: Buffer): Promise<ProductRead | null> {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!p || p.merchantId !== merchantId) return null;
  const updatedAt = new Date();
  await db
    .insert(schema.productImages)
    .values({ productId, contentType, data, updatedAt })
    .onConflictDoUpdate({ target: schema.productImages.productId, set: { contentType, data, updatedAt } });
  const host = getSettings().PUBLIC_API_URL.trim().replace(/\/+$/, ''); // a bare host means https, as in zernio-connect
  const imageUrl = `${host.includes('://') ? host : `https://${host}`}/product-images/${productId}?v=${updatedAt.getTime()}`;
  const [updated] = await db.update(schema.products).set({ imageUrl }).where(eq(schema.products.id, productId)).returning();
  return (await withVariants(db, [updated]))[0];
}

export async function clearProductImage(db: DbOrTx, merchantId: string, productId: string): Promise<ProductRead | null> {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!p || p.merchantId !== merchantId) return null;
  await db.delete(schema.productImages).where(eq(schema.productImages.productId, productId));
  const [updated] = await db.update(schema.products).set({ imageUrl: null }).where(eq(schema.products.id, productId)).returning();
  return (await withVariants(db, [updated]))[0];
}

export async function getProductImage(db: DbOrTx, productId: string) {
  const [row] = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, productId));
  return row ?? null;
}
