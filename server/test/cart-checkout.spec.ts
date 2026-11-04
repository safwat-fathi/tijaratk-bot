import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { addItem, CartItemNotFoundError, removeItem, updateItem } from '../src/domains/cart/service.js';
import { createOrder, getCheckoutState, validateDeliveryArea } from '../src/domains/checkout/service.js';
import { ActionArgumentError } from '../src/engine/tools/errors.js';
import { makeConversation, makeMerchant, makeProduct, schema, withRollback } from './harness.js';

const setup = async (db: any, o: { price?: string | null } = {}) => {
  const m = await makeMerchant(db);
  const c = await makeConversation(db, m.id);
  const p = await makeProduct(db, m.id, { price: o.price === undefined ? '100.00' : o.price });
  const [msg] = await db.insert(schema.messages).values({ conversationId: c.id, direction: 'INBOUND', rawText: 'x' }).returning();
  return { m, c, p, msg };
};

describe('cart service', () => {
  it('adds, increments on repeat (no duplicate row), preserves notes via COALESCE', async () => {
    await withRollback(async (db) => {
      const { m, c, p } = await setup(db);
      const a = await addItem(db, m.id, c.id, p.id, 1, 'بدون سكر');
      const b = await addItem(db, m.id, c.id, p.id, 2);
      expect(b.line_item_id).toBe(a.line_item_id);
      expect(b).toMatchObject({ quantity: 3, notes: 'بدون سكر' });
      expect(await db.select().from(schema.cartItems)).toHaveLength(1);
      expect(await db.select().from(schema.carts)).toHaveLength(1);
    });
  });

  it('variants are separate lines; variant price wins, falls back to product price; priceless is rejected', async () => {
    await withRollback(async (db) => {
      const { m, c, p } = await setup(db);
      const [v1] = await db.insert(schema.productVariants).values({ productId: p.id, label: 'XL', price: '120.00' }).returning();
      const [v2] = await db.insert(schema.productVariants).values({ productId: p.id, label: 'M' }).returning();
      const plain = await addItem(db, m.id, c.id, p.id, 1);
      const xl = await addItem(db, m.id, c.id, p.id, 1, null, v1.id);
      const xl2 = await addItem(db, m.id, c.id, p.id, 1, null, v1.id);
      await addItem(db, m.id, c.id, p.id, 1, null, v2.id); // no variant price -> product price
      expect(xl.line_item_id).not.toBe(plain.line_item_id);
      expect(xl2).toMatchObject({ line_item_id: xl.line_item_id, quantity: 2 });
      expect(await db.select().from(schema.cartItems)).toHaveLength(3);

      const free = await makeProduct(db, m.id, { price: null });
      await expect(addItem(db, m.id, c.id, free.id, 1)).rejects.toThrow(/has no price set/);
      const [v3] = await db.insert(schema.productVariants).values({ productId: free.id, label: 'Z' }).returning();
      await expect(addItem(db, m.id, c.id, free.id, 1, null, v3.id)).rejects.toThrow(/has no price set/);
    });
  });

  it('update/remove are scoped to the conversation\'s active cart and merchant', async () => {
    await withRollback(async (db) => {
      const { m, c, p } = await setup(db);
      const other = await makeMerchant(db, { name: 'O' });
      const { line_item_id } = await addItem(db, m.id, c.id, p.id, 1);
      expect(await updateItem(db, m.id, c.id, line_item_id, 5)).toMatchObject({ quantity: 5 });
      await expect(updateItem(db, other.id, c.id, line_item_id, 1)).rejects.toBeInstanceOf(CartItemNotFoundError);
      await expect(updateItem(db, m.id, c.id, 'nope', 1)).rejects.toBeInstanceOf(CartItemNotFoundError);
      await removeItem(db, m.id, c.id, line_item_id);
      expect(await db.select().from(schema.cartItems)).toHaveLength(0);
      // checked-out carts are frozen
      const { line_item_id: l2 } = await addItem(db, m.id, c.id, p.id, 1);
      await db.update(schema.carts).set({ status: 'CHECKED_OUT' });
      await expect(updateItem(db, m.id, c.id, l2, 9)).rejects.toBeInstanceOf(CartItemNotFoundError);
    });
  });
});

describe('delivery validation', () => {
  it('defaults available with no areas; matches most specific; unavailable otherwise', async () => {
    await withRollback(async (db) => {
      const m = await makeMerchant(db);
      expect(await validateDeliveryArea(db, m.id, null)).toEqual({ status: 'available', delivery_fee: '0.00', estimated_delivery: null });
      await db.insert(schema.deliveryAreas).values([
        { merchantId: m.id, area: 'Cairo', deliveryFee: '30.00' },
        { merchantId: m.id, area: 'Nasr City', deliveryFee: '45.50', estimatedDelivery: '2 days' },
        { merchantId: m.id, area: 'Old', deliveryFee: '1.00', status: 'INACTIVE' },
      ]);
      expect(await validateDeliveryArea(db, m.id, 'Nasr City, Cairo, street 5')).toEqual({ status: 'available', delivery_fee: '45.50', estimated_delivery: '2 days' });
      expect(await validateDeliveryArea(db, m.id, 'cairo')).toMatchObject({ delivery_fee: '30.00' });
      expect(await validateDeliveryArea(db, m.id, 'Alexandria')).toEqual({ status: 'unavailable', reason: 'no_matching_area' });
      expect(await validateDeliveryArea(db, m.id, null)).toEqual({ status: 'unavailable', reason: 'no_address_provided' });
      expect(await validateDeliveryArea(db, m.id, 'old town')).toMatchObject({ status: 'unavailable' });
    });
  });
});

describe('checkout service', () => {
  const customer = { customer_name: 'Ali', customer_phone: '01012345678', customer_address: 'Cairo' };

  it('rejects empty cart and missing customer info', async () => {
    await withRollback(async (db) => {
      const { m, c, p, msg } = await setup(db);
      await expect(createOrder(db, m.id, c.id, true, msg.id)).rejects.toThrow(ActionArgumentError);
      await addItem(db, m.id, c.id, p.id, 1);
      await expect(createOrder(db, m.id, c.id, true, msg.id)).rejects.toThrow(
        'missing required customer info: customer_name, customer_phone, customer_address',
      );
    });
  });

  it('checkout state computes the live subtotal per line', async () => {
    await withRollback(async (db) => {
      const { m, c, p } = await setup(db, { price: '19.99' });
      expect(await getCheckoutState(db, m.id, c.id)).toEqual({ items: [], subtotal: '0.00', currency: 'EGP' });
      await addItem(db, m.id, c.id, p.id, 3);
      const state = await getCheckoutState(db, m.id, c.id);
      expect(state).toMatchObject({ subtotal: '59.97', currency: 'EGP' });
      expect(state.items[0]).toMatchObject({ unit_price: '19.99', line_total: '59.97', quantity: 3 });
    });
  });

  it('previews on confirm=false, creates a numbered order with snapshots + delivery fee on confirm, and is idempotent', async () => {
    await withRollback(async (db) => {
      const { m, c, p, msg } = await setup(db);
      const [v] = await db.insert(schema.productVariants).values({ productId: p.id, label: 'XL', price: '120.00' }).returning();
      await db.insert(schema.deliveryAreas).values({ merchantId: m.id, area: 'Cairo', deliveryFee: '25.00' });
      await db.update(schema.conversations).set({ slots: customer }).where(eq(schema.conversations.id, c.id));
      await addItem(db, m.id, c.id, p.id, 2, null, v.id);

      const preview = await createOrder(db, m.id, c.id, false, msg.id);
      expect(preview).toMatchObject({ confirmed: false, subtotal: '200.00' }); // product price (variants ignored by get_checkout_state, as in Python)
      expect(await db.select().from(schema.orders)).toHaveLength(0);

      const first = (await createOrder(db, m.id, c.id, true, msg.id)) as any;
      expect(first).toMatchObject({ order_number: 1, total: '265.00' });
      const [order] = await db.select().from(schema.orders);
      expect(order).toMatchObject({ status: 'CONFIRMED', source: 'CART_CHECKOUT', subtotal: '240.00', deliveryFee: '25.00', customerName: 'Ali', deliveryAddress: 'Cairo', messageId: msg.id });
      const [item] = await db.select().from(schema.orderItems);
      expect(item).toMatchObject({ nameSnapshot: 'قميص', variantSnapshot: 'XL', unitPrice: '120.00', quantity: 2, variantId: v.id });

      const retry = (await createOrder(db, m.id, c.id, true, msg.id)) as any;
      expect(retry.order_id).toBe(first.order_id);
      expect(await db.select().from(schema.orders)).toHaveLength(1);

      // a new cart after checkout gets the next order number
      await addItem(db, m.id, c.id, p.id, 1);
      expect(((await createOrder(db, m.id, c.id, true, msg.id)) as any).order_number).toBe(2);
    });
  });

  it('refuses when the address is outside configured areas and leaves the cart active', async () => {
    await withRollback(async (db) => {
      const { m, c, p, msg } = await setup(db);
      await db.insert(schema.deliveryAreas).values({ merchantId: m.id, area: 'Cairo', deliveryFee: '25.00' });
      await db.update(schema.conversations).set({ slots: { ...customer, customer_address: 'Mars' } }).where(eq(schema.conversations.id, c.id));
      await addItem(db, m.id, c.id, p.id, 1);
      await expect(
        db.transaction((tx) => createOrder(tx, m.id, c.id, true, msg.id)), // savepoint, as the tool dispatcher does
      ).rejects.toThrow('delivery not available: no_matching_area');
      const [cart] = await db.select().from(schema.carts);
      expect(cart.status).toBe('ACTIVE');
    });
  });
});
