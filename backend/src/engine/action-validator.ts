import { eq } from 'drizzle-orm';
import { type DbOrTx, schema } from '../db/index.js';
import type { ProposedAction } from './schemas.js';

export interface ValidationError {
  code: string;
  message: string;
}
export interface ValidationResult {
  approved: boolean;
  errors: ValidationError[];
}

async function checkProductOwnership(db: DbOrTx, productId: string, merchantId: string): Promise<ValidationError[]> {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!p) return [{ code: 'product_not_found', message: 'product_id does not reference an existing product' }];
  if (p.merchantId !== merchantId) return [{ code: 'product_not_owned', message: 'product belongs to a different merchant' }];
  return [];
}

async function checkVariantOwnership(db: DbOrTx, variantId: string, productId: string): Promise<ValidationError[]> {
  const [v] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId));
  if (!v) return [{ code: 'variant_not_found', message: 'variant_id does not reference an existing variant' }];
  if (v.productId !== productId) return [{ code: 'variant_not_owned', message: 'variant belongs to a different product' }];
  if (v.status !== 'ACTIVE') return [{ code: 'variant_not_active', message: 'variant is not active' }];
  return [];
}

/**
 * SRD S20's DB-checkable rules. Quantity validity is enforced at the zod layer. Product status/stock
 * checks are deferred (no such columns). Variant ownership is checked only after product ownership passes
 * (ProductVariant has no direct merchant_id, so ownership is transitive).
 */
export async function evaluateAction(db: DbOrTx, action: ProposedAction, p: { merchantId: string }): Promise<ValidationResult> {
  let errors: ValidationError[] = [];
  if (action.action === 'get_product' || action.action === 'add_to_cart') {
    errors = await checkProductOwnership(db, action.product_id, p.merchantId);
  }
  if (!errors.length && action.action === 'add_to_cart' && action.variant_id != null) {
    errors = await checkVariantOwnership(db, action.variant_id, action.product_id);
  }
  return { approved: !errors.length, errors };
}
