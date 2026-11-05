import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ApiError, notFound, parse } from '../../core/http.js';
import { iso, num } from '../../core/serialize.js';
import { DB } from '../../core/tokens.js';
import { type Db, type DbOrTx, schema } from '../../db/index.js';
import type { Order, OrderItem } from '../../db/types.js';
import { AuthGuard, CurrentMerchant, type Merchant } from '../auth/auth.guard.js';
import { textFallback, textMessage } from '../messaging/models.js';
import { deliver } from '../messaging/deliver.js';
import { ConversationNotFoundError, ProductNotFoundError, createManualOrder } from './manual-order.js';

const ManualOrder = z.object({
  conversation_id: z.string(),
  line_items: z
    .array(z.object({ product_id: z.string(), variant_id: z.string().nullable().default(null), quantity: z.number().default(1.0) }))
    .min(1),
  customer_name: z.string().nullable().default(null),
  customer_phone: z.string().nullable().default(null),
  delivery_address: z.string().nullable().default(null),
});
const StatusUpdate = z.object({ status: z.string() });

const toOrderRead = (o: Order, items: OrderItem[], createdAt: Date | null) => ({
  id: o.id,
  order_number: o.orderNumber,
  status: o.status,
  customer_name: o.customerName,
  customer_phone: o.customerPhone,
  delivery_address: o.deliveryAddress,
  subtotal: num(o.subtotal),
  total: num(o.total),
  created_at: iso(createdAt),
  items: items.map((i) => ({
    id: i.id,
    product_id: i.productId,
    variant_id: i.variantId,
    name_snapshot: i.nameSnapshot,
    variant_snapshot: i.variantSnapshot,
    unit_price: Number(i.unitPrice),
    quantity: i.quantity,
  })),
});

async function loadItems(db: DbOrTx, orderIds: string[]) {
  const map = new Map<string, OrderItem[]>();
  if (!orderIds.length) return map;
  for (const i of await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orderIds))) {
    map.set(i.orderId, [...(map.get(i.orderId) ?? []), i]);
  }
  return map;
}

const NOTIFY_STATUSES = new Set(['PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED']);

@Controller('orders')
@UseGuards(AuthGuard)
export class CheckoutController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(@CurrentMerchant() m: Merchant) {
    const rows = await this.db
      .select({ order: schema.orders, createdAt: schema.messages.createdAt })
      .from(schema.orders)
      .innerJoin(schema.messages, eq(schema.orders.messageId, schema.messages.id))
      .where(eq(schema.orders.merchantId, m.id))
      .orderBy(desc(schema.messages.createdAt));
    const items = await loadItems(this.db, rows.map((r) => r.order.id));
    return rows.map((r) => toOrderRead(r.order, items.get(r.order.id) ?? [], r.createdAt));
  }

  @Post('manual')
  @HttpCode(201)
  async manual(@CurrentMerchant() m: Merchant, @Body() body: unknown) {
    const payload = parse(ManualOrder, body);
    try {
      return await this.db.transaction((tx) => createManualOrder(tx, m.id, payload));
    } catch (e) {
      if (e instanceof ConversationNotFoundError) throw notFound('conversation not found');
      if (e instanceof ProductNotFoundError) throw notFound(`product not found: ${e.productId}`);
      throw e;
    }
  }

  @Patch(':id/status')
  async updateStatus(@CurrentMerchant() m: Merchant, @Param('id') id: string, @Body() body: unknown) {
    const payload = parse(StatusUpdate, body);
    return this.db.transaction(async (tx) => {
      const o = schema.orders;
      const [existing] = await tx.select().from(o).where(and(eq(o.id, id), eq(o.merchantId, m.id)));
      if (!existing) throw notFound('order not found');
      if (!(schema.orderstatus.enumValues as readonly string[]).includes(payload.status)) throw new ApiError(400, 'invalid status');
      const status = payload.status as Order['status'];

      const [order] = await tx.update(o).set({ status }).where(eq(o.id, id)).returning();
      const num_ = order.orderNumber || '';
      const messages: Record<string, string> = {
        PREPARING: `طلبك رقم #${num_} الآن قيد التحضير! ⏳`,
        OUT_FOR_DELIVERY: `طلبك رقم #${num_} في الطريق إليك! 🛵`,
        COMPLETED: `تم استلام طلبك رقم #${num_}. شكراً لاختيارك لنا! ✅`,
        CANCELLED: `تم إلغاء طلبك رقم #${num_}. ❌`,
      };
      if (NOTIFY_STATUSES.has(status)) {
        const [conv] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, order.conversationId));
        if (conv?.channelConnectionId) {
          const [conn] = await tx.select().from(schema.channelConnections).where(eq(schema.channelConnections.id, conv.channelConnectionId));
          if (conn) {
            const msg = textMessage(messages[status]);
            await tx.insert(schema.messages).values({
              conversationId: conv.id,
              direction: 'OUTBOUND',
              rawText: textFallback(msg),
              normalizedText: textFallback(msg),
              messageType: msg.kind,
              richPayload: msg,
            });
            await deliver(conn, conv.customerRef, [msg]);
          }
        }
      }
      const [msgRow] = await tx.select({ c: schema.messages.createdAt }).from(schema.messages).where(eq(schema.messages.id, order.messageId));
      const items = await loadItems(tx, [order.id]);
      return toOrderRead(order, items.get(order.id) ?? [], msgRow?.c ?? null);
    });
  }
}
