import { Logger } from '@nestjs/common';
import { and, asc, cosineDistance, eq, inArray, isNotNull } from 'drizzle-orm';
import { type DbOrTx, schema } from '../db/index.js';
import type { ProductVariant } from '../db/types.js';
import type { ResolvedOrderLine } from '../domains/checkout/order-writer.js';
import { AICallError } from './clients.js';
import { embedText } from './embeddings.js';
import type { ExtractedLineItem } from './schemas.js';

const log = new Logger('product_matching');

export async function matchLineItemsToProducts(
  db: DbOrTx,
  merchantId: string,
  lineItems: ExtractedLineItem[],
  maxDistance = 0.45,
): Promise<ExtractedLineItem[]> {
  const t = schema.products;
  const matched: ExtractedLineItem[] = [];
  for (const item of lineItems) {
    let embedding: number[];
    try {
      embedding = await embedText(item.product_name);
    } catch (e) {
      if (!(e instanceof AICallError)) throw e;
      log.warn(`product_match_embedding_failed product_name=${JSON.stringify(item.product_name)} error=${e.message}`);
      matched.push({ ...item, product_id: null });
      continue;
    }
    const distance = cosineDistance(t.embedding, embedding);
    const [row] = await db
      .select({ id: t.id, distance })
      .from(t)
      .where(and(eq(t.merchantId, merchantId), isNotNull(t.embedding)))
      .orderBy(asc(distance))
      .limit(1);
    matched.push({ ...item, product_id: row && Number(row.distance) <= maxDistance ? row.id : null });
  }
  return matched;
}

export interface VariantCandidate {
  id: string;
  label: string;
  attributes: Record<string, unknown>;
}

/** Pure. Case-insensitive substring match: hint vs each label first, then each attribute value. Never throws. */
export function matchVariantHint(hint: string | null | undefined, candidates: VariantCandidate[]): string | null {
  if (!hint || !candidates.length) return null;
  const h = hint.toLowerCase();
  for (const c of candidates) if (c.label.toLowerCase().includes(h)) return c.id;
  for (const c of candidates) for (const v of Object.values(c.attributes)) if (String(v).toLowerCase().includes(h)) return c.id;
  return null;
}

/**
 * Items with a resolved product get that product's ACTIVE variants (one batched query). Any variants =>
 * variant_required=true and variant_id filled from the hint (null if no match). Others pass through.
 */
export async function resolveVariantsForLineItems(db: DbOrTx, lineItems: ExtractedLineItem[]): Promise<ExtractedLineItem[]> {
  const productIds = [...new Set(lineItems.map((i) => i.product_id).filter((x): x is string => x != null))];
  const byProduct = new Map<string, ProductVariant[]>();
  if (productIds.length) {
    const t = schema.productVariants;
    const rows = await db.select().from(t).where(and(inArray(t.productId, productIds), eq(t.status, 'ACTIVE')));
    for (const v of rows) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
  }
  return lineItems.map((item) => {
    const variants = item.product_id ? (byProduct.get(item.product_id) ?? []) : [];
    if (!variants.length) return item;
    const candidates = variants.map((v) => ({ id: v.id, label: v.label, attributes: (v.attributes ?? {}) as Record<string, unknown> }));
    return { ...item, variant_required: true, variant_id: matchVariantHint(item.variant_hint, candidates) };
  });
}

/**
 * Batch-loads products/variants, applies the price-fallback rule, returns [lines, allResolved].
 * allResolved is false if: empty, any item has no product_id, any variant_required item lacks a variant_id,
 * or no price is available. Failing items are excluded from `lines`; they don't abort the batch.
 */
export async function buildResolvedOrderLines(db: DbOrTx, lineItems: ExtractedLineItem[]): Promise<[ResolvedOrderLine[], boolean]> {
  if (!lineItems.length) return [[], false];
  const productIds = [...new Set(lineItems.map((i) => i.product_id).filter((x): x is string => x != null))];
  const variantIds = [...new Set(lineItems.map((i) => i.variant_id).filter((x): x is string => x != null))];
  const products = new Map(
    (productIds.length ? await db.select().from(schema.products).where(inArray(schema.products.id, productIds)) : []).map((p) => [p.id, p]),
  );
  const variants = new Map(
    (variantIds.length ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.id, variantIds)) : []).map((v) => [v.id, v]),
  );

  const lines: ResolvedOrderLine[] = [];
  let allResolved = true;
  for (const item of lineItems) {
    if (item.product_id == null) { allResolved = false; continue; }
    if (item.variant_required && item.variant_id == null) { allResolved = false; continue; }
    const product = products.get(item.product_id);
    if (!product) { allResolved = false; continue; }
    const variant = item.variant_id != null ? variants.get(item.variant_id) : undefined;
    const unitPrice = variant && variant.price !== null ? variant.price : product.price;
    if (unitPrice === null) { allResolved = false; continue; }
    lines.push({
      productId: product.id,
      variantId: variant ? variant.id : null,
      nameSnapshot: product.name,
      variantSnapshot: variant ? variant.label : null,
      unitPrice,
      quantity: item.quantity,
    });
  }
  return [lines, allResolved];
}
