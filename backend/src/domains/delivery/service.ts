import { and, eq } from 'drizzle-orm';
import { quantize2 } from '../../core/money.js';
import { type DbOrTx, schema } from '../../db/index.js';
import type { DeliveryArea } from '../../db/types.js';

export interface DeliveryAreaRead {
  id: string;
  merchant_id: string;
  area: string;
  delivery_fee: string;
  estimated_delivery: string | null;
  status: string;
}

export const toDeliveryAreaRead = (a: DeliveryArea): DeliveryAreaRead => ({
  id: a.id,
  merchant_id: a.merchantId,
  area: a.area,
  delivery_fee: quantize2(a.deliveryFee),
  estimated_delivery: a.estimatedDelivery,
  status: a.status,
});

export const listDeliveryAreas = (db: DbOrTx, merchantId: string) =>
  db.select().from(schema.deliveryAreas).where(eq(schema.deliveryAreas.merchantId, merchantId));

export async function createDeliveryArea(
  db: DbOrTx,
  merchantId: string,
  d: { area: string; delivery_fee: number; estimated_delivery: string | null },
) {
  const [row] = await db
    .insert(schema.deliveryAreas)
    .values({ merchantId, area: d.area, deliveryFee: quantize2(d.delivery_fee), estimatedDelivery: d.estimated_delivery })
    .returning();
  return row;
}

export async function updateDeliveryArea(
  db: DbOrTx,
  merchantId: string,
  id: string,
  d: { area?: string; delivery_fee?: number | null; estimated_delivery?: string | null },
) {
  const t = schema.deliveryAreas;
  const [area] = await db.select().from(t).where(and(eq(t.id, id), eq(t.merchantId, merchantId)));
  if (!area) return null;
  const set: Partial<typeof t.$inferInsert> = {};
  if (d.area !== undefined) set.area = d.area;
  if (d.delivery_fee != null) set.deliveryFee = quantize2(d.delivery_fee);
  if (d.estimated_delivery !== undefined) set.estimatedDelivery = d.estimated_delivery;
  if (!Object.keys(set).length) return area;
  const [row] = await db.update(t).set(set).where(eq(t.id, id)).returning();
  return row;
}

export async function deleteDeliveryArea(db: DbOrTx, merchantId: string, id: string): Promise<boolean> {
  const t = schema.deliveryAreas;
  const res = await db.delete(t).where(and(eq(t.id, id), eq(t.merchantId, merchantId))).returning({ id: t.id });
  return res.length > 0;
}
