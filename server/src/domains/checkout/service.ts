import { and, desc, eq } from 'drizzle-orm';
import { centsToString, lineTotalCents, quantize2 } from '../../core/money.js';
import { cpLen } from '../../core/pystr.js';
import { type DbOrTx, schema } from '../../db/index.js';
import { ActionArgumentError } from '../../engine/tools/errors.js';
import { type ResolvedOrderLine, writeOrder } from './order-writer.js';

export type DeliveryValidation =
  | { status: 'available'; delivery_fee: string; estimated_delivery: string | null }
  | { status: 'unavailable'; reason: string };

/**
 * Real delivery-area lookup (SRD §29). A merchant with no active areas always gets an available default
 * (total == subtotal). Once a merchant opts in, unmatched addresses are unavailable instead of shipping free.
 */
export async function validateDeliveryArea(db: DbOrTx, merchantId: string, address: string | null | undefined): Promise<DeliveryValidation> {
  const t = schema.deliveryAreas;
  const areas = await db.select().from(t).where(and(eq(t.merchantId, merchantId), eq(t.status, 'ACTIVE')));
  if (!areas.length) return { status: 'available', delivery_fee: '0.00', estimated_delivery: null };
  if (address == null) return { status: 'unavailable', reason: 'no_address_provided' };

  const lower = address.toLowerCase();
  const matches = areas.filter((a) => lower.includes(a.area.toLowerCase()));
  if (!matches.length) return { status: 'unavailable', reason: 'no_matching_area' };
  // Longest (most specific) area string wins; first on ties like Python max().
  const best = matches.reduce((a, b) => (cpLen(b.area) > cpLen(a.area) ? b : a));
  return { status: 'available', delivery_fee: quantize2(best.deliveryFee), estimated_delivery: best.estimatedDelivery };
}

const activeCartRows = (db: DbOrTx, merchantId: string, conversationId: string) =>
  db
    .select({ item: schema.cartItems, product: schema.products, variant: schema.productVariants })
    .from(schema.cartItems)
    .innerJoin(schema.carts, eq(schema.carts.id, schema.cartItems.cartId))
    .innerJoin(schema.products, eq(schema.products.id, schema.cartItems.productId))
    .leftJoin(schema.productVariants, eq(schema.productVariants.id, schema.cartItems.variantId))
    .where(and(eq(schema.carts.conversationId, conversationId), eq(schema.carts.status, 'ACTIVE'), eq(schema.carts.merchantId, merchantId)));

export async function getCheckoutState(db: DbOrTx, merchantId: string, conversationId: string) {
  const [merchant] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, merchantId));
  const rows = await activeCartRows(db, merchantId, conversationId);
  let subtotal = 0n;
  const items = rows.map(({ item, product }) => {
    const price = product.price ?? '0.00';
    const line = lineTotalCents(price, item.quantity);
    subtotal += line;
    return {
      line_item_id: item.id,
      product_id: product.id,
      name: product.name,
      quantity: item.quantity,
      unit_price: String(product.price),
      line_total: centsToString(line),
    };
  });
  return { items, subtotal: centsToString(subtotal), currency: merchant.currency };
}

export type OrderResult = { order_id: string; order_number: number | null; total: string };
const orderResult = (o: { id: string; orderNumber: number | null; total: string | null }): OrderResult => ({
  order_id: o.id,
  order_number: o.orderNumber,
  total: String(o.total),
});

export async function createOrder(
  db: DbOrTx,
  merchantId: string,
  conversationId: string,
  confirm: boolean,
  messageId: string,
): Promise<OrderResult | ({ confirmed: false } & Awaited<ReturnType<typeof getCheckoutState>>)> {
  const c = schema.carts;
  const base = and(eq(c.conversationId, conversationId), eq(c.merchantId, merchantId));
  const [cart] = await db.select().from(c).where(and(base, eq(c.status, 'ACTIVE')));
  if (!cart) {
    // No active cart: nothing was ever added, or a retry against a cart already converted (SRD S37)
    // - the latter must return the existing order, not "empty".
    const [done] = await db.select().from(c).where(and(base, eq(c.status, 'CHECKED_OUT'))).orderBy(desc(c.createdAt)).limit(1);
    if (done) {
      const [existing] = await db.select().from(schema.orders).where(and(eq(schema.orders.cartId, done.id), eq(schema.orders.merchantId, merchantId)));
      if (existing) return orderResult(existing);
    }
    throw new ActionArgumentError(['cart is empty - nothing to check out']);
  }

  const rows = await activeCartRows(db, merchantId, conversationId);
  if (!rows.length) throw new ActionArgumentError(['cart is empty - nothing to check out']);

  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  const slots = (conversation.slots ?? {}) as Record<string, string | undefined>;
  const missing = ['customer_name', 'customer_phone'].filter((f) => !slots[f]);
  if (!slots.customer_address) missing.push('customer_address');
  if (missing.length) throw new ActionArgumentError([`missing required customer info: ${missing.join(', ')}`]);

  if (!confirm) {
    return { confirmed: false, ...(await getCheckoutState(db, merchantId, conversationId)) };
  }

  // Atomic conversion guard (SRD S37): no row back => already checked out; return the existing order.
  const converted = await db
    .update(c)
    .set({ status: 'CHECKED_OUT' })
    .where(and(eq(c.id, cart.id), eq(c.status, 'ACTIVE')))
    .returning({ id: c.id });
  if (!converted.length) {
    const [existing] = await db.select().from(schema.orders).where(and(eq(schema.orders.cartId, cart.id), eq(schema.orders.merchantId, merchantId)));
    return orderResult(existing);
  }

  // Re-check deliverability on the actual write path.
  const delivery = await validateDeliveryArea(db, merchantId, slots.customer_address);
  if (delivery.status !== 'available') {
    throw new ActionArgumentError([`delivery not available: ${delivery.reason ?? 'unknown'}`]);
  }

  // Price-fallback: a variant's own price wins when set; otherwise the parent product's price.
  const lines: ResolvedOrderLine[] = rows.map(({ item, product, variant }) => ({
    productId: product.id,
    variantId: item.variantId,
    nameSnapshot: product.name,
    variantSnapshot: variant ? variant.label : null,
    unitPrice: (variant && variant.price !== null ? variant.price : product.price)!,
    quantity: item.quantity,
  }));

  const order = await writeOrder(db, {
    merchantId,
    conversationId,
    messageId, // the confirming message that triggered the tool call
    status: 'CONFIRMED',
    source: 'CART_CHECKOUT',
    lines,
    extractedPayload: {},
    confidenceScore: 1.0,
    extractedByTier: 'DEEPSEEK',
    cartId: cart.id,
    customerName: slots.customer_name,
    customerPhone: slots.customer_phone,
    deliveryAddress: slots.customer_address,
    deliveryFee: delivery.delivery_fee,
    assignOrderNumber: true,
  });
  return orderResult(order);
}
