import { desc, eq, and, ne } from 'drizzle-orm';
import { getSettings } from '../config.js';
import { type DbOrTx, schema } from '../db/index.js';
import type { Conversation, Message } from '../db/types.js';
import { AICallError } from './clients.js';
import { buildContextPrompt } from './context-budget.js';
import { complete, deepseekProvider } from './gateway.js';
import { ACTION_TASK_BLOCK, buildSystemPrompt } from './prompts.js';
import { ProposedAction } from './schemas.js';
import type { StoreFacts } from './store-facts.js';
import { type ActionOutcome, dispatchAction } from './tools/registry.js';

export interface ActionResolution {
  proposedAction: ProposedAction | null;
  outcome: ActionOutcome | null;
  responseText: string;
  escalationReason: string | null;
}

function stripInternal(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripInternal);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => k !== 'image_url' && k !== 'merchant_id')
        .map(([k, val]) => [k, stripInternal(val)]),
    );
  }
  return v;
}

const DELIVERY_UNAVAILABLE_NOTE =
  'ملحوظة: التوصيل لمنطقة العميل غير مؤكد. قل للعميل إن رسوم التوصيل هتتأكد بشكل منفصل، ولا تذكر أي رسوم ولا إن التوصيل متاح.';

function renderResponse(outcome: ActionOutcome): string {
  if (outcome.status === 'rejected') {
    const reason = outcome.errors[0]?.message ?? 'طلب غير صالح';
    return `عذراً، لم أتمكن من تنفيذ ذلك — ${reason}.`;
  }
  if (outcome.status === 'failed') return 'لا أستطيع إتمام ذلك حالياً — دعني أحولك لأحد زملائي لمساعدتك.';
  const json = JSON.stringify(stripInternal(outcome.result ?? {}));
  const note = (outcome.result as { delivery_validation?: { status?: string } } | null)?.delivery_validation?.status === 'unavailable'
    ? `\n${DELIVERY_UNAVAILABLE_NOTE}`
    : '';
  return (json.length > 6000 ? `${json.slice(0, 6000)}...(truncated)` : json) + note;
}

export async function resolveAction(
  db: DbOrTx,
  conversation: Conversation,
  message: Message,
  facts: StoreFacts,
): Promise<ActionResolution> {
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
  const currentText = message.normalizedText || message.rawText || '';
  const prompt = buildContextPrompt({
    history,
    slots,
    currentText,
    maxTurns: s.CONTEXT_HISTORY_TURNS,
    mode: 'action',
  });
  const [merchant] = await db.select({ name: schema.merchants.name }).from(schema.merchants).where(eq(schema.merchants.id, conversation.merchantId));
  const taskBlock = `${ACTION_TASK_BLOCK}\n\nStore catalog (use these exact product_id / variant_id values):\n${facts.catalogWithIds}`;
  const systemPrompt = buildSystemPrompt({ taskBlock, merchantName: merchant.name, convState: conversation.state, slots });

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
  return { proposedAction: action, outcome, responseText: renderResponse(outcome), escalationReason };
}
