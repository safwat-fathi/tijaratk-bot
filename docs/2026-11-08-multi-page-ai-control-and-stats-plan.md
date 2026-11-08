# Multi-page: per-page AI control and per-page stats

Plan only. Nothing is implemented. **On approval: copy this file to `docs/2026-11-08-multi-page-ai-control-and-stats-plan.md` and stop. Implementation starts only on an explicit go.**

Design scope: the new visual direction in section 4 is deliberately limited to the Pages area and its sidebar group (you said to ignore the current look, and I read that as "design this feature fresh", not "redo the whole portal"). Say so if you want it applied to the entire portal.

## 1. Context

A merchant today connects one Facebook identity and sees one flat settings screen: one AI switch for everything, no stats, a conversation list that cannot tell pages apart. Merchants who run several pages or an Instagram account next to a Facebook page (a brand page plus a wholesale page, a shop plus a clearance page) need to treat each page as its own small business: turn the AI off on one while it keeps answering on another, and see how each page is doing.

What the code already gives us (verified by reading it):

- `channel_connections` is the page table. A merchant can already have many rows; the only unique key is `(channel, external_account_id)`, global across merchants. No per-merchant cap, no plan table.
- `conversations.channel_connection_id` already links every webhook-created conversation to its page. Messages and orders reach the page through the conversation.
- All AI gating is merchant-level and lives in one place: `engine/pipeline.ts` lines ~202-245 (`merchants.ai_enabled`, quota, `conversations.ai_enabled`, `human_takeover`). The worker has no gating of its own.
- No analytics endpoint exists. `ai_usage_events` is written but never read. `messages.ai_answered` (migration 0004) already defines "AI handled this conversation" for the quota.
- `/auth/me` returns pages without their id, so the frontend cannot address a page. `GET /conversations` has no page field and no filter. There is no disconnect endpoint.
- Frontend: Next 16 App Router, Tailwind v4, hand-rolled components, no chart library, no UI kit, no dark mode, no frontend tests, hard-coded Arabic strings, RTL. Data is fetched in server components, mutations are server actions (`frontend/CLAUDE.md`, `AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next code).

The job is therefore mostly new surfaces: a per-page settings model, one gating change, a stats service, and a new "My pages" area designed from scratch.

## 2. Decisions I made (flag any you disagree with)

| # | Decision | Why |
|---|----------|-----|
| D1 | The merchant-level `ai_enabled` stays as a master switch. Effective AI on a page = master on AND page on AND not paused AND not over quota. | Keeps the existing Settings toggle and contract working; gives "stop everything" in one tap. |
| D2 | The free-plan quota stays per merchant (default 10 AI conversations a month, `FREE_PLAN_MONTHLY_CONVERSATIONS`). The Pages overview shows the shared usage and each page's share of it. | No plan model exists; per-page quotas would let one page starve the others with no way to rebalance. Because the quota is shared, `over_quota` will be the most common reason a page goes quiet, so it must be visible, not buried. |
| D3 | Conversations with `channel_connection_id = null` (only created by `POST /messages` and tests) use merchant settings and are excluded from per-page stats. | They are not a page. |
| D4 | Soft cap of 10 active pages per merchant, constant in `config.ts`, checked in `connectAccount`. Re-connecting an owned account always passes. | Abuse guard; real caps wait for a plan model. |
| D5 | Only FACEBOOK and INSTAGRAM connections are "pages". WhatsApp/Twilio rows are hidden from the new UI. | WhatsApp has no outbound path (`deliver.ts`). |
| D6 | "Disconnect" is soft for our data: `is_active=false`, history, conversations and stats stay readable, and inbound is dropped by `findConnection`. It also asks Zernio to detach the account if Zernio offers a call for that (step 0d). A different merchant may later claim an *inactive* row once Zernio has verified the account. | Today the global `(channel, external_account_id)` key plus the `merchantId`-guarded upsert would lock a disconnected page to its old merchant forever, and the account would stay attached to the shared Zernio profile. |
| D7 | Pause is a timestamp (`ai_paused_until`), not a scheduler. State is computed by comparing to now. | No cron, no job, self-healing. |
| D8 | No chart library. Sparklines and the daily chart are small inline SVG. | One chart type, a few dozen lines; avoids a dependency. |
| D9 | No global page switcher. The sidebar lists pages under "My pages" (with status dots) and conversations/orders get a page filter. | Same navigation job, far less state to keep in sync. |
| D10 | Catalog and store policies stay merchant-wide. Per-page catalogs are a non-goal for v1. | `store-facts.ts` loads them for the merchant; scoping them is a separate project. |
| D11 | Western digits (0-9) with tabular figures, even in Arabic UI. | Matches how Egyptian merchants read prices and phone numbers. |
| D12 | Per-page instructions text (Phase 4) is optional and shippable separately. | It touches the reply prompt, the riskiest file set. |

## 3. Vocabulary

- **Page**: a connected Facebook page or Instagram account (a `channel_connections` row). Arabic: "صفحة" for both; the platform badge tells them apart.
- **AI state** of a page, computed by the server and shown as one word: `on`, `paused`, `off`, `master_off` (merchant switch is off), `over_quota`.
- **Handled by AI**: a conversation with at least one inbound message where `ai_answered` is true in the range. Same definition as the quota (`domains/usage/service.ts`).

## 4. Experience design

### 4.1 Direction

Subject: Egyptian shop owners running Facebook and Instagram pages, mostly on a phone, reading Arabic right to left, who think of the AI as an employee answering the door. The design idea: **each page is a shop with a sign on the door.** The one memorable element is the page's AI switch, drawn as an open/closed sign with a status lamp: "الذكاء الاصطناعي يرد الآن" (lit green) versus "متوقف — أنت من يرد" (unlit stone). Everything else is quiet.

Scope: the new tokens and components apply to the new Pages area and the sidebar group. The rest of the portal keeps its current look for now; the tokens are defined in `globals.css` so other screens can migrate later. This is deliberate: we are not redesigning Products or Orders in this feature.

Tokens (added to `frontend/app/globals.css` `@theme`, no new files):

| Token | Value | Role |
|-------|-------|------|
| `--color-canvas` | `#EEF3F1` | page background, sea-glass grey-green |
| `--color-surface` | `#FBFDFC` | cards and sheets |
| `--color-ink` | `#16222E` | text |
| `--color-ink-soft` | `#5B6B78` | secondary text (4.5:1 on surface) |
| `--color-nile` | `#0E7C66` | AI on, primary action |
| `--color-nile-wash` | `#DDF1EA` | AI-on background tint |
| `--color-saffron` | `#E8A317` | paused (lamp and bar only) |
| `--color-saffron-ink` | `#7A4E00` | paused text (passes contrast on wash) |
| `--color-stone` | `#8793A0` | AI off lamp and bar |
| `--color-poppy` | `#C8402F` | destructive and disconnect |
| `--color-line` | `#D8E1DD` | 1px dividers, only where a boundary carries meaning |

Chart: handled-by-AI in `nile`, all conversations in `line`. Nothing else is coloured. Platform marks use the platform colour only on the small monogram tile.

Type: Tajawal (already loaded) for body. Readex Pro (Arabic + Latin, variable) for page names, numbers and the headline sentences, loaded in `layout.tsx` next to the existing fonts. Numbers use `tabular-nums`. Sentence case, no all-caps, no eyebrow labels above headings.

Shape: cards have `rounded-2xl`; controls `rounded-lg`; the AI sign is a pill. Not every box is a card: the stats on the detail page are a sentence and a definition list, not a grid of tiles.

Motion: the only decorative motion is the switch: the lamp fills and a 150 ms glow when AI turns on. Everything else responds to a tap. `prefers-reduced-motion` removes the glow transition.

### 4.2 Information architecture

```
Sidebar (right side, RTL)
  Overview
  My pages            <- new group, expands to list pages (dot = AI state)
     • Shop (FB)       [green dot]
     • Shop (IG)       [green dot]
     • Wholesale (FB)  [stone dot]
  Products / Policies / Orders / Conversations / Training / Settings

/merchant/pages                 all pages: cards or comparison table
/merchant/pages/[id]            one page: Performance | AI replies | Conversations | Connection
/merchant/conversations?page=   filter + page badge on every row
/merchant/orders?page=          filter (Phase 3, if orders carry the link)
/merchant/settings              keeps the master AI switch; channel cards move out
```

### 4.3 Screens

**A. Pages overview** (`/merchant/pages`). Mobile first, one column; two columns from `md`, three from `xl`.

```
+--------------------------------------------------------------+
| My pages                         [Cards | Compare]  [7 days v]|
| 3 pages · AI is answering on 2                [+ Add a page]  |
| This month: 7 of 10 AI conversations used  (Shop FB 4 · Shop |
| IG 2 · Wholesale 1)                         [See plan]        |
+--------------------------------------------------------------+
| (banner, only if master off)                                  |
| AI is off for all pages from Settings.      [Turn on]          |
+--------------------------------------------------------------+
| +-----------------------------+ +-----------------------------+|
| | [S] Shop            FB      | | [S] Shop            IG      ||
| |     ( o AI is replying )    | |     ( o AI is replying )    ||
| |                             | |                             ||
| | AI handled 4 of 9           | | AI handled 2 of 3           ||
| | conversations (44%)         | | conversations (67%)         ||
| | ~~~~sparkline 7 days~~~~    | | ~~~~sparkline 7 days~~~~    ||
| | 2 orders · 850 EGP          | | 1 order · 400 EGP           ||
| | [ Open page ]    [ Pause v ]| | [ Open page ]    [ Pause v ]||
| +-----------------------------+ +-----------------------------+|
| +-----------------------------+ +- - - - - - - - - - - - - - -+|
| | Wholesale           FB      | |  + Add a page               ||
| |  ( o AI is off — you reply )| |  Facebook · Instagram       ||
| +-----------------------------+ +- - - - - - - - - - - - - - -+|
| Disconnected pages (1)  v     <- collapsed list with Reconnect |
+--------------------------------------------------------------+
```

- The card's first job is the sign: monogram tile, name, platform badge, and the AI sign (lamp + words) which is itself the switch. The headline is a plain sentence ("AI handled 128 of 161 conversations (80%)"), not a number-in-a-box.
- Pause menu: "Pause for 1 hour", "Pause for 8 hours", "Pause for 24 hours", "Turn off", and (when paused) "Resume now".
- Turning off does not ask for confirmation. It shows a toast with Undo ("AI turned off on Wholesale · Undo"). Turning on is immediate.
- Compare view: one row per page, columns: page, AI state, conversations, handled by AI, handled %, orders, revenue, 7-day sparkline. Click a header to sort. On mobile each row becomes a stacked card with the same fields.
- Quota line: when usage reaches the limit the line turns into the `over_quota` explanation and each page card shows "Monthly limit reached" as its state. Per-page share uses the **same UTC month start** as `domains/usage/service.ts` so the shares add up to the quota number. The 7-day/30-day charts and range stats use Cairo days; the plan accepts that the two boundaries differ and the UI labels the quota line "this month".
- Empty state (no pages): "Connect your first page so the AI can start answering customers." with two buttons, Facebook and Instagram.
- "Add a page" opens a small sheet choosing the platform, then the existing OAuth redirect. On return the new card is highlighted for a few seconds and a toast confirms ("Shop connected. The AI is on.").
- Pages hit by the D4 cap show an inline message instead of the button ("You can connect up to 10 pages.").

**B. Page detail** (`/merchant/pages/[id]`). Header: monogram, name, platform badge, the same AI sign/switch, range chips (Today, 7 days, 30 days). Four tabs as real links (`?tab=`) so they work server-side and are shareable.

```
+--------------------------------------------------------------+
| <- My pages                                                   |
| [S] Shop · Facebook                (o AI is replying)  [Pause]|
| Today | 7 days | 30 days                                       |
+--------------------------------------------------------------+
| Performance | AI replies | Conversations | Connection          |
|--------------------------------------------------------------|
| In the last 7 days the AI handled 128 of 161 conversations.   |
| 14 needed you.                                                |
|                                                               |
|   |        ||                                                 |
|   |  ||    ||   ||                                            |
|   || ||  | ||   ||  |       daily bars: all (grey), AI (green) |
|   Sat Sun Mon Tue Wed Thu Fri                                 |
|                                                               |
|  Conversations           161      vs previous 7 days  +12%     |
|  Handled by AI           128                          +9%     |
|  Needed you               14                          -3%     |
|  Orders                   12                          +2      |
|  Revenue            8,450 EGP                         +5%     |
+--------------------------------------------------------------+
```

- The headline sentence is generated from the numbers; the bars have an accessible text table (`<table class="sr-only">`) behind them.
- Deltas compare to the previous period of equal length. "Needed you" is the count of conversations that ended in a human handoff or carried an escalation reason (exact source confirmed in step 0).
- Tab "AI replies": 
  1. State: a three-way segmented control, "Replying", "Paused", "Off". Paused reveals the duration choices and shows "Resumes at 6:30 PM" when active.
  2. A read-only note: "Products and policies are shared by all your pages" with links to Products and Policies. This answers the obvious question about scope.
  3. Phase 4 only: "Notes for this page" textarea (500 characters, counter) with the helper "Tell the AI what this page is for. It never changes prices or policies."
  4. If master off or over quota, the controls are disabled and a line explains why and links to Settings or Usage.
- Tab "Conversations": the existing list/chat components with this page pre-filtered.
- Tab "Connection": status, connected date, platform account name, "Reconnect" and "Disconnect page". Disconnect opens a modal in plain words: "The AI stops answering on Shop. Your conversations and numbers stay here, and you can reconnect any time." Button text "Disconnect Shop" (action named the same in the toast: "Shop disconnected").

**C. Conversations.** Each row gets a small monogram + page name instead of the raw "FACEBOOK" pill. Above the list: page chips ("All", then each page). Selecting a chip sets `?page=`. A conversation from an inactive page shows a "Page disconnected" note and disables the reply box (the API returns a clear error too).

**D. Sidebar and dashboard touches.** "My pages" group as in 4.2; dashboard's "connected channels" card becomes "Pages live: 2 of 3" linking to `/merchant/pages`. Settings keeps the master switch relabelled "Turn the AI off on all pages"; the channel cards move to the Pages area, and `/merchant/settings?connected=...|error=...` redirects to `/merchant/pages?...` so `ZERNIO_RETURN_URL` needs no change.

### 4.4 States, copy and accessibility

- Every state is shown as words plus lamp, never colour alone: "AI is replying", "Paused until 6:30 PM", "AI is off — you reply", "Off for all pages", "Monthly limit reached".
- Switch: a real `<button role="switch" aria-checked>`; name includes the page ("AI replies on Shop"). Result announced through an `aria-live="polite"` region.
- Touch targets at least 44 px, visible focus ring in `nile`, text contrast at least 4.5:1 (saffron text uses `saffron-ink`), layout verified at 360 px and 1280 px in RTL, no horizontal scroll.
- Errors say what happened and what to do: "Could not turn off the AI on Shop. Check your connection and try again." Optimistic switch rolls back on failure.
- Loading: server-rendered, so no skeleton on first paint; a skeleton row only for tab changes via `loading.tsx`.
- Key copy (Egyptian Arabic is the shipped text; wireframes above use English for readability). Same verb for button, toast and state:

| Where | English | Arabic |
|-------|---------|--------|
| State on | AI is replying | الذكاء الاصطناعي بيرد دلوقتي |
| State paused | Paused until {time} | واقف مؤقتًا لحد {time} |
| State off | AI is off — you reply | متوقف — إنت اللي بترد |
| State master off | Off for all pages | متوقف على كل الصفحات |
| State over quota | Monthly limit reached | خلّصت ردود الشهر |
| Pause menu | Pause for 1 hour / 8 hours / 24 hours; Resume now | إيقاف ساعة / ٨ ساعات / ٢٤ ساعة؛ تشغيل الآن (digits shown as 1 / 8 / 24, D11) |
| Toast, turn off | AI turned off on {page} · Undo | وقفنا الرد على «{page}» · تراجع |
| Toast, turn on | AI is replying on {page} | الرد شغّال على «{page}» |
| Disconnect modal | The AI stops answering on {page}. Your conversations and numbers stay here, and you can reconnect any time. | الذكاء الاصطناعي هيبطّل يرد على «{page}». محادثاتك وأرقامك هتفضل موجودة وتقدر تربطها تاني في أي وقت. |
| Disconnect button / toast | Disconnect {page} / {page} disconnected | فصل «{page}» / اتفصلت «{page}» |
| Empty state | Connect your first page so the AI can start answering customers. | اربط أول صفحة عشان الذكاء الاصطناعي يبدأ يرد على عملائك. |
| Cap message | You can connect up to 10 pages. | تقدر تربط لحد ١٠ صفحات (shown as 10). |
| Toggle error | Could not turn off the AI on {page}. Check your connection and try again. | معرفناش نوقف الرد على «{page}». اتأكد من النت وجرّب تاني. |

- Arabic strings: this feature's strings go in one object per screen (`pages-copy.ts` next to the page), not new paraglide keys, because the merchant UI is not on paraglide today. Revisit when the portal gets i18n.

## 5. Backend design

### 5.1 Schema (migration `0005_page_ai_settings.sql`, generated by `pnpm exec drizzle-kit generate`)

On `channel_connections`:

- `ai_enabled boolean not null default true`
- `ai_paused_until timestamptz null`
- `ai_instructions text null` (Phase 4; omit from the first migration if Phase 4 is deferred)
- `connected_at` is not needed: `created_at` exists.

Defaults make existing behaviour identical, so there is no backfill. Add index `ix_ai_usage_events_created_at` only if stats ever read cost (not in v1, so skip). Check the `messages` and `conversations` query plans in step 3; add a composite index only if EXPLAIN shows a scan problem.

### 5.2 One source of truth for AI state

New pure function in `backend/src/domains/pages/ai-state.ts`:

```ts
pageAiState({ merchantAiEnabled, overQuota, page, now }): 'master_off' | 'over_quota' | 'off' | 'paused' | 'on'
```

Order of precedence: `master_off`, `over_quota`, `off`, `paused`, `on`. It is used by the pipeline and by the API response (`ai_state`), so the UI never re-implements the rules. Unit-tested with no DB.

### 5.3 Pipeline change (`backend/src/engine/pipeline.ts` ~202-245)

- Extend the existing merchant select to also read the conversation's connection (`ai_enabled`, `ai_paused_until`, later `ai_instructions`) with a left join on `conversation.channelConnectionId`.
- Compute `info.aiEnabled` from `pageAiState(...) === 'on'` so the existing uses at lines ~255, ~262, ~272 need no change.
- Extend `skipReason` with `page_ai_off` and `page_paused` (log lines stay greppable, same as the recent silent-skip logging commit).
- Null connection: use `merchantAiEnabled && !overQuota` (D3).
- Postbacks stay deterministic and ignore the switch, as today.
- The worker needs no change.

### 5.4 API (new domain `backend/src/domains/pages/`: `service.ts`, `stats.ts`, `pages.controller.ts`, `ai-state.ts`; register in `app.module.ts`; zod bodies via `parse` from `core/http`)

| Route | Purpose |
|-------|---------|
| `GET /pages?range=today\|7d\|30d` | Also returns `usage: { used, limit, by_page: [{id, used}] }` for the shared monthly quota (UTC month, via a page-aware variant of `conversationsThisMonth`). Active FB/IG pages with `id, channel, account_name, is_active, created_at, ai_enabled, ai_paused_until, ai_state` plus a summary and a daily series each. Disconnected pages in a separate `disconnected` array. |
| `GET /pages/:id?range=` | One page, same fields, plus summary, previous-period summary and daily series. 404 for another merchant's page. |
| `PATCH /pages/:id/ai` | Body `{ ai_enabled?: boolean, pause_hours?: number \| null, ai_instructions?: string \| null }`. `ai_enabled: true` clears the pause; `pause_hours: n` sets `ai_paused_until = now + n h` (max 72); `null` clears it. |
| `POST /pages/:id/disconnect` | Sets `is_active=false`. Idempotent. |

Also change:

- `GET /auth/me`: add `id` to each `channels` item (update `test/routes.spec.ts` which uses exact `toEqual`).
- `GET /conversations`: add `channel_connection_id`, `page_name`, `page_channel`, and an optional `?page=` filter. Additive, so `docs/contract/openapi.json` still passes; add the new paths by hand to that file.
- Merchant reply (`conversations.controller.ts` ~55-62): refuse with a clear `{detail}` when the conversation's page is inactive.
- `zernio-connect.controller.ts connectAccount`: enforce the D4 cap before the insert. Review line ~135 (retiring legacy token rows) against multi-page: it only touches token-bearing rows of the same channel, so it should stay correct; add a test.

### 5.5 Stats definitions (`pages/stats.ts`, one grouped query for the overview, one for the series)

All per page, in `Africa/Cairo` days (`date_trunc('day', created_at at time zone 'Africa/Cairo')`), range ends now:

| Metric | Source |
|--------|--------|
| Conversations | distinct conversations with an INBOUND message in range |
| Handled by AI | distinct conversations with an INBOUND `ai_answered` message in range (same as quota) |
| Handled % | handled / conversations, 0 when none |
| Needed you | conversations in range with a human handoff or a message `escalation_reason` (exact column confirmed in step 0 against `human_handoffs`) |
| Orders and revenue | `orders` joined by `conversation_id`; manual orders without a conversation are not attributed to a page |
| Daily series | the first two metrics bucketed by day |
| Previous period | same queries shifted back one range length |

Not in v1 (YAGNI): median response time, AI cost, escalation-reason breakdown, per-product stats.

### 5.6 Phase 4: page instructions

`generateReply` / `buildReplySystemPrompt` (`engine/generation.ts`, `engine/prompts.ts`) and the tool path (`action-resolution.ts`) take an optional `pageNote`. It is added as a clearly delimited, lowest-priority block ("style and context only; never change prices, policies or availability; facts come from the store data"), consistent with the grounded-replies rules in `docs/2026-11-08-grounded-replies-*.md`. Cap at 500 characters, stripped of control characters. Must be covered by a prompt test in the style of `engine/reply-prompt.spec.ts`.

## 6. Frontend implementation map

Follow `frontend/CLAUDE.md`: server components fetch, `"use client"` only in leaf components, mutations via server actions with `revalidatePath`. Read the Next docs in `node_modules/next/dist/docs/` before writing routes.

New files:

- `frontend/app/merchant/pages/page.tsx` (+ `loading.tsx`), `.../pages/[id]/page.tsx`
- `frontend/app/merchant/pages/_components/`: `ai-sign.tsx` (client; optimistic switch with `useOptimistic`, toast with Undo), `page-card.tsx`, `compare-table.tsx`, `sparkline.tsx` and `daily-bars.tsx` (inline SVG, server-renderable), `pause-menu.tsx` (client), `add-page-sheet.tsx` (client), `disconnect-dialog.tsx` (client, reuses `components/ui/modal.tsx`), `monogram.tsx`
- `frontend/lib/pages.ts` (types) and server actions added to `app/merchant/actions.ts`: `getPages`, `getPage`, `setPageAi`, `disconnectPage`, `connectPlatformAction(platform)` (generalises the hard-coded `connectFacebookAction`)

Changed files:

- `app/globals.css` (tokens), `app/layout.tsx` (Readex Pro), `app/merchant/sidebar-client.tsx` (My pages group, fed by `getCurrentMerchant`), `lib/dal.ts` (channels now include `id`)
- `app/merchant/page.tsx` (pages-live card), `app/merchant/settings/page.tsx` (remove channel cards, relabel master switch, redirect connect params to `/merchant/pages`)
- `app/merchant/conversations/*` (page chips, badge, disabled reply for inactive page)

## 7. Delivery steps

Work on a fresh branch. The working tree currently has uncommitted edits in `engine/generation.ts`, `engine/pipeline.ts`, `engine/prompts.ts`, `engine/tools/registry.ts`, `test/pipeline.spec.ts`, `reply-prompt.spec.ts` plus untracked `engine/gender.ts`. Those files overlap with this feature, so commit or stash that work first.

0. **Verify unknowns** (read-only): (a) how Zernio's OAuth callback behaves when the merchant picks a second page, or an Instagram account, on the same Facebook login: does `/zernio/callback` receive one `accountId` or several, and does `GET /merchants/me/connect/:platform` return `{connected}` for already-linked accounts? Read the Zernio docs and test against the sandbox. (b) exact columns of `human_handoffs` and `orders.total` for the stats. (c) `botSentRecently` is keyed only on `customerRef`; confirm customer refs cannot collide across two pages, otherwise key it on the connection too. (d) whether Zernio has a disconnect/delete call for an account on the shared profile; if yes, `POST /pages/:id/disconnect` calls it, and `connectAccount` lets a different merchant claim an inactive row after Zernio verifies the account (today the `merchantId`-guarded upsert returns `account_in_use` forever).
1. **Backend foundation**: schema + migration 0005, `ai-state.ts` with unit tests, pipeline gating, `/auth/me` ids, conversation list fields + filter, inactive-page reply guard, cap, disconnect. Tests: `pipeline.spec.ts` (page off, page paused, pause expired, master off beats page on, null connection), `routes.spec.ts`, `zernio.spec.ts` (second page, cap, reconnect after disconnect, a different merchant claiming a disconnected page, still `account_in_use` for an active one, legacy retirement), `contract.spec.ts` paths.
2. **Stats API**: `stats.ts` + `GET /pages`, `GET /pages/:id`, `PATCH /pages/:id/ai`, `POST /pages/:id/disconnect`. Tests with seeded conversations across two pages, a month boundary, a Cairo-midnight message, a page with no traffic, and cross-merchant 404.
3. **Frontend**: tokens, sidebar group, overview (cards, compare), detail (Performance, AI replies, Connection), conversations filter, settings cleanup, add-page flow.
4. **Page instructions** (optional): migration column, prompt plumbing on both paths, prompt tests, textarea in the AI replies tab.
5. **Docs**: update `ROADMAP.md`, root `CLAUDE.md` (pages domain, per-page gating, `Connection` vs "page" wording), `docs/contract/openapi.json` by hand for new paths, and note the change in `README.md`.

Each step ends with `pnpm lint`, `pnpm typecheck` (backend) and, for frontend, `pnpm -C frontend lint` and `pnpm -C frontend build`.

## 8. Verification

Automated: `pnpm test` in `backend/` (needs the disposable Postgres and Redis), `pnpm lint`, `pnpm typecheck`, `pnpm build`; frontend `lint` and `build`. There is no frontend test harness and this plan does not add one; UI is verified by hand below.

End to end, on a local stack (`pnpm start:dev`, `pnpm worker:dev`, frontend dev server):

1. Seed one merchant with three connections (two Facebook, one Instagram). Post Zernio-shaped webhooks to `/webhooks/zernio` for each account with the scripted fake AI. Confirm replies go out on all three.
2. Switch the AI off on page B from the UI. Resend: page A replies, page B does not, log shows `page_ai_off`. Pause page A for 1 hour, then move the clock (or set `ai_paused_until` in the past) and confirm it resumes.
3. Turn the master switch off in Settings: all pages show "Off for all pages" and their switches are disabled. Turn it back on.
4. Disconnect page C: inbound is dropped, history still visible, reply box disabled, reconnect reactivates it.
5. Compare the stats screen against SQL counts for each page and range, including a message sent just after Cairo midnight.
6. Drive the UI with chrome-devtools: screenshots at 360 px and 1280 px in RTL, keyboard-only pass over the switch, pause menu, and dialog, reduced-motion on, console clean, Lighthouse accessibility pass on `/merchant/pages`.

## 9. Risks

- **Zernio multi-page behaviour is unverified** (step 0a). If the callback yields one account per OAuth round trip, "Add a page" simply repeats the flow per page; if it yields several, `connectAccount` must loop. This changes step 3's connect work, not the model.
- **Overlap with uncommitted engine work** (see section 7). Rebase risk in `pipeline.ts`.
- **Stats cost**: aggregation over `messages` joined to `conversations` per request. Fine at current volume; revisit with a daily rollup table only if EXPLAIN or timing says so.
- **Attribution holes**: manual orders and null-connection conversations are not in page stats. The UI footnote should say so on the Orders figure.
- **Master/page confusion**: mitigated by the computed `ai_state` and the explanatory banner and disabled controls.

## 10. Non-goals

Per-page catalogs or policies, per-page quotas or billing, WhatsApp pages, profile pictures from the platforms, scheduled business hours, a global page switcher, a chart library, redesigning the rest of the portal, frontend test harness, cost and latency dashboards.
