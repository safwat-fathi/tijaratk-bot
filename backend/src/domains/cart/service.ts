import { and, eq, sql } from 'drizzle-orm';
import { type DbOrTx, schema } from '../../db/index.js';

export class CartItemNotFoundError extends Error {}

async function getOrCreateActiveCart(db: DbOrTx, merchantId: string, conversationId: string) {
  const c = schema.carts;
  const where = and(eq(c.conversationId, conversationId), eq(c.merchantId, merchantId), eq(c.status, 'ACTIVE'));
  const [cart] = await db.select().from(c).where(where);
  if (cart) return cart;
  const [created] = await db.insert(c).values({ merchantId, conversationId }).onConflictDoNothing().returning();
  if (created) return created;
  return (await db.select().from(c).where(where))[0]; // lost a race with a concurrent add
}

export async function addItem(
  db: DbOrTx,
  merchantId: string,
  conversationId: string,
  productId: string,
  quantity: number,
  notes: string | null = null,
  variantId: string | null = null,
) {
  // Ownership is validator-checked before this runs (engine/action-validator); lookups here only read `price`.
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  if (!product) throw new Error(`product '${productId}' has no price set - cannot add to cart`);

  // Price-fallback rule: a variant's own price wins when set; otherwise the parent product's price.
  let price = product.price;
  if (variantId !== null) {
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId));
    if (!variant) throw new Error(`variant '${variantId}' does not exist - cannot add to cart`);
    if (variant.price !== null) price = variant.price;
  }
  if (price === null) {
    const target = variantId !== null ? `variant '${variantId}'` : `product '${productId}'`;
    throw new Error(`${target} has no price set - cannot add to cart`);
  }

  const cart = await getOrCreateActiveCart(db, merchantId, conversationId);
  const t = schema.cartItems;
  // Two partial unique indexes (with / without variant): ON CONFLICT needs the matching predicate.
  const target =
    variantId === null
      ? { target: [t.cartId, t.productId], targetWhere: sql`variant_id IS NULL` }
      : { target: [t.cartId, t.productId, t.variantId], targetWhere: sql`variant_id IS NOT NULL` };
  const [row] = await db
    .insert(t)
    .values({ cartId: cart.id, productId, variantId, quantity, notes })
    .onConflictDoUpdate({
      ...target,
      set: {
        quantity: sql`${t.quantity} + ${quantity}`,
        // COALESCE: an omitted note on a repeat add must preserve the existing note, not null it out.
        notes: sql`coalesce(excluded.notes, ${t.notes})`,
      },
    })
    .returning({ id: t.id, quantity: t.quantity, notes: t.notes });
  return { line_item_id: row.id, product_id: productId, variant_id: variantId, quantity: row.quantity, notes: row.notes };
}

async function getItemForConversation(db: DbOrTx, merchantId: string, conversationId: string, lineItemId: string) {
  const [row] = await db
    .select({ item: schema.cartItems })
    .from(schema.cartItems)
    .innerJoin(schema.carts, eq(schema.carts.id, schema.cartItems.cartId))
    .where(
      and(
        eq(schema.cartItems.id, lineItemId),
        eq(schema.carts.conversationId, conversationId),
        eq(schema.carts.merchantId, merchantId),
        eq(schema.carts.status, 'ACTIVE'),
      ),
    );
  if (!row) throw new CartItemNotFoundError(`line_item_id '${lineItemId}' not found in this conversation's active cart`);
  return row.item;
}

export async function updateItem(db: DbOrTx, merchantId: string, conversationId: string, lineItemId: string, quantity: number) {
  const item = await getItemForConversation(db, merchantId, conversationId, lineItemId);
  await db.update(schema.cartItems).set({ quantity }).where(eq(schema.cartItems.id, item.id));
  return { line_item_id: item.id, product_id: item.productId, quantity };
}

export async function removeItem(db: DbOrTx, merchantId: string, conversationId: string, lineItemId: string): Promise<void> {
  const item = await getItemForConversation(db, merchantId, conversationId, lineItemId);
  await db.delete(schema.cartItems).where(eq(schema.cartItems.id, item.id));
}
