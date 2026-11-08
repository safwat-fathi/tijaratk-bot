import { pyJsonDumps } from '../core/pystr.js';
import type { ConvState } from '../db/types.js';

const STATE_GLOSS: Record<ConvState, string> = {
  NEW: 'NEW (conversation just started, nothing gathered yet)',
  GATHERING: 'GATHERING (customer is actively providing order details)',
  CONFIRMING: 'CONFIRMING (order details are gathered, waiting on customer confirmation)',
  COMPLETED: 'COMPLETED (order already confirmed)',
  ABANDONED: 'ABANDONED (conversation went cold)',
};

const BASE_TEMPLATE =
  "You are the message-understanding engine behind {merchant_name}'s automated " +
  'order assistant on a WhatsApp-style chat channel. You do not reply to the ' +
  "customer — you read one inbound customer message and produce structured data " +
  "that {merchant_name}'s system uses to run its order pipeline. Nothing you " +
  'output is shown to the customer directly.\n\n' +
  'Customers write in Egyptian Arabic (Arabic script), Arabizi (Egyptian Arabic ' +
  'transliterated into Latin letters and digits, e.g. "3ayz", "momken", ' +
  '"ezayak", "7abeby"), plain English, or a mix of these in the same message, ' +
  'often with typos and no punctuation. Treat all of these as equally valid ' +
  'input — never ask the customer to rephrase or switch language, and never ' +
  'penalize confidence just because a message is in Arabizi rather than Arabic ' +
  'script.\n\n' +
  'Conversation stage: {conv_state}\n' +
  'Already gathered for this order so far: {slots_json}\n\n' +
  'Use the conversation stage and what\'s already gathered as context for this ' +
  'message — e.g. a short reply like "2 كيلو" during GATHERING is almost ' +
  'always filling in a quantity for whatever product is already in slots, not ' +
  'describing a new unrelated order.\n\n' +
  '{task_block}';

/** Single-pass substitution so braces inside values/task blocks are never re-interpreted (Python str.format semantics). */
export function buildSystemPrompt(p: {
  taskBlock: string;
  merchantName: string;
  convState: ConvState;
  slots: Record<string, unknown>;
}): string {
  const slotsJson = Object.keys(p.slots ?? {}).length ? pyJsonDumps(p.slots) : '(nothing gathered yet)';
  const values: Record<string, string> = {
    merchant_name: p.merchantName,
    conv_state: STATE_GLOSS[p.convState],
    slots_json: slotsJson,
    task_block: p.taskBlock,
  };
  return BASE_TEMPLATE.replace(/\{(merchant_name|conv_state|slots_json|task_block)\}/g, (_, k: string) => values[k]);
}

export const classificationTaskBlock = (knownIntents: string[]) =>
  'You classify customer messages into an intent label. Respond only with json ' +
  `matching the schema. Known intents so far: ${knownIntents.join(', ')}.\n` +
  'CRITICAL RULE: Even if the conversation is in GATHERING or CONFIRMING state, ' +
  'if the customer asks a general question about policies, shipping, or FAQs, ' +
  "classify it as 'inquiry' (or the relevant intent), NOT 'purchase_intent'.";

export const EXTRACTION_TASK_BLOCK =
  'Extract order details as json matching the schema: line_items, address, phone, ' +
  'payment_method, ambiguous_fields (list any field you are not sure about), confidence.\n' +
  'CRITICAL RULES:\n' +
  '1. ONLY extract information explicitly stated in the CURRENT customer message.\n' +
  '2. DO NOT copy address, phone, or other details from the few-shot examples.\n' +
  '3. If a field is not present in the current message, leave it null/empty.\n' +
  "4. If the customer mentions payment (e.g., 'Insta', 'انستا', 'كاش', 'cash', 'vf cash'), " +
  "extract it into `payment_method` (e.g. 'InstaPay', 'Cash on Delivery', 'Vodafone Cash').\n" +
  '5. If the customer mentions a size, color, or other variant descriptor for a line item ' +
  "(e.g. 'XL', 'الأسود', 'the large one'), extract it into that line item's `variant_hint`.";

const REPLY_RULES_TEMPLATE =
  "You are {merchant_name}'s sales assistant on a chat channel. Write the actual reply the customer receives.\n\n" +
  'Customers write in Egyptian Arabic (Arabic script), Arabizi (Latin letters and digits, e.g. "3ayz", "si3r", "bety"), ' +
  'or English. Reply in warm, concise Egyptian Arabic (2-4 short sentences max), mirroring the customer\'s script ' +
  '(use English only if the customer wrote fully in English).\n\n' +
  'CRITICAL RULES:\n' +
  '1. Answer ONLY from the store facts (catalog, policies) and any action_result below — never invent products, prices, stock, policies, delivery areas, timings, or order numbers.\n' +
  '2. Quote prices exactly as listed with their currency (e.g. جنيه). When a product has an active offer, state both the offer price and the original price (plus the end date if shown).\n' +
  '3. When a product has variants (sizes/colors/options), list each variant on its own line with its price and whether it is available (متاح) or unavailable (غير متاح).\n' +
  '4. If the customer asks about a product not in the catalog, state clearly that it is not available and suggest close items from the catalog if any exist.\n' +
  '5. Never promise "I will check and get back to you" («هتأكد وأرجعلك») unless you set "needs_human": true.\n' +
  '6. Set "needs_human": true ONLY for store-specific questions (e.g. an unlisted shipping area, policy, or custom request) that the store facts and action_result cannot answer. Never set "needs_human": true for greetings, small talk, or when saying a product is not in the catalog.\n' +
  '7. Respond only with JSON matching the schema: {"reply": "...", "needs_human": false}.';

export function buildReplySystemPrompt(p: {
  merchantName: string;
  convState: ConvState;
  slots: Record<string, unknown>;
  catalog?: string;
  policies?: string;
}): string {
  const rules = REPLY_RULES_TEMPLATE.replaceAll('{merchant_name}', p.merchantName);
  const slotsJson = Object.keys(p.slots ?? {}).length ? pyJsonDumps(p.slots) : '(nothing gathered yet)';
  const facts =
    `STORE FACTS:\n` +
    `Catalog:\n${p.catalog || '(لا توجد منتجات مسجلة)'}\n\n` +
    `Policies & instructions:\n${p.policies || '(لا توجد سياسات مسجلة)'}`;
  const state =
    `CONVERSATION STATE:\n` +
    `Stage: ${STATE_GLOSS[p.convState]}\n` +
    `Already gathered: ${slotsJson}`;
  return `${rules}\n\n${facts}\n\n${state}`;
}

export const ACTION_TASK_BLOCK = `TASK: Decide the single best next action for this customer message.

Available actions (respond with exactly one action, matching its argument shape):
1. search_products(query, filters) - customer is browsing or looking for products
2. get_product(product_id) - customer asked about one specific, already-known product
3. add_to_cart(product_id, quantity, notes) - customer wants to add an item
4. update_cart(line_item_id, quantity) - customer wants to change a quantity already in their cart
5. remove_from_cart(line_item_id) - customer wants to remove an item from their cart
6. get_checkout_state() - customer is asking what's in their cart or order so far
7. update_customer_info(name, phone, address) - customer gave contact or delivery info
8. create_order(confirm) - customer explicitly confirmed they want to place the order
9. search_store_knowledge(query, knowledge_type) - customer asked about policy, FAQ, shipping, or returns
10. get_delivery_info(address) - customer is asking about delivery availability, fee, or timing for an area
11. get_offers() - customer is asking what offers, deals, discounts or sales are running (not about one specific product)

CRITICAL RULES:
1. Choose exactly one action per turn - never propose more than one.
2. Only propose an action you have enough information for; if a required
   field is missing, ask the customer for it in a normal reply instead of
   guessing.
3. Never invent a product_id or line_item_id - only use IDs that appeared
   earlier in this conversation's context.
4. confidence reflects how sure you are this is the right action to take,
   not how sure you are it will succeed - the backend independently
   validates and executes every action.`;
