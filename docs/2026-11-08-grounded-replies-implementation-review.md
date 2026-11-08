# Review: implementation of the grounded-replies plan

Date: 2026-11-08
Scope: working tree vs `docs/2026-11-08-grounded-replies-review-and-plan.md` (W0 to W5). Backend `engine/`, `domains/products`, `domains/usage`, migration `0004`, contract docs, policies/training page copy.
Status: review only. No code was changed; the one temporary probe spec I wrote was deleted.

## Verdict

W1 to W5 are all implemented as planned, and the core fix is sound: the reply generator now receives the catalog, prices, offers, variants, history and all policies. **Nothing blocks the fix itself**, but I would not merge it as is:

1. The working tree also carries a large **unrelated change** (public site and demo deleted, `robots.txt` now blocks the whole domain). Split it out or confirm it.
2. For merchants with **more than 40 products**, the new "say it's not in the catalog" rule can give false negatives (reproduced).
3. Four small, cheap defects in the new code (findings 3 to 6): a pg concurrency misuse, a `$&` replacement bug, a policy that silently vanishes when it is too long, and a tool-mode regression on delivery areas.

Two independent passes were merged here: my own plan-conformance read plus probes, and an `xhigh` `/code-review` run. Items from the second that I re-checked myself are marked *verified*; the rest are marked *reported*.

## What I ran

| Check | Result |
|---|---|
| `pnpm -C backend typecheck` | clean |
| `pnpm -C backend lint` | 0 errors (pre-existing warnings only) |
| `pnpm -C backend test` against a throwaway migrated Postgres (0000 to 0004 applied, DB dropped afterwards) | 17 files, **240 / 240 pass**; the run printed pg's `client.query() ... already executing a query` deprecation warning (finding 3) |
| `pnpm -C frontend lint` / `tsc --noEmit` | 0 errors / clean |
| Probe: 45 products, all embedded, price question | catalog = 8 nearest lines, target product present (nearest-k path works with real pgvector) |
| Probe: 45 products, target has `embedding = NULL`, others embedded | catalog = 8 lines, **target missing**, no "partial list" marker in the prompt (finding 2) |
| `/code-review xhigh` | 16 findings, merged below |
| Real-model acceptance (plan *Verification B*) and production SQL (*C*) | **not run**; the 240 tests use a scripted fake AI, so they prove the facts reach the prompt, not that the model stops deferring |

## Plan conformance

| Item | Status | Notes |
|---|---|---|
| W0 failing tests, `state:'NEW'` | done | `describe('grounded replies')` covers price question, empty-keyword policy, `needs_human`, >40 products, tool-mode price/cart JSON. Pinned tests rewritten. |
| W1 `store-facts.ts`, `catalogForAi` | done | All products if <= 40, else nearest 8, then token `ilike`, then first 40. Policies: keyword matches first, rest oldest-first, 3000-char budget with a warning. Offers go through `resolveUnitPrice`. |
| W2 reply prompt, history, `needs_human` | done | Separate reply preamble, `{merchant_name}` substituted, rules -> facts -> state order, history in the user prompt, `GeneratedReply.needs_human` (golden hand-edited, parity spec passes), `supportOffer` with `escalationReason='unanswerable'` and no auto-takeover. |
| W3 tool path | done | `renderResponse` returns the result JSON (internal keys stripped, capped), catalog with IDs in the action prompt. |
| W4 metering | done | Column + migration + snapshot + journal, upsert `set`, `Message` literal, test helper, new gate shape `answered.length >= limit && !first-N.includes(id)`, heuristics deleted, quota tests rewritten. |
| W5 copy | done | Policies header and keyword hint, training page copy points to Policies. |
| Docs | done | CLAUDE.md paragraph, migration-decisions entry. |

Small deviations from the plan, all harmless: history is rendered for all `CONTEXT_HISTORY_TURNS` (10) rows rather than 5 lines; the migration journal `when` (`1794120000500`) was set by hand instead of by `drizzle-kit generate` (it is monotonic and in the past, so the migrator applies it; the snapshot file is present and `migrate.ts` always applies 0003 and 0004).

## Findings

### 1. Unrelated change mixed into the same working tree (decide before committing)

`git diff --stat` for `frontend/` is **65 files, +474 / -8297**: `app/demo/*`, the blog, FAQ, features and how-it-works pages and their `.md` routes, `llms.txt`, `llms-full.txt`, most of `messages/{ar,en}.json` (226 lines down to 17), plus edits to `app/page.tsx`, `robots.ts`, `sitemap.ts`, `next.config.ts`. On the backend: `DemoController`, `DEMO_STOPGAP_MERCHANT_ID`, `RATE_LIMIT_DEMO_*`, and 116 lines of `openapi.json`. None of this is in the plan (the plan lists the demo-pinned test box only as a follow-up). It looks like another piece of work (there are other sessions on this repo).

- **`robots.ts` now has `disallow: "/"` for every user agent while still advertising `sitemap.xml`, and `sitemap.ts` returns `[]`** (*verified*). Combined with deleting the landing, pricing and blog pages, this de-indexes the whole domain. It is a product/SEO decision, so confirm it is deliberate.
- Split this into its own commit or branch so the grounded-replies change can be reviewed and reverted alone.
- Nothing is broken by it at build level today: the frontend lints and type-checks, and all 14 `m.<key>()` message calls still used in `app/`, `components/` and `lib/` exist in both trimmed JSON files (checked by script, including `demo_knowledge_keywords` on the Policies page). `frontend/paraglide/` is generated and git-ignored; `pnpm build` recompiles it. I did not run `next build`.
- Cleanup if kept: `README.md` (lines 21, 30, 112) and `ROADMAP.md` (lines 11, 25) still describe `/demo`; `ingestInTransaction` in `messages.controller.ts` is still exported but is now used only inside its own file (*verified*).
- Dashboard bugs in the touched frontend files (*reported*, two re-checked). None come from this plan, but the files are in the diff:
  - `conversations-client.tsx` reads `is_human_takeover` while the API returns `human_takeover` (*verified*; already listed in the plan's follow-ups), so an AI-escalated conversation shows no takeover badge and a disabled composer.
  - `<MessageComposer>` has no `key`, so one conversation's sent bubbles carry over to the next (*verified*: no `key=` on it).
  - The composer ignores the `{sent: boolean}` the backend returns (*verified*: no `sent` handling), so a failed delivery looks delivered.

### 2. Large catalogs: false "not in the catalog" answers (medium, both passes)

- `catalogForAi` (`products/service.ts`) filters nearest-8 with `embedding IS NOT NULL`, so a product with a null embedding is **silently excluded** whenever any other product has one. The token fallback only runs if nearest-8 returns *nothing*. Reproduced by the probe.
- `formatCatalog` does not tell the model the list is partial, and reply rule 4 says "if the product is not in the catalog, state clearly that it is not available". A real product that was not retrieved gets "not available", which is worse than the old "I'll check".
- Null embeddings are realistic: the migration log says `reembed_products` was dropped and not ported, so older rows may never have been re-embedded.
- Cheap fix: for >40 products, union the nearest-8 with the token `ilike` matches (same query, no extra API call), and when the list is a subset prepend a line such as `(partial list: N of M products shown; the product may exist if not listed)` and soften rule 4 for that case. Add tests for the nearest-k path and the partial-null case (neither is covered today).
- Related: product `description` is not capped, so the "~2.5k tokens" estimate assumes short descriptions. Truncate to about 120 chars.

### 3. `buildStoreFacts` runs concurrent queries on one transaction client (medium, *verified*)

`store-facts.ts:106` uses `Promise.all` over three queries. Both callers (the worker and `ingestMessage`) pass a **transaction**, i.e. a single pg connection, so the queries are serialised anyway and node-postgres prints `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0` (I saw it in the test run). This is the only `Promise.all` in `src/`. There is no speed-up, and a future pg 9 upgrade would break message processing. `knowledge.search` and `listKnowledge` also read the same `store_knowledge` rows twice.

Fix: await sequentially, and derive the keyword-matched policies from the rows already loaded.

### 4. `{merchant_name}` replacement breaks on `$` in the name (low-medium, *verified*)

`prompts.ts:90` calls `replaceAll('{merchant_name}', p.merchantName)` with a string replacement, so `$&`, `$'`, `` $` `` and `$$` in a merchant name are interpreted. A merchant called `Shop $& Mart` produces `Shop {merchant_name} Mart`, and `Ali$'s` splices text from the template into the prompt. `buildSystemPrompt` in the same file already uses a function replacer for this. Use `replaceAll('{merchant_name}', () => p.merchantName)`.

### 5. An over-long policy disappears and the model is told there are none (medium, read from code)

`formatPolicies` drops any entry that does not fit the remaining 3000 chars, whole, without truncating. A single 3500-char returns policy (including a keyword-matched one) is always dropped, the function then returns `(لا توجد سياسات مسجلة)` ("no policies registered"), and a warning logs on every message. The model then says it has no returns information. Truncate the line to the remaining budget instead of dropping it, and print the "none registered" text only when there are no rows.

### 6. Tool mode lost its delivery-area wording (medium for tool-mode merchants, *verified*)

The old `renderResponse` special-cased `update_customer_info` and said the delivery fee would be confirmed separately when `delivery_validation.status === 'unavailable'`. The tool still returns `{captured, delivery_validation}` (`registry.ts:70`), but it now reaches the reply model as raw JSON, and neither the reply prompt nor the action prompt explains it. The model can say delivery is available or invent a fee for an area the merchant does not serve. Add a rule for `delivery_validation`, or keep the deterministic note. Only `ai_tool_ordering_enabled` merchants are affected.

### 7. Product IDs leak into the reply generator in tool mode (low-medium, both passes)

`pipeline.ts` builds the facts with `withIds: true` and passes the same `facts.catalog` to `generateReply`, so `[product_id=…]` / `[variant_id=…]` UUIDs sit in the customer-reply prompt, which does not forbid echoing them. Format the catalog twice (the formatter is pure) and pass the ID-free text to the reply call.

### 8. Greeting reply is told the store is empty (low-medium, both passes)

The tier-0 greeting path calls `generateAiReply` without `catalog`/`policies`, so the system prompt says `Catalog: (لا توجد منتجات مسجلة)` and `Policies: (لا توجد سياسات مسجلة)`. With rule 4 present the model can answer "hi" with "we have no products", or set `needs_human` and show support buttons on a plain greeting. Omit the STORE FACTS section when both are undefined.

### 9. Offer vs variant price wording (low)

`resolveUnitPrice` lets an explicit variant price win over an active offer, which matches checkout, but the product line announces "offer X instead of Y" while a variant line shows its own price. A variant with no price under an active offer shows the offer price with no "offer" marker. The model may quote the offer for a variant that does not get it. Add one line to the rules or a marker on variant lines.

### 10. Quota is now check-then-act (low-medium, accepted trade-off with a sharp edge)

The slot used to be taken at webhook ingestion; now it is taken when the answer is saved. With limit 10 and 9 answered, two different conversations processed concurrently both pass the check and both get a reply. The one that ends up 11th in first-answer order then hits `isOverConversationLimit` on its **next** message and the bot goes silent mid-conversation after having answered once. Fine for a soft free-plan cap, but worth knowing; a row lock or advisory lock per merchant would close it. A conversation that always ends in `needs_human` is never metered but still costs a model call per message, which matches the plan's "decisions built in".

### 11. Usage resets once for every merchant (planned, optional mitigation)

The new column defaults to `false` with no backfill, so `conversations_used` drops to 0 mid-month for everyone and merchants already past the limit regain a quota. The plan chose this on purpose ("goodwill"). If you would rather not, a one-time `UPDATE messages SET ai_answered = true` for this month's inbound messages that have an OUTBOUND reply in the same conversation would approximate the old counts.

### 12. Smaller notes

- `resolveAction`'s `facts ??` fallback (and the extra currency column it needed) is dead code: the only caller always passes `facts`. Make the parameter required and delete the fallback.
- `generation.ts` `renderHistory` re-implements the `customer:` / `merchant:` formatting that `buildContextPrompt` already has (`context-budget.ts`). Export one formatter and reuse it.
- `pipeline.spec.ts:374` asserts `not.toContain('No store_info is available')` on a prompt that can no longer contain it, so it cannot fail. The tests also miss the nearest-8 path, the partial-null-embedding case, and the limit-1 quota boundary (9 answered -> a new conversation is allowed).
- The «لا، القائمة الرئيسية» button on the `needs_human` offer is safe: `main_menu` still answers «تحب أساعدك إزاي؟» (`postback-router.ts:67`).

## Before merge

1. Decide on finding 1 (split or confirm, especially `robots.ts`), then re-run `pnpm -C backend test`, typecheck, and both lints on the final tree.
2. Fix findings 2 to 5 (all small and local); fix 6 if any merchant uses tool ordering. Findings 7 to 9 and the notes are one-liners worth bundling.
3. Run plan *Verification B* with a real OpenRouter key (the only proof the model quotes prices instead of deferring), then *Verification C* on production, then `pnpm build && pnpm db:migrate` and restart API + worker.
