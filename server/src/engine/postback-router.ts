/**
 * L0 deterministic postback router: structured postback/quick-reply payloads (button taps) -> outbound
 * messages. No AI - everything comes from database queries and the semantic message model.
 */
import { Logger } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { cpSlice, fmt0, pyFloat } from '../core/pystr.js';
import { type DbOrTx, schema } from '../db/index.js';
import { addItem } from '../domains/cart/service.js';
import { takeoverConversation } from '../domains/handoff/service.js';
import {
  type OutboundMessage,
  buttonMessage,
  genericTemplateMessage,
  mediaMessage,
  quickReplyMessage,
  textMessage,
} from '../domains/messaging/models.js';

const log = new Logger('postback_router');
const PAGE_SIZE = 10; // Facebook limits carousels to 10 elements
const DEFAULT_WELCOME = 'أهلاً بيك في {store_name}! 👋\nتحب تعمل إيه؟';

type Payload = Record<string, any>;

export function mainMenuMessage(merchantName: string, welcomeTemplate: string = DEFAULT_WELCOME) {
  return quickReplyMessage(welcomeTemplate.replaceAll('{store_name}', merchantName), [
    { title: '🛍️ تصفح المنتجات', payload: { action: 'browse_categories' } },
    { title: '🔍 ابحث عن منتج', payload: { action: 'search_prompt' } },
    { title: '🛒 السلة', payload: { action: 'view_cart' } },
  ]);
}

const menuButton = (text: string) => quickReplyMessage(text, [{ title: '🏠 القائمة', payload: { action: 'main_menu' } }]);

export async function handlePostback(db: DbOrTx, merchantId: string, conversationId: string, payload: Payload): Promise<OutboundMessage[]> {
  const action = payload.action ?? '';
  try {
    switch (action) {
      case 'main_menu':
        return await handleMainMenu(db, conversationId);
      case 'browse_categories':
        return await handleBrowseCategories(db, merchantId, conversationId);
      case 'start_checkout':
        return await handleStartCheckout(db, conversationId);
      case 'view_category':
        return await handleViewCategory(db, merchantId, payload);
      case 'view_product':
        return await handleViewProduct(db, merchantId, payload);
      case 'add_to_cart':
        return await handleAddToCart(db, merchantId, conversationId, payload);
      case 'view_cart':
        return await handleViewCart(db, merchantId, conversationId);
      case 'search_prompt':
        return [textMessage('اكتب اسم المنتج أو وصفه وأنا هبحثلك 🔍')];
      case 'escalate':
        await takeoverConversation(db, merchantId, conversationId, 'AI_ESCALATION', payload.reason ?? 'customer_requested');
        return [textMessage('تم تحويلك لخدمة العملاء. فريقنا هيرد عليك في أقرب وقت!')];
    }
  } catch (e) {
    // deterministic router must never crash the pipeline
    log.warn(`postback_handler_error action=${action} error=${e}`);
    return [textMessage('معلش حصلت مشكلة بسيطة. ممكن تجرب تاني؟'), menuButton('تحب ترجع للقائمة الرئيسية؟')];
  }
  log.log(`unknown_postback_action action=${action} payload=${JSON.stringify(payload)}`);
  return [menuButton('مش متأكد إيه اللي تقصده. جرب من القائمة الرئيسية.')];
}

async function clearDeterministicCheckoutState(db: DbOrTx, conversationId: string) {
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  const slots = (c?.slots ?? {}) as Payload;
  if (c && 'deterministic_checkout_step' in slots) {
    const { deterministic_checkout_step: _drop, ...rest } = slots;
    await db.update(schema.conversations).set({ slots: rest }).where(eq(schema.conversations.id, conversationId));
  }
}

async function handleMainMenu(db: DbOrTx, conversationId: string) {
  await clearDeterministicCheckoutState(db, conversationId);
  const [row] = await db
    .select({ accountName: schema.channelConnections.accountName, merchantName: schema.merchants.name })
    .from(schema.conversations)
    .leftJoin(schema.channelConnections, eq(schema.conversations.channelConnectionId, schema.channelConnections.id))
    .innerJoin(schema.merchants, eq(schema.merchants.id, schema.conversations.merchantId))
    .where(eq(schema.conversations.id, conversationId));
  const displayName = row ? row.accountName || row.merchantName || 'المتجر' : 'المتجر';
  return [mainMenuMessage(displayName)];
}

async function handleBrowseCategories(db: DbOrTx, merchantId: string, conversationId: string) {
  await clearDeterministicCheckoutState(db, conversationId);
  const p = schema.products;
  const rows = await db
    .selectDistinct({ category: p.category })
    .from(p)
    .where(and(eq(p.merchantId, merchantId), isNotNull(p.category)))
    .orderBy(asc(p.category));
  const categories = rows.map((r) => r.category!);
  if (!categories.length) return [textMessage('لسه مفيش أقسام متاحة حالياً.')];
  const quick = categories.slice(0, 13).map((cat) => ({ title: cpSlice(cat, 20), payload: { action: 'view_category', category: cat } }));
  return [quickReplyMessage('اختار القسم:', quick)];
}

async function handleViewCategory(db: DbOrTx, merchantId: string, payload: Payload) {
  const category = payload.category ?? '';
  const offset = payload.offset ?? 0;
  const p = schema.products;
  const products = await db
    .select()
    .from(p)
    .where(and(eq(p.merchantId, merchantId), eq(p.category, category)))
    .orderBy(asc(p.name))
    .offset(offset)
    .limit(PAGE_SIZE + 1); // one extra to detect "has more"
  const hasMore = products.length > PAGE_SIZE;
  const display = products.slice(0, PAGE_SIZE);
  if (!display.length) return [textMessage(`مفيش منتجات في قسم «${category}» حالياً.`)];

  const elements = display.map((prod) => {
    const hasPrice = prod.price !== null && Number(prod.price) !== 0; // Python Decimal("0.00") is falsy
    const priceText = hasPrice ? `${pyFloat(Number(prod.price))} جنيه` : '';
    let subtitle = prod.description ? cpSlice(prod.description, 80) : priceText;
    if (hasPrice && prod.description) subtitle = `${priceText} — ${cpSlice(prod.description, 60)}`;
    return {
      title: cpSlice(prod.name, 80),
      subtitle: subtitle ? cpSlice(subtitle, 80) : null,
      image_url: prod.imageUrl,
      buttons: [{ title: 'أضف للسلة', payload: { action: 'view_product', product_id: prod.id, _echo: `أضف ${prod.name} إلى السلة` } }],
    };
  });

  const nav: { title: string; payload: Payload }[] = [{ title: '🏠 القائمة', payload: { action: 'main_menu' } }];
  if (hasMore) nav.unshift({ title: 'التالي ⬅️', payload: { action: 'view_category', category, offset: offset + PAGE_SIZE } });
  return [genericTemplateMessage(elements), quickReplyMessage(`${category} — ${display.length} منتج`, nav)];
}

async function handleViewProduct(db: DbOrTx, merchantId: string, payload: Payload) {
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, payload.product_id ?? ''));
  if (!product || product.merchantId !== merchantId) return [textMessage('المنتج مش موجود أو تم حذفه.')];

  const priceText = product.price !== null && Number(product.price) !== 0 ? `💰 ${pyFloat(Number(product.price))} جنيه` : '';
  const desc = product.description ? `\n${product.description}` : '';
  const detailText = `*${product.name}*\n${priceText}${desc}`;

  const messages: OutboundMessage[] = [];
  if (product.imageUrl) messages.push(mediaMessage(product.imageUrl, 'image'));

  const v = schema.productVariants;
  const active = await db.select().from(v).where(and(eq(v.productId, product.id), eq(v.status, 'ACTIVE'))).orderBy(asc(v.createdAt));
  if (active.length) {
    messages.push(
      quickReplyMessage(
        `${detailText}\n\nاختار النوع:`,
        active.slice(0, 13).map((variant) => ({
          title: cpSlice(variant.label, 20),
          payload: { action: 'add_to_cart', product_id: product.id, variant_id: variant.id },
        })),
      ),
    );
  } else {
    messages.push(
      buttonMessage(detailText, [
        { title: 'أضف للسلة 🛒', payload: { action: 'add_to_cart', product_id: product.id, _echo: `أضف ${product.name} إلى السلة` } },
        { title: '🏠 القائمة', payload: { action: 'main_menu' } },
      ]),
    );
  }
  return messages;
}

async function handleStartCheckout(db: DbOrTx, conversationId: string) {
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  const slots = { ...((c.slots ?? {}) as Payload), deterministic_checkout_step: 'name' };
  await db.update(schema.conversations).set({ slots }).where(eq(schema.conversations.id, conversationId));
  return [textMessage('ممتاز! عشان نقدر نوصلك الطلب، محتاجين شوية بيانات.\n\nالاسم بالكامل؟')];
}

async function handleAddToCart(db: DbOrTx, merchantId: string, conversationId: string, payload: Payload) {
  const productId = payload.product_id ?? '';
  const variantId = payload.variant_id ?? null;
  const result = await addItem(db, merchantId, conversationId, productId, payload.quantity ?? 1, null, variantId);

  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  let variantLabel = '';
  if (variantId) {
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId));
    if (variant) variantLabel = ` (${variant.label})`;
  }
  return [
    quickReplyMessage(`✅ تم إضافة ${product ? product.name : 'المنتج'}${variantLabel} للسلة (الكمية: ${result.quantity})`, [
      { title: '🛒 السلة', payload: { action: 'view_cart' } },
      { title: '🛍️ متابعة التسوق', payload: { action: 'browse_categories' } },
      { title: '🏠 القائمة', payload: { action: 'main_menu' } },
    ]),
  ];
}

async function handleViewCart(db: DbOrTx, merchantId: string, conversationId: string) {
  const c = schema.carts;
  const [cart] = await db
    .select()
    .from(c)
    .where(and(eq(c.conversationId, conversationId), eq(c.merchantId, merchantId), eq(c.status, 'ACTIVE')));
  const items = cart ? await db.select().from(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id)).orderBy(asc(schema.cartItems.createdAt)) : [];

  if (!cart || !items.length) {
    return [
      quickReplyMessage('🛒 السلة فاضية.\nتحب تتصفح المنتجات؟', [
        { title: '🛍️ تصفح المنتجات', payload: { action: 'browse_categories' } },
        { title: '🏠 القائمة', payload: { action: 'main_menu' } },
      ]),
    ];
  }

  const lines: string[] = [];
  let total = 0;
  for (const item of items) {
    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, item.productId));
    const basePrice = product?.price ? Number(product.price) : 0;
    let itemPrice = basePrice;
    let variantLabel = '';
    if (item.variantId) {
      const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, item.variantId));
      if (variant) {
        variantLabel = ` - ${variant.label}`;
        itemPrice = variant.price && Number(variant.price) ? Number(variant.price) : basePrice;
      }
    }
    const lineTotal = itemPrice * item.quantity;
    total += lineTotal;
    const qty = Number.isInteger(item.quantity) ? String(item.quantity) : String(item.quantity);
    lines.push(`• ${qty}x ${product ? product.name : 'منتج'}${variantLabel}\n  ${fmt0(lineTotal)} جنيه`);
  }
  const cartText = `🛒 السلة\n\n${lines.join('\n\n')}\n\n💰 الإجمالي: ${fmt0(total)} جنيه`;
  return [
    buttonMessage(cartText, [
      { title: '✅ إتمام الطلب', payload: { action: 'start_checkout' } },
      { title: '🛍️ متابعة التسوق', payload: { action: 'browse_categories' } },
    ]),
  ];
}
