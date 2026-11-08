# Roadmap

Sourced from `TijaratkBot_PRD.md` (§4–§5, §35, §37) and `TijaratkBot_SRD.md` (§57), reconciled against what's actually in this repo today. See the main [`README.md`](./README.md#status) for the detailed status breakdown.

## Now — built today

- Two-stage AI classification + extraction pipeline (Tier 0 rules + DeepSeek), with escalation telemetry fields (`Message.escalation_reason`)
- Core models: `merchant`, `conversation`, `message`, `product`, `order`, `labeled_example`
- API domains: `health`, `messages` (message ingest → full pipeline), `products`, `conversations`
- Offline clustering job
- Demo frontend workspace (`/demo`): product catalog, message composer, AI insights panel
- **Channel/webhook ingestion & multi-page control** — Facebook, Instagram, WhatsApp (via Twilio) text webhooks with signature verification, deduplication, and a BullMQ worker queue (`webhooks/zernio`, `webhooks/meta`, `webhooks/whatsapp/twilio`). Merchants connect up to 10 Facebook/Instagram pages via Zernio OAuth, control AI replies per page (on/off, temporary pause, per-page style instructions, soft disconnect/reconnect), and view per-page `Africa/Cairo` stats and shared monthly quota breakdowns (`domains/pages`, `/merchant/pages`). (SRD §7, §35–§37)

## Near-term — MVP gap-closers

Everything below is in the PRD's MVP scope (§4) or Success Criteria (§35). Struck-through items have since landed — kept here (rather than moved to "Now") so the SRD/PRD gap accounting stays in one place; each still notes what's left:

- ~~**AI action validator + tool layer**~~ **Built** — validator, registry, `AIAction` audit trail, and 9 of the 11 SRD §21/PRD §15 tool contracts exist (`get_product_variants`/`get_cart` deliberately deferred — no variant model). All 9 are functional (`search_products`, `get_product`, `add_to_cart`, `update_cart`, `remove_from_cart`, `get_checkout_state`, `update_customer_info`, `create_order`, `search_store_knowledge` — the last now backed by a real keyword-match implementation, see **Store knowledge retrieval** below), though `search_store_knowledge`'s result still renders as a generic "Done." via `action_resolution.py`'s response template, and `update_customer_info`'s delivery-area sub-check stubs out pending **Delivery service** below. Gated behind `Merchant.ai_tool_ordering_enabled` (default off; no admin UI yet to enable it per merchant). (SRD §20–§21, PRD §14–§15)
- ~~**Cart & checkout services**~~ **Built** — `Cart`/`CartItem` models (one active cart per conversation, DB-enforced), add/update/remove item, live checkout-state subtotal, and order creation with atomic per-cart idempotency (SRD §25). Reached only through the AI tool layer above (no HTTP router, by design). Not built: variant resolution & stock validation (no variant/stock model yet); delivery fee and a real final total (blocked on **Delivery service** below — `total` == `subtotal` today)
- ~~**Order service hardening**~~ **Built** — customer-info presence validation, product/price snapshotting onto `OrderItem`, and atomic per-merchant sequential order numbers (SRD §26–§27). Not built: delivery-area validation (blocked on **Delivery service** below), order-status transitions after creation, `variant_id`/`variant_snapshot` (no variant model). The legacy AI-extraction path in `pipeline.py` still inserts `Order` rows directly, bypassing this service — SRD §26's "AI cannot directly insert orders" isn't enforced there yet
- **Multi-tenancy** — `Tenant` entity and enforced isolation across all tenant-owned records (SRD §4, §6)
- **Delivery service** — merchant-configured delivery areas/fees (SRD §29)
- ~~**Store knowledge retrieval**~~ **Built (keyword-match MVP)** — `StoreKnowledge` table (FAQ/shipping/returns/exchange/payment/general), keyword-substring search scoped per merchant (SRD §23). Reachable both from `search_store_knowledge` (AI tool-ordering path) and from `POST /messages`'s classify/extract path when no order is produced. Not built: full-text/semantic retrieval, an authoring UI (seed-script-only today).
- **Human handoff** — `HumanHandoff` entity, AI-disable-on-takeover behavior (SRD §31, PRD §13)
- **Merchant dashboard** — conversation inbox, product CRUD UI, order management, AI settings, human takeover controls (PRD §32) — currently only the `/demo` page exists
- **Custom AI Learning** — Simple UI for merchants to provide their own `labeled_examples` (custom intent training) so the AI learns specific business contexts, plus automated learning from previous conversations.
- **Billing** — base plans, AI add-on, fair-use tracking/enforcement (SRD §50–§41, PRD §7, §34)
- **Security baseline** — ~~Authentication root security & token encryption~~ **Built** (Auth fixed via JWTs, tokens encrypted at rest, page ownership conflicts prevented). Not built: full RBAC for the dashboard, audit logging (SRD §42)

## Phase 2 (per PRD §37)

- WhatsApp channel
- Online payment integrations
- Shipping integrations
- Semantic/vector product search
- Better AI recommendations
- Advanced analytics
- Coupons
- More merchant knowledge tools

## Phase 3 (per PRD §37)

- Voice-message understanding
- Image-based product search
- AI sales analytics and customer segmentation
- Automated follow-up
- AI marketing campaigns

## Explicitly out of scope for now (PRD §5)

Not to be pulled forward without a deliberate decision: advanced shipping-company integrations, large-scale marketing/broadcast automation, an advanced coupon/discount engine, a complex VAT engine, QR/web menu, a full web storefront, a large payment-provider ecosystem, advanced analytics, automated marketing campaigns, multi-country localization, enterprise permissions, voice AI, image-generation AI, AI-generated product descriptions, AI-generated advertisements.
