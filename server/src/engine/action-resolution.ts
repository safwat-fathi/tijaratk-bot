import { desc, eq, and, ne } from 'drizzle-orm';
import { getSettings } from '../config.js';
import { type DbOrTx, schema } from '../db/index.js';
import type { Conversation, Message } from '../db/types.js';
import { AICallError } from './clients.js';
import { buildContextPrompt } from './context-budget.js';
import { complete, deepseekProvider } from './gateway.js';
import { ACTION_TASK_BLOCK, buildSystemPrompt } from './prompts.js';
import { ProposedAction } from './schemas.js';
import { type ActionOutcome, dispatchAction } from './tools/registry.js';

export interface ActionResolution {
  proposedAction: ProposedAction | null;
  outcome: ActionOutcome | null;
  responseText: string;
  escalationReason: string | null;
}

function renderResponse(outcome: ActionOutcome, action: ProposedAction): string {
  if (outcome.status === 'rejected') {
    const reason = outcome.errors[0]?.message ?? 'طلب غير صالح';
    return `عذراً، لم أتمكن من تنفيذ ذلك — ${reason}.`;
  }
  if (outcome.status === 'failed') return 'لا أستطيع إتمام ذلك حالياً — دعني أحولك لأحد زملائي لمساعدتك.';
  const result = outcome.result as any;
  switch (action.action) {
    case 'search_products': {
      const products: { name: string }[] = result.products ?? [];
      if (!products.length) return 'لم أتمكن من العثور على أي منتجات مطابقة.';
      return `وجدت ${products.length} منتج(ات): ${products.slice(0, 5).map((p) => p.name).join(', ')}`;
    }
    case 'get_product':
      return result.product.name;
    case 'update_customer_info': {
      const note = result.delivery_validation.status === 'unavailable' ? ' سأقوم بتأكيد رسوم التوصيل لمنطقتك بشكل منفصل.' : '';
      return `تمام، حفظت بياناتك.${note}`;
    }
    case 'get_offers': {
      const offers: { name: string; offer_price: number }[] = result.offers ?? [];
      if (!offers.length) return 'مفيش عروض متاحة حالياً.';
      return `العروض المتاحة: ${offers.slice(0, 5).map((o) => `${o.name} بـ ${o.offer_price}`).join('، ')}`;
    }
    case 'search_store_knowledge': {
      const results: { content: string }[] = result.results ?? [];
      return results.length ? results[0].content : 'لم أتمكن من العثور على أي معلومات حول ذلك.';
    }
    default:
      return 'تم.';
  }
}

export async function resolveAction(db: DbOrTx, conversation: Conversation, message: Message): Promise<ActionResolution> {
  const s = getSettings();
  const m = schema.messages;
  const rows = await db
    .select()
    .from(m)
    .where(and(eq(m.conversationId, conversation.id), ne(m.id, message.id)))
    .orderBy(desc(m.createdAt))
    .limit(s.CONTEXT_HISTORY_TURNS);
  const history = rows.reverse();
  const slots = (conversation.slots ?? {}) as Record<string, unknown>;
  const prompt = buildContextPrompt({
    history,
    slots,
    currentText: message.normalizedText || message.rawText || '',
    maxTurns: s.CONTEXT_HISTORY_TURNS,
    mode: 'action',
  });
  const [merchant] = await db.select({ name: schema.merchants.name }).from(schema.merchants).where(eq(schema.merchants.id, conversation.merchantId));
  const systemPrompt = buildSystemPrompt({ taskBlock: ACTION_TASK_BLOCK, merchantName: merchant.name, convState: conversation.state, slots });

  let action: ProposedAction | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    // S44: retry once on invalid JSON, then escalate
    try {
      [action] = await complete(deepseekProvider(), {
        systemPrompt,
        userPrompt: prompt,
        jsonSchemaFor: ProposedAction,
        parseWith: ProposedAction,
        schemaName: 'ProposedAction',
      });
      break;
    } catch (e) {
      if (!(e instanceof AICallError)) throw e;
    }
  }
  if (!action) {
    return { proposedAction: null, outcome: null, responseText: 'دعني أحولك لأحد زملائي للمساعدة في هذا.', escalationReason: 'ai_call_failed' };
  }

  const outcome = await dispatchAction(db, action, { merchantId: conversation.merchantId, conversationId: conversation.id, messageId: message.id });
  let escalationReason: string | null = null;
  if (outcome.status === 'rejected') escalationReason = `action_rejected:${outcome.errors[0].code}`;
  else if (outcome.status === 'failed') escalationReason = `tool_unavailable:${action.action}`;
  return { proposedAction: action, outcome, responseText: renderResponse(outcome, action), escalationReason };
}
