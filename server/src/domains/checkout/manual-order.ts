import { eq } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';
import { resolveUnitPrice } from '../products/offers.js';
import { type ResolvedOrderLine, writeOrder } from './order-writer.js';

export class ProductNotFoundError extends Error {
  constructor(public readonly productId: string) {
    super(productId);
  }
}
export class ConversationNotFoundError extends Error {}

export interface ManualOrderCreate {
  conversation_id: string;
  line_items: { product_id: string; variant_id: string | null; quantity: number }[];
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
}

export async function createManualOrder(db: DbOrTx, merchantId: string, p: ManualOrderCreate) {
  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, p.conversation_id));
  if (!conversation || conversation.merchantId !== merchantId) throw new ConversationNotFoundError();

  const lines: ResolvedOrderLine[] = [];
  const extractedItems: Record<string, unknown>[] = [];
  for (const item of p.line_items) {
    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, item.product_id));
    if (!product || product.merchantId !== merchantId) throw new ProductNotFoundError(item.product_id);

    let variantId: string | null = null;
    let variantPrice: string | null = null;
    let variantSnapshot: string | null = null;
    if (item.variant_id) {
      const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, item.variant_id));
      if (variant && variant.productId === product.id) {
        variantId = variant.id;
        variantPrice = variant.price;
        variantSnapshot = variant.label;
      }
    }
    const unitPrice = resolveUnitPrice(product, { price: variantPrice }) ?? '0.00';
    lines.push({ productId: product.id, variantId, nameSnapshot: product.name, variantSnapshot, unitPrice, quantity: item.quantity });
    extractedItems.push({ product_name: product.name, product_id: product.id, variant_id: variantId, quantity: item.quantity });
  }

  // Synthetic inbound message satisfies orders.message_id NOT NULL.
  const [synthetic] = await db
    .insert(schema.messages)
    .values({
      conversationId: conversation.id,
      direction: 'INBOUND',
      rawText: '[Manual order by merchant]',
      normalizedText: '[Manual order by merchant]',
    })
    .returning();

  const order = await writeOrder(db, {
    merchantId,
    conversationId: conversation.id,
    messageId: synthetic.id,
    status: 'CONFIRMED',
    source: 'MANUAL',
    lines,
    extractedPayload: { line_items: extractedItems, source: 'manual' },
    confidenceScore: 1.0,
    extractedByTier: 'RULE',
    customerName: p.customer_name,
    customerPhone: p.customer_phone,
    deliveryAddress: p.delivery_address,
    assignOrderNumber: true,
  });

  return {
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal ? Number(order.subtotal) : null,
    total: order.total ? Number(order.total) : null,
  };
}
