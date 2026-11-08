# Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price

Date: 2026-11-08
Scope: AI reply pipeline (default and tool paths), reply system prompt, product and knowledge schema, free-plan conversation quota.
Status: review and plan only. Nothing here has been implemented; start with W0 (failing tests) only when asked.

## Context

A merchant (auto-reply on; products, prices, quantities, policies and "AI training" entered) reports that
"سعر التيشيرت كام؟" gets a generic "I'll check and get back to you", that their policies / pricing
instructions are ignored, and that these non-answers still use up the monthly free-plan quota.

I traced the real code path end to end (read-only; no production DB access, so section *Verification C*
lists the queries to run there). **The cause is in the pipeline, not in the merchant's data: on the default
configuration the product catalog is never read when a shopper asks a question.** A perfectly entered
product would get the same reply.

## Verified diagnosis

Trace of "سعر التيشيرت كام؟" for every merchant today (`ai_tool_ordering_enabled=false`):

1. `processMessage` -> tier-0 no match -> embed -> `classifyMessage` (confident `question`/`other`).
2. The only legacy branch that touches products (`pipeline.ts:333`) needs `purchase_intent` AND
   `state in {GATHERING, CONFIRMING}`. Conversations are created `NEW` (`channels/service.ts:22`) and **no code
   ever changes `state`** (every `UPDATE conversations` writes only `slots` / `humanTakeover`; the old Python
   backend was identical). The branch is dead in production.
3. Falls to `knowledge.search` (`pipeline.ts:399-406`): substring match on optional merchant-typed keywords, top-1
   only. No hit -> prompt "No store_info is available ... say you will check and get back to them"
   (`pipeline.ts:403-404`); system prompt adds "never invent prices ... say you will check and get back"
   (`prompts.ts:78-81`).
4. DeepSeek obeys. The phrase is not hard-coded anywhere (repo-wide grep): it is generated from those two lines.
5. Message is saved `intent=question, model_tier=DEEPSEEK` -> counted by `usage/service.ts:15`.

**The merchant's four questions**

| # | Question | Verified answer |
|---|---|---|
| 1 | AI <-> catalog connection | **Missing on the default path.** Other `products` readers: dead extraction branch; tool layer (flag defaults off and *nothing writes it*: `merchants.controller.ts:10-13` accepts only `ai_enabled`/`auto_learning_enabled`; no UI/script); the button catalog flow, whose only entry ("🛍️ تصفح المنتجات" main menu) was deleted in `bce6f54` (2026-11-05). Since then free-text AI is the only door and it has no catalog. |
| 2 | How prices/quantities are fetched | Default: not at all. Tool mode (if it were on): `renderResponse` (`action-resolution.ts:19-50`) discards the data: `search_products` -> "وجدت N منتج(ات): names", `get_product` -> name only, cart/checkout/delivery/create_order -> "تم." (tests pin it, `pipeline.spec.ts:405`). Product IDs never enter LLM context, so `get_product`/`add_to_cart` cannot be called correctly. `product_variants.stock` is read by nothing. |
| 3 | Policies / pricing instructions ignored | Policies need a keyword substring hit (`store-knowledge/service.ts:31-43`): blank keywords never match, the form splits on ASCII `,` only (Arabic `،` makes one useless keyword), no Arabic normalisation, only the top-1 entry is injected. "AI training" (`/merchant/training`) writes `labeled_examples` = intent labels/extraction few-shots: used by classification/extraction only, never by the reply generator, and not at all in tool mode (`action-resolution.ts:63-69`). No "pricing policy" concept exists in schema, prompts or UI. |
| 4 | Quota burned without an answer | By design: any thread with a non-tier-0-spam/reaction inbound message in the UTC month counts, whatever the outcome (AI off, takeover, deflection, escalation, crash). The slot is taken at webhook ingestion (intent still NULL), before any AI work, and is never given back (BullMQ `attempts:1`). Metering is derived from `intent`/`model_tier` labels (already patched twice: `6486fc1`, `c0e7aff`) and recomputed with a GROUP BY on every inbound message (`usage/service.ts:7-25`). |

**Why it was never caught:** `test/harness.ts:72` defaults conversations to `GATHERING` (seed + eval scripts did too),
so extraction looks alive in tests; two tests pin the faulty behaviour (`pipeline.spec.ts:362,405`); the portal's
"simulate customer" box posts to the pinned demo merchant and reads `answer_text` while the server returns
`answer_messages`, so a merchant cannot test their own bot.

## AI-engineering review

| Area | Finding | Disposition |
|---|---|---|
| Tool calling | Lossy tool-result rendering (info lost between tool and generator) | **Fix (W3)** |
| | ACTION prompt demands IDs "from context" but none ever enter context | **Fix (W3)**: catalog+IDs in action prompt |
| | Pseudo tool-calling: one JSON action/turn, open loop, 2nd LLM call to verbalise | Fine for MVP; native tool-calling loop = later |
| | `searchProducts`: `ilike %q%` (query must be a substring of the name), exact-alias only, no Arabic normalisation, embeddings unused, silent "catalog sample" on miss reported as "found N" | Follow-up (rarely needed once catalog is in context) |
| | Tool branch leaves `message.intent` null, computes embedding/intents/corrections then drops them | Follow-up |
| System prompt | One "message-understanding engine ... you do not reply to the customer" preamble reused for the reply generator whose task is "write the reply the customer receives" | **Fix (W2)** |
| | `{merchant_name}` reaches the model literally (known since the port; parity no longer needed) | **Fix (W2)** |
| | Generator sees current message only: no history, no catalog, 1 policy | **Fix (W1/W2)** |
| | "Say you'll check and get back" is a promise nothing fulfils (no handoff, no flag) | **Fix (W2)**: `needs_human` -> existing `supportOffer` buttons, so the shopper opts into a real handoff |
| | Volatile slots/state before static rules defeats prefix caching | **Fix (W2)** ordering |
| DB / products | Price nullable at product and variant level, no CHECKs, `updateProduct` ignores `price:null`, 0 treated as "no price" in postback code only | Follow-up; facts builder tolerates all |
| | Quantity only on variants, nullable; UI defaults blank to 10, silently drops variant rows with blank label, cannot edit variants after create; `status` never synced to stock; nothing reads either | W1 derives availability; rest follow-up |
| | Price rule implemented 5x (`resolveUnitPrice` vs `buildResolvedOrderLines`, postback views/cart, `addItem`); offers ignored outside checkout | W1 reuses `resolveUnitPrice`; rest sits in dead/orphaned code |
| | `store_knowledge`: no embedding/priority/always-on, free-text type; `merchants` has no instructions/tone column | W1 injects policies as rules |
| | Dead/orphaned: GATHERING extraction branch, `matchLineItemsToProducts`, postback catalog flow | Product decision: delete or wire (follow-up) |
| Metering | Quota derived from labels, O(month messages) per inbound message, no outcome/deflection metric | **Fix (W4)** |

## Recommended changes (TDD: write W0 first, watch it fail, then W1-W5)

**W0 - reproduce** (`backend/test/pipeline.spec.ts`, new `describe('grounded replies')`, conversations created with
`state:'NEW'` like production): price question on default path -> generator system prompt contains product name +
`250` and not "No store_info is available"; policy with empty keywords reaches the generator; `needs_human` -> a
quick-reply `supportOffer` is sent, `escalationReason='unanswerable'`, conversation NOT taken over; >40 products with a
failing embedding still yields a non-empty catalog; tool mode `search_products`/`get_checkout_state` -> `action_result`
carries price / cart JSON. Rewrite the pinned tests at `:341-364`, `:398-409`. Note: `fakeAi` only proves the facts reach
the prompt; *Verification B* is what proves the real model stops deferring.

**W1 - ground every reply in store facts** (fixes 1, 2, 3)
- New `backend/src/engine/store-facts.ts`: `buildStoreFacts(db, merchantId, {embedding, currency, withIds})` -> compact
  `catalog` + `policies` text; pure formatters unit-tested in `store-facts.spec.ts`.
  - Catalog: all products if count <= 40, else top-8 by `cosineDistance(products.embedding, message.embedding)`
    (embedding already computed at `pipeline.ts:260`, no extra API call). Per product: name, aliases, effective price via
    `resolveUnitPrice` (`products/offers.ts`), active offer + end date, variants (label, price, available/unavailable
    from `status`/`stock`; null stock = available).
  - Fallback when nearest-k cannot run (embedding failed - caught at `pipeline.ts:262-265` - or legacy rows with null
    `products.embedding`) or returns nothing: token-OR `ilike` on name/aliases (tokens >= 3 chars, leading "ال" stripped),
    else the first 40 by name; log a warning. Never an empty catalog for a merchant who has products.
  - Policies: keyword-matched entries first (existing `knowledge.search`), then the rest of `listKnowledge`, oldest first
    (stable prefix), ~3000-char budget, log a warning on drop. Keywords become a priority hint, not a gate.
- `products/service.ts`: add `catalogForAi()` (count, then `listProducts` or nearest-k; reuse `withVariants`).
- `pipeline.ts:399-406`: replace the top-1 knowledge branch with facts passed to `generateReply`.
- Cost: ~+2.5k input tokens/reply, cache-friendly, negligible at DeepSeek-Flash prices.

**W2 - honest reply prompt** (`prompts.ts`, `generation.ts`, `schemas.ts`, `pipeline.ts`)
- Separate reply preamble (sales assistant of {merchant}, Egyptian Arabic, mirror customer's script) from the
  understanding-engine preamble; substitute `{merchant_name}`. Rules: answer only from facts; quote prices exactly with
  currency; offer -> both prices; variants -> one line each; product not in catalog -> say so, suggest close items;
  never say "I'll check" unless `needs_human=true`. Section order: rules -> store facts -> conversation state.
- Generator call gets recent history (new 5-line renderer in `generation.ts`; do not touch `buildContextPrompt`, golden-pinned).
- `GeneratedReply` += `needs_human` (default false), documented to the model as: set only for store-specific questions the
  facts cannot answer (never for small talk). On true the pipeline sends `supportOffer(reply, 'unanswerable')` (the existing
  "تحب نحولك لخدمة العملاء؟" buttons -> `escalate` postback) and sets `escalationReason='unanswerable'`. **No automatic
  `takeoverConversation`**: it mutes the bot for 30 min (`resumeIfIdle`), so an over-flagging model would turn "I'll check"
  into silence. Small helper in `pipeline.ts` (`replyMessages(message, reply)`) shared by the tool and legacy exits.
- Hand-edit `docs/contract/golden.json` `json_schemas.reply` (intentional contract change, allowed by CLAUDE.md;
  `json-schema-parity.spec.ts` guards it).

**W3 - tool path stops losing facts** (`action-resolution.ts`)
- `renderResponse`: executed -> compact JSON of `outcome.result` (drop `image_url`/`merchant_id`, cap ~6k chars); keep
  rejected/failed strings; delete the per-action switch and the `"تم."` default.
- `resolveAction`: add catalog-with-IDs facts to the action system prompt so IDs can be grounded.

**W4 - meter answered conversations** (`db/schema.ts`, new drizzle migration, `pipeline.ts`, `usage/service.ts`)
- `messages.ai_answered boolean NOT NULL DEFAULT false` (`pnpm exec drizzle-kit generate`; constant default = no table
  rewrite). Smallest representation: billing needs only "did the AI deliver an answer"; the deflection metric is already
  `escalation_reason='unanswerable'`.
- Set `message.aiAnswered = true` only where the AI reply is delivered unflagged: greeting reply, tool-path reply, legacy
  reply (`replyMessages`), order created. Escalations, failures, silence, postbacks, AI-off stay false.
- Compile fallout of the new column: add it to the `saveMessage` upsert `set` (`pipeline.ts:52-60`, otherwise the flag is never
  persisted), to the full `Message` literal in `messages/service.ts:21-36`, and to the test `msg()` helper (`pipeline.spec.ts:13-17`).
- `usage/service.ts`: `conversationsThisMonth` -> `INBOUND AND ai_answered AND created_at >= monthStart`, grouped by
  conversation, ordered by first answered message. **The gate must change shape** (the unanswered current conversation is never in
  that list, so the old `!covered.includes(id)` would lock everyone out):
  `over = answered.length >= limit && !answered.slice(0, limit).includes(conversationId)`. Keeps the "covered again next
  month" semantics. Deletes the intent/model_tier heuristics. Rewrite quota tests `pipeline.spec.ts:31-107`.
- No backfill: existing rows read `false`, so current-month usage resets once for everyone (goodwill; refunds this merchant).

**W5 - pages stop misleading** (`store-knowledge-view.tsx`, `training-client.tsx`; copy only)
- Policies page hint: instructions (prices, tone, shipping) go here, keywords optional. Training page copy (`:123-126`):
  examples teach message *classification*, not reply wording. (No `،` splitting needed: after W1 keywords only affect ordering.)

**Docs:** CLAUDE.md pipeline paragraph (FAQ fallback -> store facts), `docs/nestjs-migration-decisions.md` entry
(placeholder fixed, `needs_human` contract change).

**Follow-ups (not in this change):** `checkReasoningHeavy` (`routing-policy.ts:19-26`) matches `لو` / `بقى` as substrings, so a
polite "لو سمحت سعر التيشيرت بقى كام؟" (or anything containing "الوان", "الوقت", "هيبقى") is escalated *before any model call*
- the same non-answer by another route (fix = whole-word match; needs hand-edits to the golden-pinned `preflight` /
`reasoning_heavy` cases); native tool-calling loop; normalised/embedding `searchProducts`; drop
classify-then-generate for one grounded call; variant editing + product-level stock + stock decrement; price/validation
CHECKs and `updateProduct` null price; delete-or-wire decision for the dead extraction branch and orphaned catalog flow;
portal test box (`answer_text` vs `answer_messages`, demo-pinned endpoint); inbox takeover badge reads `is_human_takeover` but
the API returns `human_takeover`; stale settings copy promising a "choices menu"; AI-off conversations still burn slots until W4;
persona/tone column.

## Verification

**A. Automated** - `pnpm -C backend test` (needs Postgres + Redis), `pnpm -C backend typecheck`, `pnpm -C backend lint`,
`pnpm -C frontend lint` (frontend AGENTS.md makes both lints mandatory). W0 tests must fail before W1-W4 and pass after.

**B. Real-model acceptance** (the only proof the model stops deferring; `fakeAi` cannot show it). API + worker with a real
OpenRouter key. No API creates a conversation (webhooks only; `POST /messages` needs an existing `conversation_id`), so:
create a merchant (`pnpm merchant:key --new "Test"`), add products via the portal, insert one conversation with psql
(`merchant_id`, `customer_ref 'e2e-1'`, `state 'NEW'`, `slots '{}'`, `last_message_at now()`, `channel_connection_id` NULL),
get a token (`POST /auth/key-login`), then `POST /messages` per case and read `answer_messages`:
1. "سعر التيشيرت كام؟" on a plain priced product -> exact price + "جنيه".
2. Product priced only on variants (product price blank) -> each variant's price; a stock-0 variant flagged unavailable.
3. Active offer -> both prices (+ end date); expired offer -> regular price only.
4. Arabizi "si3r el tshirt kam" and misspelling "بكام التيشرت" -> same product.
5. Out-of-catalog item ("عندكم بنطلون؟") and a store-specific unknown ("بتشحنوا للسعودية؟") -> honest answer / support-offer
   buttons, never "هتأكد".
6. A policy typed with Arabic commas and no keywords ("اذكر السعر دائماً بالجنيه") -> visibly shapes the reply.
7. Quota: after cases 1-6 `GET /merchants/me/settings` shows `conversations_used` = only the conversations the AI answered.

**C. Confirm the diagnosis on production** (read-only SQL; fill `<mid>`):
```sql
select id, name, ai_enabled, ai_tool_ordering_enabled from merchants where id = '<mid>';          -- false => legacy path
select count(*) from ai_actions where merchant_id = '<mid>';                                       -- 0 => tool layer never ran
select m.created_at, left(m.normalized_text,60) txt, m.intent, m.model_tier, m.escalation_reason
  from messages m join conversations c on c.id = m.conversation_id
  where c.merchant_id = '<mid>' and m.direction = 'INBOUND' order by m.created_at desc limit 30; -- question/other + DEEPSEEK
select count(*) total, count(price) with_price, count(embedding) with_embedding from products where merchant_id = '<mid>';
select knowledge_type, title, keywords, length(content) from store_knowledge where merchant_id = '<mid>'; -- keywords {} => never retrieved
select count(distinct m.conversation_id) from messages m join conversations c on c.id = m.conversation_id
  where c.merchant_id = '<mid>' and m.direction = 'INBOUND'
    and m.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
    and (m.intent is null or m.intent not in ('spam','reaction') or m.model_tier is null or m.model_tier <> 'RULE'); -- slots used
```

## Decisions built in (override at approval)

- Quota counts only conversations where the AI actually answered (greetings the AI answers still count).
- Unanswerable question: honest reply + the existing "connect me to the team?" buttons (shopper opts in). The bot is not
  auto-paused, so a mistaken flag costs one button, not 30 minutes of silence.
- Stock is shown to the AI as available/unavailable only, never exact quantities.
- `ai_tool_ordering_enabled` stays operator-only; product Q&A no longer depends on it.
- No usage backfill (one-time reset of current-month counts).

## Workaround the merchant can use today (no deploy)

On the Policies page add **one** entry whose "تفاصيل السياسة" lists the prices ("تيشيرت قطن 250 جنيه، بنطلون جينز 600 جنيه ...")
and whose keywords are `سعر, بكام, كام, تمن` separated by **ASCII commas** (not `،`). `"سعر التيشيرت كام؟".includes("سعر")`
matches, so the row becomes `store_info` (top-1) and the model quotes it. Caveats: it is top-1 only, and it must be kept in sync by
hand. Flipping `ai_tool_ordering_enabled` by SQL would **not** help: `renderResponse` still drops the price.

## Reply to forward to the merchant (Arabic, edit freely)

> أهلاً بحضرتك، شكراً على التنبيه. راجعنا المشكلة وتأكدنا منها: الرد الآلي حالياً مش بيقرأ قائمة المنتجات والأسعار اللي
> أضفتها، فبيرد برد عام زي «هتأكد وأرجعلك». ده عيب عندنا في النظام مش في بياناتك، وبياناتك سليمة ومش محتاج تعيد إدخال أي حاجة.
> بنصلحه دلوقتي بحيث البوت يجاوب بالسعر والعرض والمتاح من الكتالوج مباشرة، وكمان هنعدّل احتساب الحد الشهري بحيث المحادثة اللي
> البوت مجاوبش فيها ما تتحسبش.
> لحد ما يوصلك التحديث، حل مؤقت: من صفحة «السياسات» اضغط «إضافة معلومات»، واكتب في التفاصيل أسعار منتجاتك (مثلاً: تيشيرت قطن
> 250 جنيه)، وفي الكلمات المفتاحية اكتب: سعر, بكام, كام, تمن (افصل بينهم بفاصلة إنجليزية , مش العربية ،).

## Manual steps after merge

1. `pnpm build && pnpm db:migrate` on production (adds one boolean column with a constant default; no table rewrite).
2. Restart API and worker.
3. Ask the merchant to resend the question; no data re-entry needed.
4. Run the section C queries before and after to confirm.
