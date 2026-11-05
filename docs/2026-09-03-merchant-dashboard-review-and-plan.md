# Merchant Dashboard — Review & Remediation Plan

Date: 2026-09-03
Scope: merchant dashboard + related screens, APIs, DB, and auth.
Note: `backend/` references below point at the removed FastAPI app; see git history before the `chore/remove-fastapi` branch.
Status: review only — no implementation in this pass.

## 1. Why login goes to dashboard with no Facebook login

`frontend/app/login/page.tsx:18-28`: when `NODE_ENV === "development"` and hostname is `localhost`, clicking "Continue with Facebook" **never calls `FB.login`**. It calls `loginDevBypassAction()`, which sets a literal `access_token: "dev_token"` and `merchant_id: "demo-merchant"` cookie (`frontend/app/login/actions.ts:55-65`) and pushes to `/merchant`.

The proxy (`frontend/proxy.ts:7-12`) only checks that the token cookie **exists** — never validates it — so the dashboard shell opens. Every API call then sends `Bearer dev_token`, which the backend correctly rejects (401). Net effect on localhost today: dashboard UI unlocks, every screen breaks.

Additionally the backend itself trusts two non-JWT identities: an arbitrary `x-merchant-id` header and a configured `AUTH_DEV_BYPASS_MERCHANT_ID` (`backend/app/domains/auth/dependencies.py:23-33`). Both skip the suspended-merchant check. Any direct API caller can impersonate any merchant by ID.

## 2. Architecture as found (verified)

**Auth flow:** FB SDK → server action → `POST /auth/facebook/callback` → `debug_token` + `/me` + `/me/accounts` → get-or-create Merchant by `facebook_user_id` → upsert all pages as `ChannelConnection` → JWT (7-day HS256) → HttpOnly cookie + two client-readable cookies → `getAuthHeaders` (`frontend/app/demo/actions.ts`) → domain routers (bearer correctly derives tenant when present).

**Screen ↔ API map:**

| Screen | Backend | Status |
|---|---|---|
| Overview | none | static placeholders |
| Products | full CRUD | works; variant editing missing |
| Policies | store-knowledge CRUD | works |
| Conversations | list + takeover + reply | contract mismatch; messages never loaded |
| Orders | `POST /orders/manual` only | always 404 (fabricates `conversation_id: "manual-<ts>"`) |
| Settings | none | reads client cookie; hardcodes "Active"; dead WhatsApp button |
| Onboarding | same FB callback | WhatsApp button hits Facebook-only callback |

## 3. Findings (priority order)

### Critical

1. **Full tenant impersonation via `x-merchant-id` header** — `backend/app/domains/auth/dependencies.py:23-27`. Not gated by environment, localhost, or secret; knowing a merchant ID grants full product/policy/conversation/reply/order access.
2. **Silent page re-parenting between tenants** — `backend/app/domains/auth/service.py:42-45` reassigns `existing.merchant_id` on any login. The old tenant can still send via the reparented token through old conversations (reply checks conversation tenant, not connection tenant).
3. **Page tokens stored plaintext** — `backend/app/models/channel_connection.py:30`. DB read access = outbound messaging capability for every connected page.

### High

4. Proxy validates only cookie presence; FE dev bypass stores an invalid token (broken anyway).
5. JWT: 7-day, no revocation; logout deletes cookies only; `AUTH_DEV_BYPASS`/header paths skip suspension.
6. Missing `pages_show_list` scope; granted scopes never verified; `/me/accounts` errors swallowed → login succeeds with `pages_connected = 0`.
7. `fetch_user_pages` has no pagination.

### Medium

8. Conversation contract mismatch: FE expects `channel/status/is_human_takeover/created_at/updated_at` (`frontend/app/demo/actions.ts:322-331`), BE returns `state/slots/last_message_at/ai_enabled/human_takeover` (`backend/app/domains/conversations/schemas.py:6-14`). `fetchMessagesAction` is never called; `MessageComposer` is demo local state reused in the production merchant screen.
9. Manual order: fabricated conversation id → guaranteed 404 (`frontend/app/merchant/orders/orders-client.tsx:36`); fabricates an inbound `Message` row to satisfy a non-null FK; quantity is float with no positive constraint; invalid `variant_id` silently dropped.
10. Reply: persists outbound then returns HTTP 201 even when provider send fails (`sent: false`); no `human_takeover` requirement; no connection-tenant check; FE inserts the message optimistically.
11. Simulated-customer ingest shipped in the merchant conversations UI (`demo/actions.ts:sendMessage` posts to `/messages` with no auth).
12. Merchant get-or-create race → unhandled `IntegrityError` → 500.
13. Client-readable `tijaratk_merchant_id` cookie treated as state; `DEMO_STOPGAP_MERCHANT_ID` fallback header.
14. `.env.example` lists `AUTH_DEV_BYPASS_MERCHANT_ID` populated in one line and empty elsewhere.
15. No frontend tests; backend router tests override `get_current_merchant`, so bearer paths are untested end-to-end.

## 4. Remediation plan (phases; each independently shippable)

### Phase 0 — Stop the bleed: auth root fix

- **Backend:** remove `x-merchant-id` trust from `get_current_merchant`; remove `AUTH_DEV_BYPASS_MERCHANT_ID` fallback; apply the active-status check on all paths.
- **Frontend:** delete `loginDevBypassAction` and the localhost short-circuit; drop `x-merchant-id`/`DEMO_STOPGAP_MERCHANT_ID` fallbacks from `getAuthHeaders` (bearer only); remove the client-readable merchant-id cookie (name cookie may remain display-only).
- **Local dev:** `backend/scripts/seed.py` mints a real JWT for the demo merchant. Alternative (pick one at implementation): a `/auth/dev-token` endpoint gated behind a new `ENV=local` setting with status check. Either way: one mechanism, no header trust.
- **Tests:** header-only request → 401; suspended merchant → rejected on every path; valid bearer → scoped access.

### Phase 1 — Facebook login correctness

- Add `pages_show_list` to the requested scope; verify granted scopes from `debug_token`, not just validity.
- Distinguish provider outage (502/503) from invalid token (401); stop swallowing `/me/accounts` errors into "0 pages connected".
- Handle `IntegrityError` in merchant get-or-create (re-select on conflict).
- Handle Facebook pagination in `fetch_user_pages`.

### Phase 2 — Page ownership & token security

- Callback: if a returned page is already owned by another merchant → **do not re-parent**; report it as a conflict in the callback response. Transfer only via an explicit action (YAGNI until a real case exists).
- Never update an existing owner's page token on another user's login.
- Encrypt `page_access_token` at rest (SQLAlchemy `TypeDecorator` + Fernet; key in settings; migration to encrypt existing rows).
- Frontend: minimal page-selection step that surfaces conflicted pages.

### Phase 3 — API contract & screen repair

- Extend `ConversationRead` with `channel`, `status`, `human_takeover`, and timestamps — one schema fix, all callers align.
- Conversations page: SSR-fetch list and selected conversation's messages in `page.tsx`; stop reusing `demo/MessageComposer`; move "simulate customer" back to `/demo` only.
- **Manual orders root fix:** make the order's conversation/message linkage nullable for `MANUAL` source (schema migration) instead of fabricating rows; enforce positive integer quantity; reject mismatched `variant_id`.
- Reply: require `human_takeover`; verify `channel_connection.merchant_id == conversation.merchant_id`; reflect `sent` in the status code; stop logging provider response bodies.
- Settings: SSR-fetch real `ChannelConnection`s; show truthful `is_active`; remove the dead WhatsApp button.
- Orders screen: add `GET /orders` (merchant-scoped list) and render it.
- Overview: wire real counts via one summary endpoint, or remove placeholders.

### Phase 4 — Session coherence

- Add `GET /auth/me`; merchant layout SSR-validates the token and, on 401/403, clears cookies and redirects to login (proxy stays a shallow presence check).
- Align cookie `maxAge` with `JWT_EXPIRE_MINUTES`.
- Revocation (token-version column): deferred — add when the first log-out-from-all-devices need appears.

### Phase 5 — Tests & docs

- Backend: dependency matrix (Phase 0), callback ownership-conflict tests, scope/pagination tests, per-route matrix (valid bearer / cross-tenant / unauthenticated), manual-order contract tests. One assert-based check per fix, per repo convention.
- Frontend: no test infra exists — add a minimal contract smoke later if needed; skipped for now (noted).
- Update `ROADMAP.md` ("Merchant dashboard" status) and root `CLAUDE.md`; fix the `.env.example` bypass line.

## 5. Explicitly deferred (YAGNI)

- Org/membership/RBAC tenant model → post-MVP (ROADMAP "Multi-tenancy").
- Refresh tokens / revocation list / long-lived FB token exchange.
- Frontend test framework; variant-editing UI; search/filter in the conversation list.
