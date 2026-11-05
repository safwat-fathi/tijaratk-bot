# Merchant Dashboard Remediation

## Summary

- Create `docs/merchant-dashboard-remediation-plan.md` with the review findings and this implementation plan.
- Replace the current demo-backed merchant routes with a session-authenticated dashboard that only displays real backend state.
- Keep the current single Facebook identity per merchant model. Support Facebook only; defer staff roles, WhatsApp connection, payments, analytics, and self-service Page ownership transfers.

## Authentication And Channels

- Make the login button always invoke Facebook Login. Remove the automatic localhost bypass, fabricated `dev_token`, `x-merchant-id` authentication path, and client-readable merchant identity cookies.
- Keep `POST /auth/facebook/callback` as the first-party session endpoint. It verifies the Facebook token, performs a conflict-safe merchant get-or-create, returns the app JWT plus safe available Page metadata, and does not connect Pages automatically.
- Add authenticated Page-management endpoints: connect selected Pages with a fresh Facebook token, list safe connection metadata, and disconnect by disabling the connection and clearing its token.
- Require `pages_show_list`, `pages_manage_metadata`, and `pages_messaging`; show explicit SDK, permission, and provider errors rather than treating them as a successful login with zero Pages.
- Preserve Page ownership: refresh an existing connection only for its owner; reject another merchant’s attempt to claim it.
- Add application-level Fernet encryption for Page access tokens using a required `CHANNEL_TOKEN_ENCRYPTION_KEY`. Add ciphertext and Page display-name columns, backfill existing values during deployment, null legacy plaintext values, redact provider error logs, and later remove the plaintext column after verification.

## Merchant APIs And Data

- Add authenticated merchant profile, settings, dashboard-summary, and safe channel-list responses. Settings may update the existing `Merchant.ai_enabled`; the dashboard summary uses database counts instead of placeholder text.
- Replace the conversation response mismatch with one typed contract containing the real state, channel, latest activity, and takeover flag. Make the list server-filterable and paginated; load persisted messages for the selected conversation.
- Enforce human takeover in the reply API. A direct merchant reply without takeover returns a conflict; a failed Facebook send does not report a sent message.
- Add merchant-scoped order list, detail, and pending-review status actions. Only `PENDING_REVIEW` orders may move to `CONFIRMED` or `REJECTED`.
- Repair manual orders: require an owned existing conversation, validate positive quantities and product/variant ownership, support multiple catalog lines, and remove the fabricated inbound message. Make `Order.message_id` nullable only for `MANUAL` orders, add `orders.created_at`, and preserve the message requirement for AI/cart orders.
- Complete existing API correctness gaps: commit delivery-area mutations, validate product/knowledge inputs, allow clearing nullable product prices, and add owned variant CRUD for the product editor.

## Dashboard Screens

- Consolidate login and onboarding into one Facebook sign-in and Page-selection flow; remove the misleading WhatsApp onboarding path.
- Add a shared server-side backend client that derives identity exclusively from the HttpOnly session cookie. Move merchant actions out of `app/demo`, remove merchant ID/token parameters from client calls, and delete unused client-side cookie/refetch helpers.
- Render initial dashboard data in Server Components. Use small Client Components only for dialogs, mutations, and navigation refreshes.
- Replace placeholder cards with real summary counts and channel state.
- Rebuild Products, Policies, Conversations, Orders, and Settings around their actual contracts:
  - Products: catalog CRUD plus editable variants and availability.
  - Policies: store-knowledge CRUD.
  - Conversations: real history, search/filter, takeover, and outbound reply, with no simulated customer input.
  - Orders: paginated list/detail, review controls, and a manual-order form that selects an existing conversation.
  - Settings: selected Facebook Pages, AI toggle, and existing delivery-area CRUD; no nonfunctional WhatsApp control.

## Proof And Rollout

- Add backend coverage for bearer-only authentication, Page selection/conflicts, encrypted token migration, ownership checks, session races, reply/takeover rules, order invariants, delivery persistence across sessions, and product/variant validation.
- Add focused frontend checks for the session-only action layer and screen error states; validate the complete Facebook flow with a Meta test user and test Page.
- Upgrade the database from the current Alembic head, verify no plaintext Page tokens remain, and retain a database backup before the data migration.
- Run `pnpm -C frontend lint`, `pnpm -C frontend exec tsc --noEmit`, `pnpm -C server lint`, and `pnpm -C server test` with Redis available. Run `graphify update .` after implementation.
- Investigate the existing `next build` Turbopack process-binding failure separately from dashboard behavior; TypeScript currently passes, while the build cannot reach type checking in this environment.

## Assumptions

- Merchants explicitly choose one or more Facebook Pages after sign-in.
- Manual orders always belong to an existing customer conversation.
- Encrypting persisted Page tokens is required before enabling outbound merchant replies in production.
