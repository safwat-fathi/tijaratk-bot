import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { num } from '../../core/serialize.js';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Product, ProductVariant } from '../../db/types.js';
import { embedText } from '../../engine/embeddings.js';

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
}

export interface ProductCreate {
  name: string;
  aliases: string[];
  price: number | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  variants: { label: string; sku: string | null; price: number | null; stock: number | null; attributes: Record<string, unknown> }[];
}
export type ProductUpdate = Partial<Pick<ProductCreate, 'name' | 'aliases' | 'price' | 'category' | 'description' | 'image_url'>>;

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

export async function searchProducts(db: DbOrTx, merchantId: string, query: string, _filters: unknown): Promise<ProductRead[]> {
  const t = schema.products;
  const rows = await db
    .select()
    .from(t)
    .where(and(eq(t.merchantId, merchantId), or(ilike(t.name, `%${query}%`), sql`${query} = ANY(${t.aliases})`)));
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
