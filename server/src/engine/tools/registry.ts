import { Logger } from '@nestjs/common';
import { type DbOrTx, schema } from '../../db/index.js';
import { addItem, CartItemNotFoundError, removeItem, updateItem } from '../../domains/cart/service.js';
import { createOrder, getCheckoutState, validateDeliveryArea } from '../../domains/checkout/service.js';
import { getProduct, searchProducts } from '../../domains/products/service.js';
import { search as searchKnowledge } from '../../domains/store-knowledge/service.js';
import { eq } from 'drizzle-orm';
import { type ValidationError, evaluateAction } from '../action-validator.js';
import type { ProposedAction } from '../schemas.js';
import { ActionArgumentError, ToolUnavailableError } from './errors.js';

const log = new Logger('tools');
const EGYPT_MOBILE = /^01[0125]\d{8}$/;

type Ctx = { merchantId: string; conversationId: string; messageId: string };
type Handler<A extends ProposedAction> = (db: DbOrTx, action: A, ctx: Ctx) => Promise<Record<string, unknown>>;
type HandlerMap = { [K in ProposedAction['action']]: Handler<Extract<ProposedAction, { action: K }>> };

const HANDLERS: HandlerMap = {
  async search_products(db, a, c) {
    return { products: await searchProducts(db, c.merchantId, a.query, a.filters) };
  },
  async get_product(db, a, c) {
    // existence + merchant ownership already validated by evaluateAction
    return { product: await getProduct(db, c.merchantId, a.product_id) };
  },
  async add_to_cart(db, a, c) {
    try {
      return await addItem(db, c.merchantId, c.conversationId, a.product_id, a.quantity, a.notes, a.variant_id);
    } catch (e) {
      if (e instanceof Error && !(e instanceof ActionArgumentError) && /cannot add to cart/.test(e.message)) throw new ActionArgumentError([e.message]);
      throw e;
    }
  },
  async update_cart(db, a, c) {
    try {
      return await updateItem(db, c.merchantId, c.conversationId, a.line_item_id, a.quantity);
    } catch (e) {
      if (e instanceof CartItemNotFoundError) throw new ActionArgumentError([e.message]);
      throw e;
    }
  },
  async remove_from_cart(db, a, c) {
    try {
      await removeItem(db, c.merchantId, c.conversationId, a.line_item_id);
    } catch (e) {
      if (e instanceof CartItemNotFoundError) throw new ActionArgumentError([e.message]);
      throw e;
    }
    return {};
  },
  async get_checkout_state(db, _a, c) {
    return getCheckoutState(db, c.merchantId, c.conversationId);
  },
  async update_customer_info(db, a, c) {
    if (a.phone && !EGYPT_MOBILE.test(a.phone)) {
      throw new ActionArgumentError([`phone '${a.phone}' is not a valid Egyptian mobile number`]);
    }
    const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, c.conversationId));
    const slots = { ...((conversation.slots ?? {}) as Record<string, unknown>) };
    const captured: Record<string, string> = {};
    for (const [field, value] of [['name', a.name], ['phone', a.phone], ['address', a.address]] as const) {
      if (value) {
        slots[`customer_${field}`] = value;
        captured[field] = value;
      }
    }
    await db.update(schema.conversations).set({ slots }).where(eq(schema.conversations.id, c.conversationId));
    const delivery_validation = await validateDeliveryArea(db, c.merchantId, a.address);
    return { captured, delivery_validation };
  },
  async create_order(db, a, c) {
    return createOrder(db, c.merchantId, c.conversationId, a.confirm, c.messageId);
  },
  async search_store_knowledge(db, a, c) {
    return { results: await searchKnowledge(db, c.merchantId, a.query, a.knowledge_type) };
  },
  async get_delivery_info(db, a, c) {
    return { ...(await validateDeliveryArea(db, c.merchantId, a.address)) };
  },
};

export interface ActionOutcome {
  status: 'executed' | 'rejected' | 'failed';
  result: Record<string, unknown> | null;
  errors: ValidationError[];
}

async function recordAiAction(
  db: DbOrTx,
  action: ProposedAction,
  ctx: Ctx,
  p: { status: string; errors: ValidationError[]; result: Record<string, unknown> | null },
) {
  const { action: actionType, confidence: _c, ...args } = action;
  await db.insert(schema.aiActions).values({
    merchantId: ctx.merchantId,
    conversationId: ctx.conversationId,
    messageId: ctx.messageId,
    actionType,
    arguments: args,
    status: p.status,
    errors: p.errors,
    result: p.result,
  });
}

/**
 * Validate, then run the tool. The handler runs inside a savepoint so a rejected/failed action rolls back any
 * partial writes it made (Python committed them regardless); the ai_actions audit row is always written.
 * Unlike Python there is no per-action COMMIT: the caller owns the transaction.
 */
export async function dispatchAction(db: DbOrTx, action: ProposedAction, ctx: Ctx): Promise<ActionOutcome> {
  const validation = await evaluateAction(db, action, { merchantId: ctx.merchantId });
  if (!validation.approved) {
    await recordAiAction(db, action, ctx, { status: 'rejected', errors: validation.errors, result: null });
    return { status: 'rejected', result: null, errors: validation.errors };
  }

  const handler = HANDLERS[action.action] as Handler<ProposedAction> | undefined;
  if (!handler) {
    const errors = [{ code: 'tool_unavailable', message: `no handler registered for action '${action.action}'` }];
    await recordAiAction(db, action, ctx, { status: 'failed', errors, result: null });
    return { status: 'failed', result: null, errors };
  }

  try {
    const result = await db.transaction((tx) => handler(tx, action, ctx));
    await recordAiAction(db, action, ctx, { status: 'executed', errors: [], result });
    return { status: 'executed', result, errors: [] };
  } catch (e) {
    if (e instanceof ActionArgumentError) {
      const errors = e.errors.map((message) => ({ code: 'argument_invalid', message }));
      await recordAiAction(db, action, ctx, { status: 'rejected', errors, result: null });
      return { status: 'rejected', result: null, errors };
    }
    if (e instanceof ToolUnavailableError) {
      const errors = [{ code: 'tool_unavailable', message: e.message }];
      await recordAiAction(db, action, ctx, { status: 'failed', errors, result: null });
      return { status: 'failed', result: null, errors };
    }
    log.error(`tool_crashed action=${action.action} error=${e}`);
    throw e;
  }
}
