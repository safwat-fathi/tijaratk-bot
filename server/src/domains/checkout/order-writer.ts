import { sql } from 'drizzle-orm';
import { centsToString, roundScaledToCents, scaledProduct, toCents } from '../../core/money.js';
import { type DbOrTx, schema } from '../../db/index.js';
import type { Order } from '../../db/types.js';

export interface ResolvedOrderLine {
  productId: string;
  variantId: string | null;
  nameSnapshot: string;
  variantSnapshot: string | null;
  unitPrice: string; // numeric(10,2) string, e.g. "12.50"
  quantity: number;
}

type OrderStatus = Order['status'];
type OrderSource = Order['source'];
type ModelTier = Order['extractedByTier'];

/**
 * Single, service-owned writer for Order/OrderItem rows. `status` and `assignOrderNumber` are always
 * caller-supplied: the cart-checkout caller always numbers + CONFIRMs; the extraction caller never numbers
 * and computes its own status. Idempotency and customer-info validation are caller concerns.
 */
export async function writeOrder(
  db: DbOrTx,
  p: {
    merchantId: string;
    conversationId: string;
    messageId: string;
    status: OrderStatus;
    source: OrderSource;
    lines: ResolvedOrderLine[];
    extractedPayload: Record<string, unknown>;
    confidenceScore: number;
    extractedByTier: ModelTier;
    escalationReason?: string | null;
    deliveryFee?: string | null;
    cartId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    assignOrderNumber?: boolean;
  },
): Promise<Order> {
  let orderNumber: number | null = null;
  if (p.assignOrderNumber ?? true) {
    // Atomic increment-and-read: RETURNING is what keeps this safe under concurrent checkouts.
    const res = await db.execute<{ n: number }>(
      sql`UPDATE merchants SET next_order_number = next_order_number + 1 WHERE id = ${p.merchantId} RETURNING next_order_number - 1 AS n`,
    );
    orderNumber = Number(res.rows[0].n);
  }

  // Python: sum(Decimal products) then one quantize - round once, after summing.
  const subtotalCents = roundScaledToCents(p.lines.reduce((acc, l) => acc + scaledProduct(l.unitPrice, l.quantity), 0n));
  const totalCents = subtotalCents + (p.deliveryFee != null ? toCents(p.deliveryFee) : 0n);

  const [order] = await db
    .insert(schema.orders)
    .values({
      merchantId: p.merchantId,
      conversationId: p.conversationId,
      messageId: p.messageId,
      extractedPayload: p.extractedPayload,
      status: p.status,
      confidenceScore: p.confidenceScore,
      extractedByTier: p.extractedByTier,
      escalationReason: p.escalationReason ?? null,
      source: p.source,
      cartId: p.cartId ?? null,
      orderNumber,
      customerName: p.customerName ?? null,
      customerPhone: p.customerPhone ?? null,
      deliveryAddress: p.deliveryAddress ?? null,
      subtotal: centsToString(subtotalCents),
      total: centsToString(totalCents),
      // null for unresolved lookups (extraction path); an explicitly resolved zero fee records "0.00"
      deliveryFee: p.deliveryFee ?? null,
    })
    .returning();

  if (p.lines.length) {
    await db.insert(schema.orderItems).values(
      p.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        variantId: l.variantId,
        nameSnapshot: l.nameSnapshot,
        variantSnapshot: l.variantSnapshot,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
      })),
    );
  }
  return order;
}
