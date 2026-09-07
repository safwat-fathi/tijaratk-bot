# Graph Report - tijaratk-bot  (2026-09-07)

## Corpus Check
- 352 files · ~465,491 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2146 nodes · 4587 edges · 180 communities (167 shown, 13 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 305 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a0c0671`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dispatch_action
- test_meta.py
- Order
- TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md
- match_variant_hint
- delivery/router.py
- app/page.tsx
- OutboundMessage
- handoff/router.py
- devDependencies
- demo/actions.ts
- process_message
- compilerOptions
- StoreKnowledge
- complete
- ingest_message
- ConvState
- get_db
- evaluate_preflight
- get_current_merchant
- AsyncClient
- build_context_prompt
- create_access_token
- conversations/router.py
- classify_message
- match_tier0
- settings.json
- FastAPI
- conftest.py
- TijaratkBot_SRD.md
- TijaratkBot_PRD.md
- logging.py
- health_check
- login/actions.ts
- 1511b3371e51_add_ai_usage_events_table.py
- 2d17ac4bd857_add_classification_schema.py
- fb2585d043c4_add_missing_fk_and_intent_indexes.py
- Settings
- opencode.json
- graphify.js
- testimonials.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- tijaratk-bot
- products/router.py
- Backend review & remediation plan — classy-arabic (`backend/`)
- TijaratkBot AI Engine — Correctness, Gateway, Observability & Evaluation Implementation Plan
- AI Action Validator + Tool Layer Implementation Plan
- Public Demo Page Security Hardening Implementation Plan
- Global Constraints
- Channel Ingestion (Facebook, Instagram, WhatsApp Webhooks) Implementation Plan
- Classification Pipeline: Debugging Session Log — 2026-08-22
- Cart & Checkout Services + Order Service Hardening Implementation Plan
- Global Constraints
- embed_text
- Demo Merchant Seed Implementation Plan
- TijaratkBot Marketing Site — SEO & Frontend Performance Plan
- Commerce Layer Completion — Doc Reconciliation + Safe-to-Land Gaps
- TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)
- nav.tsx
- 2. 16-Task Roadmap & Progress Status
- pricing/page.tsx
- pipeline.py
- checkout/test_service.py
- 33. Onboarding
- ProductVariant
- 44. Failure Handling
- AGENTS.md
- 15. AI Tool/Action Set
- 32. Merchant Dashboard Requirements
- 3. Technology Baseline
- frontend/README.md
- MVP Scope
- 45. Latency Targets
- 46. Testing Strategy
- 52. Recommended Initial Plan Configuration
- This is NOT the Next.js you know
- 2. Product Positioning
- 37. Future Roadmap
- 6. Core Product Modes
- TijaratkBot — Product Requirements Document (PRD)
- Cart
- Product
- Merchant
- manual_order.py
- 4. Remediation plan (phases; each independently shippable)
- TijaratkBot
- README.md
- CLAUDE.md
- app/layout.tsx
- ingest_channel_message
- test_product_matching.py
- faq/page.tsx
- backend/AGENTS.md
- ActionArgumentError
- EncryptedString
- app/models/__init__.py
- Message
- blog-content.ts
- Merchant Dashboard Remediation
- resolve_action
- [slug]/page.tsx
- features-content.ts
- how-it-works-content.ts
- use-local-storage.ts
- 83. Phase 1 Delivery Plan
- 2. What is DONE
- extract_order
- merchants/router.py
- handoff/test_router.py
- 57. API Design
- Implement AI-Driven Response Generation
- 100. Production Readiness Checklist
- test_action_schemas.py
- 18. Phase 1 Scope --- Facebook Messenger
- 1. Executive Summary
- 5. Recommended Customer UX
- 73. Metrics
- 7. Why This Is Especially Important for 300 Products
- 80. Testing Strategy
- 6. The Hybrid UX Principle
- 82. UX Test Dataset
- 8. Recommended Customer Conversation Flow

## God Nodes (most connected - your core abstractions)
1. `Product` - 111 edges
2. `Merchant` - 80 edges
3. `ProductVariant` - 68 edges
4. `process_message()` - 55 edges
5. `get_db()` - 46 edges
6. `new_id()` - 43 edges
7. `get_current_merchant()` - 40 edges
8. `ConvState` - 40 edges
9. `add_item()` - 39 edges
10. `Conversation` - 32 edges

## Surprising Connections (you probably didn't know these)
- `test_facebook_callback_creates_merchant_and_returns_token()` --indirect_call--> `get_db()`  [INFERRED]
  backend/tests/domains/auth/test_router.py → backend/app/core/database.py
- `test_facebook_callback_rejects_invalid_facebook_token()` --indirect_call--> `get_db()`  [INFERRED]
  backend/tests/domains/auth/test_router.py → backend/app/core/database.py
- `test_facebook_callback_rejects_suspended_merchant()` --indirect_call--> `get_db()`  [INFERRED]
  backend/tests/domains/auth/test_router.py → backend/app/core/database.py
- `test_get_me_rejects_missing_token()` --indirect_call--> `get_db()`  [INFERRED]
  backend/tests/domains/auth/test_router.py → backend/app/core/database.py
- `test_get_me_returns_merchant()` --indirect_call--> `get_db()`  [INFERRED]
  backend/tests/domains/auth/test_router.py → backend/app/core/database.py

## Import Cycles
- None detected.

## Communities (180 total, 13 thin omitted)

### Community 0 - "dispatch_action"
Cohesion: 0.06
Nodes (57): _ActionBase, CreateOrderAction, ExtractionResult, GeneratedReply, GetCheckoutStateAction, GetDeliveryInfoAction, GetProductAction, IntentClassification (+49 more)

### Community 1 - "test_meta.py"
Cohesion: 0.09
Nodes (39): parse_meta_payload(), Try to decode a JSON string from a postback/quick_reply payload., _safe_json_payload(), verify_meta_signature(), ArqRedis, AsyncSession, get, post (+31 more)

### Community 2 - "Order"
Cohesion: 0.23
Nodes (22): AsyncSession, Decimal, Single, service-owned writer for `Order`/`OrderItem` rows. `status` and…, ResolvedOrderLine, write_order(), ModelTier, OrderSource, OrderStatus (+14 more)

### Community 3 - "TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md"
Cohesion: 0.02
Nodes (93): 101. What Not to Build in Phase 1, 102. Recommended Build Order, 103. Final Architecture, 104. The Most Important Engineering Rule, 105. Final Recommendation, 10. Product Detail UX, 11. Variant Resolution, 12. Cart UX (+85 more)

### Community 4 - "match_variant_hint"
Cohesion: 0.47
Nodes (9): match_variant_hint(), Pure, no DB access. Case-insensitive substring match: first check `hint`…, VariantCandidate, test_match_variant_hint_matches_attribute_value(), test_match_variant_hint_matches_label_case_insensitive(), test_match_variant_hint_returns_first_match_when_ambiguous(), test_match_variant_hint_returns_none_when_no_candidates(), test_match_variant_hint_returns_none_when_no_hint() (+1 more)

### Community 5 - "delivery/router.py"
Cohesion: 0.18
Nodes (28): delete_delivery_area_endpoint(), get_delivery_areas(), patch_delivery_area(), post_delivery_area(), AsyncSession, delete, get, patch (+20 more)

### Community 6 - "app/page.tsx"
Cohesion: 0.15
Nodes (11): Page(), PricingSection(), FAQSection(), getFaqs(), Features(), Hero(), HowItWorks(), MarketProof() (+3 more)

### Community 7 - "OutboundMessage"
Cohesion: 0.08
Nodes (46): Button, ButtonMessage, GenericElement, GenericTemplateMessage, MediaMessage, OutboundMessage, BaseModel, QuickReply (+38 more)

### Community 8 - "handoff/router.py"
Cohesion: 0.39
Nodes (7): AsyncSession, post, return_to_ai(), takeover_conversation(), HandoffReturnRequest, HandoffTakeoverRequest, BaseModel

### Community 9 - "devDependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, dependencies, @inlang/paraglide-js, @inlang/paraglide-next, lucide-react, next, nextjs-toploader (+33 more)

### Community 10 - "demo/actions.ts"
Cohesion: 0.05
Nodes (84): checkResponse(), ConversationRecord, createExampleAction(), createKnowledgeAction(), createManualOrderAction(), createProductAction(), deleteExampleAction(), deleteKnowledgeAction() (+76 more)

### Community 11 - "process_message"
Cohesion: 0.21
Nodes (33): _correction_count(), _known_intents(), _merchant_info(), PipelineResult, process_message(), AsyncSession, _chat_response(), _embedding_response() (+25 more)

### Community 12 - "compilerOptions"
Cohesion: 0.06
Nodes (30): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+22 more)

### Community 13 - "StoreKnowledge"
Cohesion: 0.13
Nodes (29): create(), delete(), get_store_knowledge(), AsyncSession, delete, get, post, put (+21 more)

### Community 14 - "complete"
Cohesion: 0.22
Nodes (17): AsyncOpenAI, AICallError, get_deepseek_client(), get_embedding_client(), parse_json_content(), Exception, Model call failed or returned unusable content., §7's observability requirement: log token counts + latency for every AI call,… (+9 more)

### Community 15 - "ingest_message"
Cohesion: 0.17
Nodes (17): ingest(), AsyncSession, MessageIngestRequest, MessageIngestResponse, post, Response, MessageIngestRequest, MessageIngestResponse (+9 more)

### Community 16 - "ConvState"
Cohesion: 0.29
Nodes (10): CallUsage, deepseek_provider(), generate_reply(), build_system_prompt(), ConvState, test_build_system_prompt_accepts_action_task_block(), test_empty_slots_says_nothing_gathered(), test_includes_merchant_name_and_dialect_guidance() (+2 more)

### Community 17 - "get_db"
Cohesion: 0.19
Nodes (15): get_db(), Dependency function that yields a database session., test_delivery_area_crud_happy_path(), test_delivery_areas_endpoints_require_auth(), test_patch_and_delete_reject_cross_merchant_area(), test_get_conversations_requires_authentication(), test_list_conversations_filters_by_merchant_id(), _chat_response() (+7 more)

### Community 18 - "evaluate_preflight"
Cohesion: 0.20
Nodes (16): check_ambiguous_fields(), check_confidence_threshold(), check_reasoning_heavy(), check_repeated_correction(), evaluate_postflight(), evaluate_preflight(), Triggers knowable before any model call., Triggers only knowable from the model's output. (+8 more)

### Community 19 - "get_current_merchant"
Cohesion: 0.26
Nodes (14): get_current_merchant(), AsyncSession, HTTPAuthorizationCredentials, _bearer(), HTTPAuthorizationCredentials, test_get_current_merchant_demo_bypass_returns_merchant_when_configured(), test_get_current_merchant_invalid_token_raises_401(), test_get_current_merchant_missing_token_raises_401() (+6 more)

### Community 20 - "AsyncClient"
Cohesion: 0.35
Nodes (13): AsyncClient, get_arq_pool(), ArqRedis, _messenger_body(), _sign_meta(), test_meta_get_verify_echoes_challenge(), test_meta_get_verify_rejects_wrong_token(), test_meta_post_creates_message_and_enqueues_job() (+5 more)

### Community 21 - "build_context_prompt"
Cohesion: 0.21
Nodes (9): build_context_prompt(), main(), Manual evaluation runner — NOT part of `make test` / CI. Hits the real…, run_case(), FakeExample, FakeMessage, test_build_context_prompt_includes_examples(), test_build_context_prompt_includes_history_and_current() (+1 more)

### Community 22 - "create_access_token"
Cohesion: 0.36
Nodes (8): create_access_token(), decode_access_token(), Decode and validate a JWT. Returns the merchant_id (the "sub" claim) on…, Encode a JWT with claims {"sub": merchant_id, "exp": <now +…, test_create_and_decode_access_token_round_trip(), test_decode_access_token_returns_none_for_garbage_input(), test_decode_access_token_returns_none_when_expired(), test_decode_access_token_returns_none_when_tampered()

### Community 23 - "conversations/router.py"
Cohesion: 0.28
Nodes (13): get_conversations(), get_messages(), AsyncSession, get, post, reply_to_conversation(), ConversationRead, MessageRead (+5 more)

### Community 24 - "classify_message"
Cohesion: 0.42
Nodes (8): classify_message(), _intent_response_schema(), BaseModel, _chat_response(), test_classify_message_flags_low_confidence(), test_classify_message_rejects_off_vocabulary_intent(), test_classify_message_returns_result_when_confident(), test_classify_message_skips_ai_call_on_repeated_correction()

### Community 25 - "match_tier0"
Cohesion: 0.36
Nodes (8): match_tier0(), test_bare_link_is_spam(), test_greeting_matches(), test_normal_message_has_no_match(), test_product_link_with_long_sentence_is_not_spam(), test_product_link_with_question_is_not_spam(), test_single_emoji_is_reaction(), test_spam_link_matches()

### Community 26 - "settings.json"
Cohesion: 0.20
Nodes (9): languageTags, modules, plugin.inlang.messageFormat, pathPattern, $schema, sourceLanguageTag, ar, en (+1 more)

### Community 27 - "FastAPI"
Cohesion: 0.23
Nodes (9): configure_logging(), close_arq_pool(), close_ai_clients(), lifespan(), get, root(), test_get_products_requires_authentication(), test_list_products_returns_only_merchant_scoped_products() (+1 more)

### Community 28 - "conftest.py"
Cohesion: 0.27
Nodes (9): channel_connection(), conversation(), db_session(), fake_arq_pool(), FakeArqPool, merchant(), message(), mock_ai() (+1 more)

### Community 29 - "TijaratkBot_SRD.md"
Cohesion: 0.04
Nodes (53): 10. Product Search, 11. Conversation, 12. Conversation State, 13. Message, 14. AI Orchestrator, 15. AI Gateway, 16. L0 Router, 17. L1 Nile-Chat Service (+45 more)

### Community 30 - "TijaratkBot_PRD.md"
Cohesion: 0.06
Nodes (31): 10. L0 — Deterministic Layer, 11. L1 — Nile-Chat 4B, 12. L2 — DeepSeek V4 Flash, 13. L3 — Human Escalation, 14. AI Action Architecture, 16. Catalog Retrieval, 17. Egyptian Arabic and Arabizi Normalization, 18. Conversation State (+23 more)

### Community 31 - "logging.py"
Cohesion: 0.08
Nodes (38): FacebookIdentity, FacebookPage, fetch_user_pages(), is_page_access_token_valid(), Subscribe the page to this app's webhooks so Meta delivers its message events.…, Validate a page access token against the Graph API. Returns True if valid,…, Verify a Facebook user access token against the Graph API. Returns the verified…, Fetch the Facebook Pages managed by this user. Each page comes with a page-… (+30 more)

### Community 32 - "health_check"
Cohesion: 0.33
Nodes (5): health_check(), get, Check if the API is running., HealthResponse, BaseModel

### Community 33 - "login/actions.ts"
Cohesion: 0.13
Nodes (17): loginWithFacebookAction(), logoutAction(), setAuthCookies(), LoginPage(), navigation, SidebarClient(), OnboardingPage(), ConnectFacebookPages() (+9 more)

### Community 38 - "opencode.json"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

### Community 88 - "products/router.py"
Cohesion: 0.16
Nodes (29): create(), delete(), get_products(), AsyncSession, delete, get, post, put (+21 more)

### Community 89 - "Backend review & remediation plan — classy-arabic (`backend/`)"
Cohesion: 0.07
Nodes (27): B1 — Every prompt contains the current message twice, B2 — The 2048-token ceiling is enforced nowhere, B3 — Empty orders auto-confirm, B4 — Any AI hiccup drops the inbound message, Backend review & remediation plan — classy-arabic (`backend/`), Context, Migration, Phase 0 — Baseline (+19 more)

### Community 90 - "TijaratkBot AI Engine — Correctness, Gateway, Observability & Evaluation Implementation Plan"
Cohesion: 0.08
Nodes (23): Execution options, Global Constraints, Non-Goals (explicit — do not build these here), Phase 1 — Correctness fixes (5 empirically-verified failures on `HEAD`), Phase 2 — Hugging Face endpoint compatibility check (standalone, non-blocking), Phase 3 — AI Gateway abstraction (SRD §15), Phase 4 — Persisted AI usage telemetry (SRD §32), Phase 5 — Evaluation harness (PRD §47, SRD §46–§48) (+15 more)

### Community 91 - "AI Action Validator + Tool Layer Implementation Plan"
Cohesion: 0.08
Nodes (23): AI Action Validator + Tool Layer Implementation Plan, Execution options, Global Constraints, Non-Goals (explicit — do not build these here), Phase 1 — Action Schema, Audit Model & Validator Core, Phase 2 — Functional Tools, Phase 3 — Pipeline Integration, Phase 4 — Stubbed Tools (contract + validation + tests, real seam, deferred business logic) (+15 more)

### Community 92 - "Public Demo Page Security Hardening Implementation Plan"
Cohesion: 0.10
Nodes (20): Global Constraints, Non-Goals, Out of scope, flagged for follow-up, Phase 1 — Cheap, independent fixes, Phase 2 — Shared infrastructure, Phase 3 — Demo isolation, Public Demo Page Security Hardening Implementation Plan, Self-Review (+12 more)

### Community 93 - "Global Constraints"
Cohesion: 0.11
Nodes (17): Global Constraints, Message Classification & AI Engine Implementation Plan, Task 10: Pipeline orchestrator, Task 11: Messages domain (HTTP entry point), Task 12: Clustering job, Task 13: Clustering CLI entrypoint, Task 14: Full-suite verification, Task 1: Dependencies (+9 more)

### Community 94 - "Channel Ingestion (Facebook, Instagram, WhatsApp Webhooks) Implementation Plan"
Cohesion: 0.12
Nodes (16): Channel Ingestion (Facebook, Instagram, WhatsApp Webhooks) Implementation Plan, Execution options, Global Constraints, Non-Goals (explicit — do not build these here), Task 10: arq worker, Task 11: Docs and final verification, Task 1: Dependencies and configuration, Task 2: Models — Channel enum, ChannelConnection, WebhookEvent, and column additions (+8 more)

### Community 95 - "Classification Pipeline: Debugging Session Log — 2026-08-22"
Cohesion: 0.13
Nodes (14): 10. Model ignored "pick from this list" even with the system prompt correctly arriving, 1. App wouldn't boot — `EMBEDDING_BASE_URL`/`EMBEDDING_API_KEY` required but absent from `.env`, 2. Unclosed `httpx.AsyncClient` per AI call, 3. `respx` couldn't mock any AI call — silently hit the real network, 4. Test mock URLs were hardcoded, not settings-driven, 5. CLI test script (`scripts/test_engine.py`) sent a different prompt than the real pipeline, 6. No `temperature`/`seed` pinned on any AI call, 7. `pytest` was trying to collect `scripts/test_engine.py` as a real test (+6 more)

### Community 96 - "Cart & Checkout Services + Order Service Hardening Implementation Plan"
Cohesion: 0.13
Nodes (14): Cart & Checkout Services + Order Service Hardening Implementation Plan, Follow-ups (explicitly not built in this plan), Global Constraints, Non-Goals (explicit — do not build these here), Phase 1 — Schema Foundation & Infrastructure, Phase 2 — Cart Service, Phase 3 — Order Hardening, Task 1: Fix the `dispatch_action` commit gap (+6 more)

### Community 97 - "Global Constraints"
Cohesion: 0.14
Nodes (13): DeepSeek-Only Engine Implementation Plan, Explicitly out of scope, Global Constraints, Self-review (spec coverage / placeholders / type consistency), Task 1: `app/engine/prompts.py` — shared system-prompt composer, Task 2: Simplify `context_budget.py` and `routing_policy.py`, Task 3: Collapse `ModelTier` to `RULE` / `DEEPSEEK`, Task 4: Collapse the model layer — `clients.py`, `gateway.py`, `classification.py`, `extraction.py`, `clustering/job.py` (+5 more)

### Community 98 - "embed_text"
Cohesion: 0.05
Nodes (56): asyncio, do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, In this scenario we need to create an Engine and associate a connection with…, Run migrations in 'online' mode., run_async_migrations(), run_migrations_offline(), run_migrations_online() (+48 more)

### Community 99 - "Demo Merchant Seed Implementation Plan"
Cohesion: 0.15
Nodes (12): Demo Merchant Seed Implementation Plan, Global Constraints, Out of scope, flagged for follow-up, Self-Review, Task 1: `StoreKnowledge` model and migration, Task 2: Real `store_knowledge.service.search()` — keyword-match MVP, Task 3: Thread the answer back through the pipeline, Task 4: Expose `Product.price` over the API (+4 more)

### Community 100 - "TijaratkBot Marketing Site — SEO & Frontend Performance Plan"
Cohesion: 0.17
Nodes (11): 1. What's already good, 2. Findings by priority, 3. Suggested execution order, 4. Verification (how to confirm each batch actually worked), Context, Critical files, P0 — Critical (wrong signals actively working against indexing/trust), P1 — High (large gaps, contained fixes) (+3 more)

### Community 101 - "Commerce Layer Completion — Doc Reconciliation + Safe-to-Land Gaps"
Cohesion: 0.18
Nodes (10): Commerce Layer Completion — Doc Reconciliation + Safe-to-Land Gaps, Deferred (mechanical, but blocked on other in-flight work), Execution log, Global Constraints, Recommended follow-up plans (need their own design pass — not tasked here), Self-review, Task 1: Documentation reconciliation, Task 2: Make `create_order`'s `confirm` parameter do something (+2 more)

### Community 102 - "TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)"
Cohesion: 0.18
Nodes (11): 1.1 Retired Model (formerly Tier 1): MBZUAI-Paris/Nile-Chat-4B, 1.2 Sole LLM Tier: DeepSeek v4 Flash (via OpenRouter API), 1.3 Embedding Model: BAAI/bge-m3 (Self-Hosted Multilingual), 1. Model References, 2. Data Model, 3. Pipeline, 4. Review-Flagging Policy, 5. Embeddings (+3 more)

### Community 103 - "nav.tsx"
Cohesion: 0.18
Nodes (8): metadata, metadata, metadata, BrandMark(), metadata, FinalCTA(), LanguageSwitcher(), Nav()

### Community 104 - "2. 16-Task Roadmap & Progress Status"
Cohesion: 0.18
Nodes (10): 1. Project & Architecture Context, 2. 16-Task Roadmap & Progress Status, 3. Important Architectural Rulings & Invariant Rules, 4. Immediate Execution Guide: Task 8 (Delivery Service), ✅ Phase 0 — Product Variants & Order Writer Consolidation (COMPLETED), ✅ Phase 1 — Multi-Tenancy & Auth Spine (COMPLETED), ⏳ Phase 2 — Delivery Service (CURRENT & NEXT TASK), Session Handover & Context Summary: Tijaratk Bot Multi-Phase Plan (+2 more)

### Community 105 - "pricing/page.tsx"
Cohesion: 0.18
Nodes (11): GET(), metadata, PricingTable(), COMPARISON_CATEGORIES, ComparisonFeature, FAIR_USAGE_TERMS, getPricingMarkdown(), PAYMENT_METHODS (+3 more)

### Community 107 - "pipeline.py"
Cohesion: 0.15
Nodes (19): ConversationNotFoundError, AsyncSession, Exception, return_to_ai(), takeover_conversation(), estimate_cost(), Per-model cost-per-1k-tokens rate table. Empty by default — estimate_cost…, _generate_reply() (+11 more)

### Community 108 - "checkout/test_service.py"
Cohesion: 0.14
Nodes (28): create_order(), get_checkout_state(), AsyncSession, Real delivery-area lookup (SRD §29). A merchant with no configured active areas…, validate_delivery_area(), DeliveryArea, Base, test_create_order_allows_new_cart_after_checkout() (+20 more)

### Community 109 - "33. Onboarding"
Cohesion: 0.29
Nodes (7): 33. Onboarding, Step 1, Step 2, Step 3, Step 4, Step 5, Step 6

### Community 110 - "ProductVariant"
Cohesion: 0.11
Nodes (42): check_product_belongs_to_merchant(), check_product_exists(), _check_product_ownership(), check_variant_belongs_to_product(), check_variant_exists(), check_variant_is_active(), _check_variant_ownership(), evaluate_action() (+34 more)

### Community 111 - "44. Failure Handling"
Cohesion: 0.33
Nodes (6): 44. Failure Handling, AI produces invalid JSON, Both unavailable, Commerce action fails, DeepSeek unavailable, Nile-Chat unavailable

### Community 112 - "AGENTS.md"
Cohesion: 0.29
Nodes (5): ✍️ Content & Blog Author Rule: TijaratkBot Team Only, 🚨 CRITICAL RULE: Mandatory Frontend & Backend Lint Checks, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, General Guidelines, graphify

### Community 113 - "15. AI Tool/Action Set"
Cohesion: 0.40
Nodes (5): 15. AI Tool/Action Set, Cart, Catalog, Checkout, Knowledge

### Community 114 - "32. Merchant Dashboard Requirements"
Cohesion: 0.40
Nodes (5): 32. Merchant Dashboard Requirements, AI, Conversations, Orders, Products

### Community 115 - "3. Technology Baseline"
Cohesion: 0.40
Nodes (5): 3. Technology Baseline, AI, Backend, Frontend, Infrastructure

### Community 116 - "frontend/README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 117 - "MVP Scope"
Cohesion: 0.50
Nodes (4): 4. Product Scope, Customer, Merchant, MVP Scope

### Community 118 - "45. Latency Targets"
Cohesion: 0.50
Nodes (4): 45. Latency Targets, L0, L1, L2

### Community 119 - "46. Testing Strategy"
Cohesion: 0.50
Nodes (4): 46. Testing Strategy, AI tests, Integration tests, Unit tests

### Community 120 - "52. Recommended Initial Plan Configuration"
Cohesion: 0.50
Nodes (4): 52. Recommended Initial Plan Configuration, Growth, Pro, Starter

### Community 122 - "This is NOT the Next.js you know"
Cohesion: 0.40
Nodes (4): 🚨 CRITICAL RULE: Mandatory Frontend & Backend Lint Checks, ⚡ CRITICAL RULE: Server-Side Data Fetching & Page Architecture, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, This is NOT the Next.js you know

### Community 123 - "2. Product Positioning"
Cohesion: 0.67
Nodes (3): 2. Product Positioning, AI promise, Core promise

### Community 124 - "37. Future Roadmap"
Cohesion: 0.67
Nodes (3): 37. Future Roadmap, Phase 2, Phase 3

### Community 125 - "6. Core Product Modes"
Cohesion: 0.67
Nodes (3): 6.1 Catalog Mode, 6.2 AI Commerce Mode, 6. Core Product Modes

### Community 129 - "Cart"
Cohesion: 0.20
Nodes (19): _get_item_for_conversation(), _get_or_create_active_cart(), AsyncSession, remove_item(), _get_active_cart_items(), Product, ProductVariant, Cart (+11 more)

### Community 130 - "Product"
Cohesion: 0.24
Nodes (22): add_item(), CartItemNotFoundError, Exception, line_item_id does not reference an existing cart item for this conversation's…, update_item(), Product, Base, test_add_item_creates_cart_and_item() (+14 more)

### Community 131 - "Merchant"
Cohesion: 0.24
Nodes (12): MerchantStatus, Merchant, Base, _mock_facebook_success(), mock, test_facebook_callback_creates_merchant_and_returns_token(), test_facebook_callback_rejects_invalid_facebook_token(), test_facebook_callback_rejects_suspended_merchant() (+4 more)

### Community 132 - "manual_order.py"
Cohesion: 0.17
Nodes (17): ConversationNotFoundError, create_manual_order(), ProductNotFoundError, AsyncSession, Exception, create_manual(), list_orders(), AsyncSession (+9 more)

### Community 133 - "4. Remediation plan (phases; each independently shippable)"
Cohesion: 0.12
Nodes (15): 1. Why login goes to dashboard with no Facebook login, 2. Architecture as found (verified), 3. Findings (priority order), 4. Remediation plan (phases; each independently shippable), 5. Explicitly deferred (YAGNI), Critical, High, Medium (+7 more)

### Community 134 - "TijaratkBot"
Cohesion: 0.18
Nodes (11): Architecture, Backend, Documentation, Frontend, Getting started, Prerequisites, Project structure, Status (+3 more)

### Community 135 - "README.md"
Cohesion: 0.20
Nodes (6): Explicitly out of scope for now (PRD §5), Near-term — MVP gap-closers, Now — built today, Phase 2 (per PRD §37), Phase 3 (per PRD §37), Roadmap

### Community 136 - "CLAUDE.md"
Cohesion: 0.20
Nodes (9): App layout, Architecture, Commands, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, Database/enum gotcha (Alembic), Known in-progress / not-yet-implemented, Testing, Two-stage AI routing (+1 more)

### Community 137 - "app/layout.tsx"
Cohesion: 0.19
Nodes (5): cairo, tajawal, Analytics(), BLOG_POSTS, SITE_URL

### Community 138 - "ingest_channel_message"
Cohesion: 0.53
Nodes (8): ParsedInboundMessage, _find_channel_connection(), ingest_channel_message(), AsyncSession, test_ingest_creates_conversation_and_message(), test_ingest_drops_messages_for_unmapped_account(), test_ingest_is_idempotent_on_duplicate_external_message_id(), test_ingest_reuses_existing_conversation_for_same_customer()

### Community 139 - "test_product_matching.py"
Cohesion: 0.29
Nodes (16): build_resolved_order_lines(), match_line_items_to_products(), AsyncSession, Batch-loads Product and ProductVariant rows for every resolved id across all…, For each item with a resolved product_id, load that product's ACTIVE…, resolve_variants_for_line_items(), ExtractedLineItem, _embedding_response() (+8 more)

### Community 140 - "faq/page.tsx"
Cohesion: 0.27
Nodes (7): FaqClient(), GET(), metadata, FAQ_CATEGORIES, FAQ_ITEMS, FaqItem, getFaqMarkdown()

### Community 141 - "backend/AGENTS.md"
Cohesion: 0.40
Nodes (3): 🚨 CRITICAL RULE: Mandatory Frontend & Backend Lint Checks, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, General Guidelines

### Community 142 - "ActionArgumentError"
Cohesion: 0.27
Nodes (15): AddToCartAction, RemoveFromCartAction, UpdateCartAction, handle_add_to_cart(), handle_remove_from_cart(), handle_update_cart(), AsyncSession, ActionArgumentError (+7 more)

### Community 143 - "EncryptedString"
Cohesion: 0.29
Nodes (4): Any, EncryptedString, A SQLAlchemy TypeDecorator that transparently encrypts strings on the way in…, TypeDecorator

### Community 144 - "app/models/__init__.py"
Cohesion: 0.13
Nodes (20): AbstractAsyncContextManager, _find_or_create_conversation(), Send a sequence of rich messages to a Facebook/Messenger user. Returns a list…, send_facebook_messages(), ChannelConnection, Base, Channel, DeliveryAreaStatus (+12 more)

### Community 145 - "Message"
Cohesion: 0.22
Nodes (14): cluster_messages(), fetch_embedded_messages(), label_cluster(), AsyncSession, representative_messages(), run_clustering(), Message, Base (+6 more)

### Community 146 - "blog-content.ts"
Cohesion: 0.39
Nodes (5): GET(), GET(), BlogPost, getArticleMarkdown(), getBlogListMarkdown()

### Community 147 - "Merchant Dashboard Remediation"
Cohesion: 0.25
Nodes (7): Assumptions, Authentication And Channels, Dashboard Screens, Merchant APIs And Data, Merchant Dashboard Remediation, Proof And Rollout, Summary

### Community 148 - "resolve_action"
Cohesion: 0.30
Nodes (12): ActionResolution, AsyncSession, Conversation, _render_response(), resolve_action(), ActionOutcome, _chat_response(), test_resolve_action_escalates_on_invalid_json_after_retry() (+4 more)

### Community 149 - "[slug]/page.tsx"
Cohesion: 0.48
Nodes (4): BlogPostPage(), parseInlineText(), renderMarkdownToReact(), renderTable()

### Community 150 - "features-content.ts"
Cohesion: 0.47
Nodes (4): GET(), FEATURE_PILLARS, FeaturePillar, getFeaturesMarkdown()

### Community 151 - "how-it-works-content.ts"
Cohesion: 0.47
Nodes (4): GET(), getHowItWorksMarkdown(), HOW_IT_WORKS_STEPS, StepItem

### Community 155 - "83. Phase 1 Delivery Plan"
Cohesion: 0.22
Nodes (9): 83. Phase 1 Delivery Plan, Milestone 1 --- Foundation, Milestone 2 --- Catalog, Milestone 3 --- Commerce Core, Milestone 4 --- Facebook Integration, Milestone 5 --- Messenger Catalog UX, Milestone 6 --- AI Layer, Milestone 7 --- Merchant Inbox (+1 more)

### Community 156 - "2. What is DONE"
Cohesion: 0.17
Nodes (11): 1. What the plan was, 1a. Challenges applied to the original plan, 1b. Final approved plan (three parts), 2. What is DONE, 3. What is NOT done, 4. Files changed (summary), AI-Driven Responses & Merchant AI Learning — Implementation Status, Backend (+3 more)

### Community 157 - "extract_order"
Cohesion: 0.46
Nodes (6): extract_order(), test_raw_message(), _chat_response(), test_extract_order_flags_ambiguous_fields(), test_extract_order_returns_result_when_clean(), test_extract_order_skips_ai_call_on_repeated_correction()

### Community 158 - "merchants/router.py"
Cohesion: 0.33
Nodes (8): get_settings(), MerchantSettingsRead, MerchantSettingsUpdate, AsyncSession, BaseModel, get, patch, update_settings()

### Community 159 - "handoff/test_router.py"
Cohesion: 0.46
Nodes (7): override_deps(), AsyncSession, Conversation, fixture, sample_conversation(), test_return_to_ai(), test_takeover_conversation()

### Community 160 - "57. API Design"
Cohesion: 0.33
Nodes (6): 57. API Design, Authentication, Channels, Conversations, Orders, Products

### Community 161 - "Implement AI-Driven Response Generation"
Cohesion: 0.25
Nodes (7): 1. `backend/app/engine/generation.py` [NEW], 2. `backend/app/engine/pipeline.py` [MODIFY], 3. `backend/app/worker.py` [MODIFY], Implement AI-Driven Response Generation, Open Questions, Proposed Changes, Verification Plan

### Community 162 - "100. Production Readiness Checklist"
Cohesion: 0.40
Nodes (5): 100. Production Readiness Checklist, AI, Commerce, Facebook, UX

### Community 164 - "18. Phase 1 Scope --- Facebook Messenger"
Cohesion: 0.40
Nodes (5): 18. Phase 1 Scope --- Facebook Messenger, AI, Channel, Commerce, Merchant

### Community 166 - "1. Executive Summary"
Cohesion: 0.50
Nodes (4): 1. Executive Summary, Phase 1 --- Facebook Messenger, Phase 2 --- WhatsApp, TijaratkBot --- Facebook Messenger Commerce Bot Implementation Plan

### Community 171 - "5. Recommended Customer UX"
Cohesion: 0.50
Nodes (4): 5. Recommended Customer UX, Mode A --- Structured browsing, Mode B --- Natural-language search, Mode C --- Conversational ordering

### Community 172 - "73. Metrics"
Cohesion: 0.50
Nodes (4): 73. Metrics, AI metrics, Business metrics, UX metrics

### Community 173 - "7. Why This Is Especially Important for 300 Products"
Cohesion: 0.50
Nodes (4): 7. Why This Is Especially Important for 300 Products, Problem 1 --- Discovery, Problem 2 --- Decision overload, Problem 3 --- Conversation context

### Community 174 - "80. Testing Strategy"
Cohesion: 0.50
Nodes (4): 80. Testing Strategy, Backend unit tests, Channel tests, Integration tests

### Community 176 - "6. The Hybrid UX Principle"
Cohesion: 0.67
Nodes (3): 6. The Hybrid UX Principle, AI for:, Structured UI for:

### Community 177 - "82. UX Test Dataset"
Cohesion: 0.67
Nodes (3): 82. UX Test Dataset, Task, Task

### Community 178 - "8. Recommended Customer Conversation Flow"
Cohesion: 0.67
Nodes (3): 8.1 Entry, 8.2 Browse, 8. Recommended Customer Conversation Flow

## Knowledge Gaps
- **597 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `Config`, `WorkerSettings`, `tijaratk-bot` (+592 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Merchant` connect `Merchant` to `Order`, `Product`, `manual_order.py`, `delivery/router.py`, `OutboundMessage`, `handoff/router.py`, `test_product_matching.py`, `StoreKnowledge`, `ingest_message`, `app/models/__init__.py`, `get_db`, `Message`, `get_current_merchant`, `resolve_action`, `conversations/router.py`, `FastAPI`, `conftest.py`, `merchants/router.py`, `logging.py`, `handoff/test_router.py`, `products/router.py`, `embed_text`, `pipeline.py`, `checkout/test_service.py`, `ProductVariant`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `Product` connect `Product` to `dispatch_action`, `Cart`, `Order`, `Merchant`, `OutboundMessage`, `process_message`, `checkout/test_service.py`, `test_product_matching.py`, `ProductVariant`, `ActionArgumentError`, `app/models/__init__.py`, `get_db`, `resolve_action`, `products/router.py`, `FastAPI`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `ConvState` connect `ConvState` to `Order`, `pipeline.py`, `process_message`, `app/models/__init__.py`, `get_db`, `build_context_prompt`, `classify_message`, `conftest.py`, `extract_order`, `handoff/test_router.py`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `Product` (e.g. with `add_item()` and `_get_active_cart_items()`) actually correct?**
  _`Product` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `Merchant` (e.g. with `get_checkout_state()` and `return_to_ai()`) actually correct?**
  _`Merchant` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `ProductVariant` (e.g. with `add_item()` and `create_manual_order()`) actually correct?**
  _`ProductVariant` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `process_message()` (e.g. with `OutboundMessage` and `AICallError`) actually correct?**
  _`process_message()` has 2 INFERRED edges - model-reasoned connections that need verification._