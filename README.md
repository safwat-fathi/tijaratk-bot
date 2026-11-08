# TijaratkBot

Social-commerce automation for Egyptian online sellers: merchants connect their social channels and expose a product catalog through customer DMs, with an optional AI layer that understands Egyptian Arabic and Arabizi.

> Let customers talk naturally in Egyptian Arabic or Arabizi instead of forcing them through rigid menus.

Full product/architecture definition lives in [`TijaratkBot_PRD.md`](./TijaratkBot_PRD.md) (product) and [`TijaratkBot_SRD.md`](./TijaratkBot_SRD.md) (system/architecture). This README documents what's actually implemented in this repo today, which is a subset of that vision — see [Status](#status) below and [`ROADMAP.md`](./ROADMAP.md) for the gap.

## Status

This repo currently implements the **AI message-classification/routing engine** (the SRD's L0/L1/L2 pipeline, §14–§22) plus an early, flag-gated commerce layer (cart, checkout, order creation — reachable only through the AI tool layer, not yet through any dashboard). It does **not** yet implement the full commerce platform described in the PRD/SRD — billing, multi-tenancy, delivery, and a merchant dashboard are still missing.

**Built:**
- Tier 0 rule-based short-circuit (`backend/src/engine/tier0-rules.ts`)
- DeepSeek v4 Flash for all classification and extraction, with a dialect-aware system prompt, self-reported confidence, and structured-output schemas (`backend/src/engine/classification.ts`, `extraction.ts`, `schemas.ts`, `prompts.ts`)
- Pre/post-flight checks (`evaluatePreflight`, `evaluatePostflight` in `backend/src/engine/routing-policy.ts`) flag ambiguous or low-confidence results for human review (`escalation_reason`, `OrderStatus.PENDING_REVIEW`)
- End-to-end pipeline (`backend/src/engine/pipeline.ts`) wired into a real endpoint: `POST /messages` ingests a message for an existing conversation, runs it through the full tiered pipeline, and persists intent/order/escalation data
- Core data models: `merchant`, `conversation`, `message`, `product`, `order`, `labeled_example`
- Product search domain (`backend/src/domains/products`), conversation domain (`backend/src/domains/conversations`)
- Offline clustering job (`backend/src/clustering/`), run nightly by the worker
- A demo frontend workspace at `/demo` (product catalog + message composer + AI insights panel)
- Channel/webhook ingestion: webhook endpoints at `/webhooks/meta` (Facebook + Instagram) and `/webhooks/whatsapp/twilio` (WhatsApp via Twilio) verify, deduplicate, and persist inbound messages, then enqueue them to a BullMQ/Redis worker that runs the existing classification pipeline — `ChannelConnection` rows must be provisioned manually (no onboarding UI yet); outbound replies are not implemented.
- **AI action validator + tool layer** — validator, registry, `AIAction` audit trail; all 9 tool contracts fully functional (`search_products`/`get_product`/`add_to_cart`/`update_cart`/`remove_from_cart`/`get_checkout_state`/`update_customer_info`/`create_order`/`search_store_knowledge`). Opt-in per merchant via `Merchant.ai_tool_ordering_enabled` (off by default); the existing classify→extract→auto-order flow is unchanged for merchants that don't opt in. (SRD §20-21, PRD §14-15)
- **Cart, checkout & order creation** — `Cart`/`CartItem` models (one active cart per conversation), add/update/remove item, checkout-state subtotal, and order creation with product/price snapshotting, atomic order numbers, and retry-idempotency (`backend/src/domains/cart`, `backend/src/domains/checkout`; SRD §25–§27). Reachable only through the AI tool layer above — no HTTP router — and only for merchants with `ai_tool_ordering_enabled=True`. Not built: variant/stock validation, delivery fee calculation, order-status transitions after creation.
- **Store knowledge retrieval (keyword-match MVP)** — `StoreKnowledge` model + keyword-substring search per merchant (SRD §23); answers FAQ/shipping/returns/payment questions from `POST /messages` when no order is produced, and via the `search_store_knowledge` AI tool. Not built: full-text/semantic retrieval, an authoring UI.

**Not yet built** (see `ROADMAP.md` for the full breakdown against PRD MVP scope):
- Multi-tenancy enforcement (the SRD's `Tenant` entity/isolation model)
- Delivery-area/fee service, human handoff
- Merchant dashboard (conversations inbox, order management, AI settings) beyond the `/demo` page
- Billing (base plans, AI add-on, fair-use tracking)

## Architecture

```text
Customer Message
      |
      v
  L0 rules  --(deterministic)--> execute
      |
      v
  DeepSeek v4 Flash (classification + extraction)
      |
      +-- confident + unambiguous --> execute (AUTO_CONFIRMED)
      |
      +-- low confidence / ambiguous / reasoning heavy / repeated correction --> PENDING_REVIEW (escalate to human)
```

- **DeepSeek v4 Flash** (via OpenRouter): sole LLM engine for classification and extraction, driven by a system prompt providing Egyptian Arabic / Arabizi dialect guidance. Low confidence, ambiguous extraction, repeated correction, or reasoning-heavy content flags the order for review. Each reason is a stable string persisted to `Message.escalation_reason`.
- **Embeddings — BAAI/bge-m3** (1024-dim, via OpenRouter): separate from the chat-completion engine, used for semantic search/clustering (`backend/src/engine/embeddings.ts`, `backend/src/clustering/`).
- `backend/src/engine/clients.ts` builds two OpenAI-SDK clients (DeepSeek, embeddings) to communicate with the OpenAI-compatible OpenRouter API.

## Tech stack

**Backend:** TypeScript, NestJS, Drizzle ORM, PostgreSQL + pgvector, BullMQ (Redis), pnpm.
**Frontend:** Next.js 16, React 19, Tailwind CSS 4, pnpm.

## Getting started

### Prerequisites

- Node.js and `pnpm`
- PostgreSQL with the `pgvector` extension available (the baseline migration runs `CREATE EXTENSION IF NOT EXISTS vector`)
- Redis

### Backend

```bash
cd backend
pnpm install
cp .env.example .env   # then fill in DB credentials and AI endpoint/keys
pnpm db:migrate        # fresh database only, see backend/README.md
pnpm start:dev         # API
pnpm worker:dev        # worker: channel messages + nightly auto-learning
```

Config is loaded from `.env` by `backend/src/config.ts`. See `backend/.env.example` for every variable.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## Testing

```bash
cd backend
pnpm test              # needs Postgres (empty, migrated test DB) + Redis
pnpm typecheck
pnpm lint
```

Tests run inside rolled-back transactions and use a scripted fake for AI calls. Pure engine logic is checked against frozen vectors in `docs/contract/golden.json`.

## Project structure

```text
backend/
  src/
    core/       # shared helpers, HTTP error shape
    db/         # Drizzle schema (source of truth)
    engine/     # tier0-rules, classification, extraction, routing-policy, pipeline, embeddings, clients, schemas, action-validator, action-resolution, tools/
    domains/    # auth, messages, products, conversations, channels, cart, checkout, store-knowledge, ... (cart/checkout/store-knowledge are reached via the AI tool layer)
    clustering/ # offline clustering job
    worker/     # BullMQ worker entry + job logic
  drizzle/      # migrations
  test/         # integration tests
frontend/
  app/          # layout, home page, /demo workspace, merchant dashboard
docs/           # contract specs, migration log, reviews
```

## Documentation

- [`TijaratkBot_PRD.md`](./TijaratkBot_PRD.md) — product requirements
- [`TijaratkBot_SRD.md`](./TijaratkBot_SRD.md) — system/architecture requirements
- [`message-classification-ai-engine-spec.md`](./message-classification-ai-engine-spec.md) — narrower technical spec for the classification/routing engine specifically (data model, pipeline, escalation policy, embeddings)
- [`CLAUDE.md`](./CLAUDE.md) — guidance for working in this codebase with Claude Code
- [`ROADMAP.md`](./ROADMAP.md) — what's built vs. what's next
