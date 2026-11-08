# Graph Report - tijaratk-bot  (2026-11-08)

## Corpus Check
- 229 files · ~396,995 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1845 nodes · 3692 edges · 133 communities (118 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8c392154`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- units.spec.ts
- harness.ts
- gender.ts
- TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md
- channels.controller.ts
- devDependencies
- index.ts
- Multi-page: per-page AI control and per-page stats
- devDependencies
- checkout/service.ts
- schema.ts
- compilerOptions
- core.module.ts
- TijaratkBot — Product Requirements Document (PRD)
- parse
- conversations-client.tsx
- messages.ts
- orders-client.tsx
- compilerOptions
- getCurrentMerchant
- delivery.controller.ts
- LabeledExamplesController
- [id]/page.tsx
- classification.ts
- pipeline.ts
- settings.json
- scripts
- dependencies
- TijaratkBot_SRD.md
- TijaratkBot_PRD.md
- Findings
- labeled-examples/service.ts
- dal.ts
- merchant/actions.ts
- scripts
- config.ts
- .updateStatus
- pages/service.ts
- ar.json
- tsconfig.build.json
- en.json
- notFound
- ZernioConnectController
- store-knowledge/service.ts
- products/service.ts
- registry.ts
- Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price
- Implementation decisions (phases 1-6, built 2026-11-04)
- TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)
- types.ts
- MessagesController
- Merchant
- auth/tokens.ts
- backend/package.json
- .reply
- Settings
- fetchKnowledgeAction
- .oxlintrc.json
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- .keyLogin
- nest-cli.json
- store-facts.ts
- drizzle-orm
- prompts.ts
- @nestjs/core
- @nestjs/platform-express
- TijaratkBot backend (NestJS)
- getSettings
- backend/AGENTS.md
- express
- @nestjs/common
- zod
- setup.ts
- conversations.ts
- CurrentMerchant
- action-resolution.ts
- release.sh
- schemas.ts
- worker/main.ts
- TijaratkBot
- README.md
- CLAUDE.md
- DbOrTx
- disconnect-dialog.tsx
- usage/service.ts
- bot-sent.ts
- 33. Onboarding
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
- 4. Remediation plan (phases; each independently shippable)
- app/layout.tsx
- Merchant Dashboard Remediation
- use-local-storage.ts
- 83. Phase 1 Delivery Plan
- 57. API Design
- 100. Production Readiness Checklist
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
1. `Merchant` - 48 edges
2. `CurrentMerchant` - 48 edges
3. `getSettings()` - 41 edges
4. `scripts` - 41 edges
5. `getBaseUrl()` - 39 edges
6. `Db` - 36 edges
7. `processMessage()` - 35 edges
8. `notFound()` - 31 edges
9. `parse()` - 30 edges
10. `checkResponse()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `matchKnowledge()` --indirect_call--> `cpLen()`  [INFERRED]
  backend/src/domains/store-knowledge/service.ts → backend/src/core/pystr.ts
- `TrainingClient()` --indirect_call--> `fetchExamplesAction()`  [INFERRED]
  frontend/app/merchant/training/training-client.tsx → frontend/app/merchant/actions.ts
- `handleAdd()` --calls--> `createExampleAction()`  [EXTRACTED]
  frontend/app/merchant/training/training-client.tsx → frontend/app/merchant/actions.ts
- `handleUpdate()` --calls--> `updateExampleAction()`  [EXTRACTED]
  frontend/app/merchant/training/training-client.tsx → frontend/app/merchant/actions.ts
- `handleDelete()` --calls--> `deleteExampleAction()`  [EXTRACTED]
  frontend/app/merchant/training/training-client.tsx → frontend/app/merchant/actions.ts

## Import Cycles
- None detected.

## Communities (133 total, 15 thin omitted)

### Community 0 - "units.spec.ts"
Cohesion: 0.07
Nodes (64): agglomerativeCosine(), clusterMessages(), EmbeddedMessage, fetchEmbeddedMessages(), labelCluster(), representativeMessages(), runClustering(), withConversationLock() (+56 more)

### Community 1 - "harness.ts"
Cohesion: 0.07
Nodes (33): AppModule, Module, setSettingsForTests(), DetailExceptionFilter, createAccessToken(), setAiClientsForTests(), configureHttp(), app (+25 more)

### Community 2 - "gender.ts"
Cohesion: 0.11
Nodes (23): detectGenderFromName(), detectGenderFromText(), FEMALE_NAMES, FEMALE_SPOUSAL_RE, FEMALE_TITLES, FIRST_PERSON_FEM_RE, FIRST_PERSON_MASC_RE, MALE_NAMES (+15 more)

### Community 3 - "TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md"
Cohesion: 0.02
Nodes (93): 101. What Not to Build in Phase 1, 102. Recommended Build Order, 103. Final Architecture, 104. The Most Important Engineering Rule, 105. Final Recommendation, 10. Product Detail UX, 11. Variant Resolution, 12. Cart UX (+85 more)

### Community 4 - "channels.controller.ts"
Cohesion: 0.13
Nodes (27): ChannelsController, log, Controller, Post, Req, Res, Channel, OBJECT_TO_CHANNEL (+19 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (39): devDependencies, drizzle-kit, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, oxlint-tsgolint (+31 more)

### Community 7 - "index.ts"
Cohesion: 0.12
Nodes (27): ApiError, DB, SETTINGS, Db, Tx, KeyLogin, AuthGuard, Injectable (+19 more)

### Community 8 - "Multi-page: per-page AI control and per-page stats"
Cohesion: 0.09
Nodes (21): 10. Non-goals, 1. Context, 2. Decisions I made (flag any you disagree with), 3. Vocabulary, 4.1 Direction, 4.2 Information architecture, 4.3 Screens, 4.4 States, copy and accessibility (+13 more)

### Community 9 - "devDependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, dependencies, @inlang/paraglide-js, @inlang/paraglide-next, lucide-react, next, nextjs-toploader (+33 more)

### Community 10 - "checkout/service.ts"
Cohesion: 0.23
Nodes (17): centsToString(), lineTotalCents(), roundHalfEven(), roundScaledToCents(), scaledProduct(), toBigScaled(), toCents(), ModelTier (+9 more)

### Community 11 - "schema.ts"
Cohesion: 0.06
Nodes (33): Fernet, encryptedString, getFernet(), aiActions, aiUsageEvents, bytea, cartItems, carts (+25 more)

### Community 12 - "compilerOptions"
Cohesion: 0.06
Nodes (30): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+22 more)

### Community 13 - "core.module.ts"
Cohesion: 0.15
Nodes (8): CoreModule, pools, Module, CHANNEL_QUEUE_NAME, QUEUE, createDb(), { db, pool }, Global

### Community 15 - "parse"
Cohesion: 0.12
Nodes (15): parse(), ProductImagesController, ProductsController, Body, Controller, Delete, Get, HttpCode (+7 more)

### Community 16 - "conversations-client.tsx"
Cohesion: 0.18
Nodes (16): logoutAction(), ConversationRecord, fetchConversationsAction(), getPages(), ConversationPageChip, ConversationsClient(), ConversationsPage(), isRedirect() (+8 more)

### Community 17 - "messages.ts"
Cohesion: 0.40
Nodes (4): MessageIngestRequest, MessageIngestResponse, OrderDetail, OrderLineItem

### Community 18 - "orders-client.tsx"
Cohesion: 0.20
Nodes (14): fetchOrdersAction(), fetchProductsAction(), ManualOrderResult, OrdersClient(), isRedirect(), OrdersPage(), isRedirect(), ProductsPage() (+6 more)

### Community 19 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+14 more)

### Community 20 - "getCurrentMerchant"
Cohesion: 0.21
Nodes (12): getIntents(), getLabeledExamples(), isRedirect(), TrainingPage(), SOURCE_LABELS, TrainingClient(), handleAdd(), handleDelete() (+4 more)

### Community 21 - "delivery.controller.ts"
Cohesion: 0.12
Nodes (21): quantize2(), Create, DeliveryController, NOTE: unlike the Python router (which never committed - its writes were rolled…, Body, Controller, Delete, Get (+13 more)

### Community 22 - "LabeledExamplesController"
Cohesion: 0.13
Nodes (12): LabeledExamplesController, Body, Controller, Delete, Get, HttpCode, Inject, Param (+4 more)

### Community 23 - "[id]/page.tsx"
Cohesion: 0.12
Nodes (35): connectFacebookAction(), connectPlatformAction(), setPageAi(), AddPageSheet(), AiRepliesTab(), AiSign(), CompareTable(), SortKey (+27 more)

### Community 24 - "classification.ts"
Cohesion: 0.19
Nodes (17): cpLen(), stripChars(), classifyMessage(), intentResponseSchema(), classificationTaskBlock(), g, checkAmbiguousFields(), checkConfidenceThreshold() (+9 more)

### Community 25 - "pipeline.ts"
Cohesion: 0.10
Nodes (31): Message, Order, ProductVariant, ConversationNotFoundError, ingestMessage(), MessageIngestRequest, COST_PER_1K_TOKENS, estimateCost() (+23 more)

### Community 26 - "settings.json"
Cohesion: 0.20
Nodes (9): languageTags, modules, plugin.inlang.messageFormat, pathPattern, $schema, sourceLanguageTag, ar, en (+1 more)

### Community 27 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:migrate, deploy, format, lint, merchant:key, start (+11 more)

### Community 28 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, bullmq, ioredis, jsonwebtoken, openai, pg, reflect-metadata, rxjs (+9 more)

### Community 29 - "TijaratkBot_SRD.md"
Cohesion: 0.04
Nodes (53): 10. Product Search, 11. Conversation, 12. Conversation State, 13. Message, 14. AI Orchestrator, 15. AI Gateway, 16. L0 Router, 17. L1 Nile-Chat Service (+45 more)

### Community 30 - "TijaratkBot_PRD.md"
Cohesion: 0.06
Nodes (31): 10. L0 — Deterministic Layer, 11. L1 — Nile-Chat 4B, 12. L2 — DeepSeek V4 Flash, 13. L3 — Human Escalation, 14. AI Action Architecture, 16. Catalog Retrieval, 17. Egyptian Arabic and Arabizi Normalization, 18. Conversation State (+23 more)

### Community 31 - "Findings"
Cohesion: 0.10
Nodes (19): 10. Quota is now check-then-act (low-medium, accepted trade-off with a sharp edge), 11. Usage resets once for every merchant (planned, optional mitigation), 12. Smaller notes, 1. Unrelated change mixed into the same working tree (decide before committing), 2. Large catalogs: false "not in the catalog" answers (medium, both passes), 3. `buildStoreFacts` runs concurrent queries on one transaction client (medium, *verified*), 4. `{merchant_name}` replacement breaks on `$` in the name (low-medium, *verified*), 5. An over-long policy disappears and the model is told there are none (medium, read from code) (+11 more)

### Community 32 - "labeled-examples/service.ts"
Cohesion: 0.29
Nodes (9): LabeledExample, createExample(), embeddingFor(), LabeledExampleRead, listExamples(), log, toRead(), updateExample() (+1 more)

### Community 33 - "dal.ts"
Cohesion: 0.12
Nodes (13): loginWithKeyAction(), ERRORS, SettingsPage(), SettingToggle(), SettingToggleProps, COOKIES, LOGIN_MARKER, SESSION_COOKIES (+5 more)

### Community 34 - "merchant/actions.ts"
Cohesion: 0.19
Nodes (33): checkResponse(), createExampleAction(), createKnowledgeAction(), createManualOrderAction(), createProductAction(), deleteExampleAction(), deleteKnowledgeAction(), deleteProductAction() (+25 more)

### Community 35 - "scripts"
Cohesion: 0.04
Nodes (45): description, name, private, scripts, build, build:backend, build:be, build:fe (+37 more)

### Community 36 - "config.ts"
Cohesion: 0.14
Nodes (13): bool, csvOrJson, FALSE, loadSettings(), MAX_ACTIVE_PAGES_PER_MERCHANT, schema, TRUE, RateLimitMiddleware (+5 more)

### Community 37 - ".updateStatus"
Cohesion: 0.15
Nodes (12): CheckoutController, loadItems(), toOrderRead(), Body, Controller, Get, HttpCode, Inject (+4 more)

### Community 38 - "pages/service.ts"
Cohesion: 0.14
Nodes (24): iso(), getConversationMessages(), listConversations(), pageAiState, PatchPageAi, RangeQuery, disconnectPageById(), getPageDetail() (+16 more)

### Community 39 - "ar.json"
Cohesion: 0.12
Nodes (15): demo_catalog_aka, demo_catalog_egp, demo_catalog_empty, demo_catalog_matched, demo_catalog_no_options, demo_catalog_title, demo_knowledge_empty, demo_knowledge_keywords (+7 more)

### Community 40 - "tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, rootDir, exclude, extends, include, node_modules, dist, **/*spec.ts (+3 more)

### Community 41 - "en.json"
Cohesion: 0.12
Nodes (15): demo_catalog_aka, demo_catalog_egp, demo_catalog_empty, demo_catalog_matched, demo_catalog_no_options, demo_catalog_title, demo_knowledge_empty, demo_knowledge_keywords (+7 more)

### Community 42 - "notFound"
Cohesion: 0.24
Nodes (9): notFound(), HandoffController, Body, Controller, HttpCode, Inject, Param, Post (+1 more)

### Community 43 - "ZernioConnectController"
Cohesion: 0.24
Nodes (7): Controller, Get, Param, Query, Res, UseGuards, ZernioConnectController

### Community 44 - "store-knowledge/service.ts"
Cohesion: 0.12
Nodes (18): createKnowledge(), deleteKnowledge(), listKnowledge(), toRead(), updateKnowledge(), Create, StoreKnowledgeController, Body (+10 more)

### Community 45 - "products/service.ts"
Cohesion: 0.15
Nodes (25): num(), ProductCreate, ProductUpdate, Variant, catalogForAi(), clearProductImage(), createProduct(), deleteProduct() (+17 more)

### Community 46 - "registry.ts"
Cohesion: 0.15
Nodes (20): addItem(), CartItemNotFoundError, getItemForConversation(), getOrCreateActiveCart(), removeItem(), updateItem(), checkProductOwnership(), checkVariantOwnership() (+12 more)

### Community 47 - "Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price"
Cohesion: 0.18
Nodes (10): AI-engineering review, Context, Decisions built in (override at approval), Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price, Manual steps after merge, Recommended changes (TDD: write W0 first, watch it fail, then W1-W5), Reply to forward to the merchant (Arabic, edit freely), Verification (+2 more)

### Community 48 - "Implementation decisions (phases 1-6, built 2026-11-04)"
Cohesion: 0.25
Nodes (7): Architecture, Decisions, Deliberate behavior differences from Python (all bug-fixes or hardening), Format, Implementation decisions (phases 1-6, built 2026-11-04), Known gaps / follow-ups, NestJS migration: decision log

### Community 49 - "TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)"
Cohesion: 0.17
Nodes (12): 1.1 Retired Model (formerly Tier 1): MBZUAI-Paris/Nile-Chat-4B, 1.2 Sole LLM Tier: DeepSeek v4 Flash (via OpenRouter API), 1.3 Embedding Model: BAAI/bge-m3 (Self-Hosted Multilingual), 1.4 Customer Reply Phrasing Model: GPT-4o-mini (via OpenRouter API), 1. Model References, 2. Data Model, 3. Pipeline, 4. Review-Flagging Policy (+4 more)

### Community 50 - "types.ts"
Cohesion: 0.11
Nodes (18): Cart, CartItem, ChannelConnection, Conversation, DeliveryArea, HandoffReason, Merchant, NewMessage (+10 more)

### Community 51 - "MessagesController"
Cohesion: 0.40
Nodes (4): MessagesController, Controller, Inject, UseGuards

### Community 52 - "Merchant"
Cohesion: 0.16
Nodes (13): Merchant, PagesController, parseRange(), Body, Controller, Get, HttpCode, Inject (+5 more)

### Community 53 - "auth/tokens.ts"
Cohesion: 0.17
Nodes (11): safeEqual(), createMerchantApiKey(), decodeAccessToken(), keyMac(), merchantIdFromApiKey(), Get, Query, { db, pool } (+3 more)

### Community 54 - "backend/package.json"
Cohesion: 0.22
Nodes (8): author, description, license, name, packageManager, private, type, version

### Community 55 - ".reply"
Cohesion: 0.16
Nodes (10): ConversationsController, Body, Controller, Get, HttpCode, Inject, Param, Post (+2 more)

### Community 56 - "Settings"
Cohesion: 0.13
Nodes (10): Settings, Inject, Inject, Inject, Inject, HealthController, RootController, Controller (+2 more)

### Community 58 - "fetchKnowledgeAction"
Cohesion: 0.38
Nodes (7): fetchKnowledgeAction(), isRedirect(), PoliciesPage(), PoliciesClient(), KNOWLEDGE_TYPES, StoreKnowledgeView(), StoreKnowledge

### Community 59 - ".oxlintrc.json"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 63 - ".keyLogin"
Cohesion: 0.25
Nodes (6): AuthController, Body, Controller, HttpCode, Inject, Post

### Community 64 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 65 - "store-facts.ts"
Cohesion: 0.18
Nodes (12): isOfferActive(), OfferFields, resolveUnitPrice(), now, ProductRead, matchKnowledge(), search(), StoreKnowledgeRead (+4 more)

### Community 69 - "prompts.ts"
Cohesion: 0.17
Nodes (16): pyJsonDumps(), ConvState, buildContextPrompt(), HistoryMessage, PromptExample, PromptMode, truthy(), CallUsage (+8 more)

### Community 72 - "TijaratkBot backend (NestJS)"
Cohesion: 0.50
Nodes (3): Layout, Schema changes, TijaratkBot backend (NestJS)

### Community 73 - "getSettings"
Cohesion: 0.20
Nodes (18): getSettings(), AICallError, AiClient, build(), getEmbeddingClient(), getLlmClient(), isApiError(), log (+10 more)

### Community 84 - "CurrentMerchant"
Cohesion: 0.14
Nodes (11): Get, UseGuards, CurrentMerchant, read(), Body, Get, Patch, ingestInTransaction() (+3 more)

### Community 85 - "action-resolution.ts"
Cohesion: 0.27
Nodes (11): ActionResolution, renderResponse(), resolveAction(), stripInternal(), extractOrder(), llmProvider(), ACTION_TASK_BLOCK, buildSystemPrompt() (+3 more)

### Community 88 - "schemas.ts"
Cohesion: 0.20
Nodes (11): J, objectSig(), ours(), sig(), confidence, ExtractionBase, ExtractionResult, GeneratedReply (+3 more)

### Community 89 - "worker/main.ts"
Cohesion: 0.18
Nodes (10): PROCESS_CHANNEL_MESSAGE, checkZernioHealth(), log, ZERNIO_API, connection, { db, pool }, lockRedis, log (+2 more)

### Community 90 - "TijaratkBot"
Cohesion: 0.18
Nodes (11): Architecture, Backend, Documentation, Frontend, Getting started, Prerequisites, Project structure, Status (+3 more)

### Community 91 - "README.md"
Cohesion: 0.20
Nodes (6): Explicitly out of scope for now (PRD §5), Near-term — MVP gap-closers, Now — built today, Phase 2 (per PRD §37), Phase 3 (per PRD §37), Roadmap

### Community 92 - "CLAUDE.md"
Cohesion: 0.20
Nodes (9): Architecture, Backend layout (`backend/src/`), Commands (pnpm, inside `backend/`), ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, Known in-progress / not-yet-implemented, Schema, Testing, Two-stage AI routing (+1 more)

### Community 93 - "DbOrTx"
Cohesion: 0.25
Nodes (6): DbOrTx, ConversationNotFoundError, createManualOrder(), ManualOrderCreate, ProductNotFoundError, ResolvedOrderLine

### Community 94 - "disconnect-dialog.tsx"
Cohesion: 0.40
Nodes (4): DisconnectDialog(), maxWidthClasses, Modal(), ModalProps

### Community 95 - "usage/service.ts"
Cohesion: 0.70
Nodes (4): conversationsThisMonth(), conversationsThisMonthRows(), conversationUsage(), isOverConversationLimit()

### Community 96 - "bot-sent.ts"
Cohesion: 0.83
Nodes (3): botSentRecently(), key(), markBotSent()

### Community 109 - "33. Onboarding"
Cohesion: 0.29
Nodes (7): 33. Onboarding, Step 1, Step 2, Step 3, Step 4, Step 5, Step 6

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

### Community 133 - "4. Remediation plan (phases; each independently shippable)"
Cohesion: 0.12
Nodes (15): 1. Why login goes to dashboard with no Facebook login, 2. Architecture as found (verified), 3. Findings (priority order), 4. Remediation plan (phases; each independently shippable), 5. Explicitly deferred (YAGNI), Critical, High, Medium (+7 more)

### Community 137 - "app/layout.tsx"
Cohesion: 0.19
Nodes (6): cairo, readex, tajawal, Analytics(), WhatsAppWidget(), SITE_URL

### Community 147 - "Merchant Dashboard Remediation"
Cohesion: 0.25
Nodes (7): Assumptions, Authentication And Channels, Dashboard Screens, Merchant APIs And Data, Merchant Dashboard Remediation, Proof And Rollout, Summary

### Community 155 - "83. Phase 1 Delivery Plan"
Cohesion: 0.22
Nodes (9): 83. Phase 1 Delivery Plan, Milestone 1 --- Foundation, Milestone 2 --- Catalog, Milestone 3 --- Commerce Core, Milestone 4 --- Facebook Integration, Milestone 5 --- Messenger Catalog UX, Milestone 6 --- AI Layer, Milestone 7 --- Merchant Inbox (+1 more)

### Community 160 - "57. API Design"
Cohesion: 0.33
Nodes (6): 57. API Design, Authentication, Channels, Conversations, Orders, Products

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
- **803 isolated node(s):** `$schema`, `typescript/no-explicit-any`, `typescript/no-floating-promises`, `node`, `$schema` (+798 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Merchant` connect `Merchant` to `.updateStatus`, `pages/service.ts`, `index.ts`, `notFound`, `ZernioConnectController`, `store-knowledge/service.ts`, `products/service.ts`, `parse`, `CurrentMerchant`, `delivery.controller.ts`, `LabeledExamplesController`, `.reply`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `CurrentMerchant` connect `CurrentMerchant` to `.updateStatus`, `pages/service.ts`, `index.ts`, `notFound`, `ZernioConnectController`, `store-knowledge/service.ts`, `products/service.ts`, `parse`, `Merchant`, `delivery.controller.ts`, `LabeledExamplesController`, `.reply`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Db` connect `index.ts` to `units.spec.ts`, `harness.ts`, `channels.controller.ts`, `core.module.ts`, `parse`, `delivery.controller.ts`, `LabeledExamplesController`, `.updateStatus`, `pages/service.ts`, `notFound`, `store-knowledge/service.ts`, `products/service.ts`, `types.ts`, `MessagesController`, `Merchant`, `.reply`, `Settings`, `.keyLogin`, `worker/main.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript/no-explicit-any`, `typescript/no-floating-promises` to the rest of the system?**
  _803 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `units.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06558558558558558 - nodes in this community are weakly interconnected._
- **Should `harness.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07474747474747474 - nodes in this community are weakly interconnected._
- **Should `gender.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._