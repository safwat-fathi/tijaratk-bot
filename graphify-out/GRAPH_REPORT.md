# Graph Report - tijaratk-bot  (2026-11-08)

## Corpus Check
- 203 files · ~380,438 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1687 nodes · 3271 edges · 116 communities (100 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4fcbf5c9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- units.spec.ts
- harness.ts
- gender.ts
- TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md
- golden.spec.ts
- devDependencies
- index.ts
- Multi-page: per-page AI control and per-page stats
- devDependencies
- checkout/service.ts
- schema.ts
- compilerOptions
- CoreModule
- TijaratkBot — Product Requirements Document (PRD)
- CurrentMerchant
- getCurrentMerchant
- messages.ts
- orders-client.tsx
- compilerOptions
- training/page.tsx
- delivery.controller.ts
- LabeledExamplesController
- classification.ts
- pipeline.ts
- settings.json
- scripts
- dependencies
- TijaratkBot_SRD.md
- TijaratkBot_PRD.md
- Findings
- labeled-examples.controller.ts
- dal.ts
- merchant/actions.ts
- config.ts
- checkout.controller.ts
- ar.json
- tsconfig.build.json
- en.json
- parse
- ZernioConnectController
- StoreKnowledgeController
- Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price
- Implementation decisions (phases 1-6, built 2026-11-04)
- TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)
- .ingest
- backend/package.json
- HealthController
- fetchKnowledgeAction
- .oxlintrc.json
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- AuthController
- nest-cli.json
- products/service.ts
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
- MerchantsController
- action-resolution.ts
- release.sh
- schemas.ts
- 7. AI Is an Add-On
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
1. `Merchant` - 43 edges
2. `CurrentMerchant` - 43 edges
3. `getSettings()` - 36 edges
4. `getBaseUrl()` - 35 edges
5. `processMessage()` - 34 edges
6. `Db` - 33 edges
7. `notFound()` - 27 edges
8. `parse()` - 27 edges
9. `DbOrTx` - 25 edges
10. `checkResponse()` - 25 edges

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

## Communities (116 total, 16 thin omitted)

### Community 0 - "units.spec.ts"
Cohesion: 0.06
Nodes (71): clusterMessages(), EmbeddedMessage, fetchEmbeddedMessages(), labelCluster(), representativeMessages(), runClustering(), withConversationLock(), cpSlice() (+63 more)

### Community 1 - "harness.ts"
Cohesion: 0.06
Nodes (48): setSettingsForTests(), createAccessToken(), addItem(), CartItemNotFoundError, getItemForConversation(), getOrCreateActiveCart(), removeItem(), updateItem() (+40 more)

### Community 2 - "gender.ts"
Cohesion: 0.11
Nodes (23): detectGenderFromName(), detectGenderFromText(), FEMALE_NAMES, FEMALE_SPOUSAL_RE, FEMALE_TITLES, FIRST_PERSON_FEM_RE, FIRST_PERSON_MASC_RE, MALE_NAMES (+15 more)

### Community 3 - "TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md"
Cohesion: 0.02
Nodes (93): 101. What Not to Build in Phase 1, 102. Recommended Build Order, 103. Final Architecture, 104. The Most Important Engineering Rule, 105. Final Recommendation, 10. Product Detail UX, 11. Variant Resolution, 12. Cart UX (+85 more)

### Community 4 - "golden.spec.ts"
Cohesion: 0.09
Nodes (30): agglomerativeCosine(), ChannelsController, log, Controller, Get, Post, Query, Req (+22 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (39): devDependencies, drizzle-kit, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, oxlint-tsgolint (+31 more)

### Community 7 - "index.ts"
Cohesion: 0.12
Nodes (28): Settings, pools, ApiError, SKIP, CHANNEL_QUEUE_NAME, DB, PROCESS_CHANNEL_MESSAGE, QUEUE (+20 more)

### Community 8 - "Multi-page: per-page AI control and per-page stats"
Cohesion: 0.09
Nodes (21): 10. Non-goals, 1. Context, 2. Decisions I made (flag any you disagree with), 3. Vocabulary, 4.1 Direction, 4.2 Information architecture, 4.3 Screens, 4.4 States, copy and accessibility (+13 more)

### Community 9 - "devDependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, dependencies, @inlang/paraglide-js, @inlang/paraglide-next, lucide-react, next, nextjs-toploader (+33 more)

### Community 10 - "checkout/service.ts"
Cohesion: 0.17
Nodes (22): centsToString(), lineTotalCents(), quantize2(), roundHalfEven(), roundScaledToCents(), scaledProduct(), toBigScaled(), toCents() (+14 more)

### Community 11 - "schema.ts"
Cohesion: 0.06
Nodes (33): Fernet, encryptedString, getFernet(), aiActions, aiUsageEvents, bytea, cartItems, carts (+25 more)

### Community 12 - "compilerOptions"
Cohesion: 0.06
Nodes (30): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+22 more)

### Community 13 - "CoreModule"
Cohesion: 0.40
Nodes (3): CoreModule, Module, Global

### Community 15 - "CurrentMerchant"
Cohesion: 0.06
Nodes (41): notFound(), CurrentMerchant, Merchant, ConversationsController, Body, Controller, Get, HttpCode (+33 more)

### Community 16 - "getCurrentMerchant"
Cohesion: 0.20
Nodes (12): connectFacebookAction(), fetchConversationsAction(), ConversationsPage(), isRedirect(), MerchantDashboard(), CONNECT_ERRORS, SettingsPage(), SettingToggle() (+4 more)

### Community 17 - "messages.ts"
Cohesion: 0.40
Nodes (4): MessageIngestRequest, MessageIngestResponse, OrderDetail, OrderLineItem

### Community 18 - "orders-client.tsx"
Cohesion: 0.15
Nodes (19): createManualOrderAction(), fetchOrdersAction(), fetchProductsAction(), ManualOrderResult, updateOrderStatusAction(), OrdersClient(), isRedirect(), OrdersPage() (+11 more)

### Community 19 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+14 more)

### Community 20 - "training/page.tsx"
Cohesion: 0.22
Nodes (10): getIntents(), getLabeledExamples(), isRedirect(), TrainingPage(), SOURCE_LABELS, TrainingClient(), handleAdd(), handleDelete() (+2 more)

### Community 21 - "delivery.controller.ts"
Cohesion: 0.11
Nodes (21): DeliveryArea, Create, DeliveryController, NOTE: unlike the Python router (which never committed - its writes were rolled…, Body, Controller, Delete, Get (+13 more)

### Community 22 - "LabeledExamplesController"
Cohesion: 0.20
Nodes (7): LabeledExamplesController, Body, Controller, Get, Inject, Post, UseGuards

### Community 24 - "classification.ts"
Cohesion: 0.21
Nodes (18): ConvState, resolveAction(), classifyMessage(), intentResponseSchema(), extractOrder(), CallUsage, llmProvider(), buildSystemPrompt() (+10 more)

### Community 25 - "pipeline.ts"
Cohesion: 0.07
Nodes (50): DbOrTx, Cart, CartItem, ChannelConnection, Conversation, HandoffReason, LabeledExample, Merchant (+42 more)

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
Cohesion: 0.07
Nodes (29): 10. L0 — Deterministic Layer, 11. L1 — Nile-Chat 4B, 12. L2 — DeepSeek V4 Flash, 13. L3 — Human Escalation, 14. AI Action Architecture, 16. Catalog Retrieval, 17. Egyptian Arabic and Arabizi Normalization, 18. Conversation State (+21 more)

### Community 31 - "Findings"
Cohesion: 0.10
Nodes (19): 10. Quota is now check-then-act (low-medium, accepted trade-off with a sharp edge), 11. Usage resets once for every merchant (planned, optional mitigation), 12. Smaller notes, 1. Unrelated change mixed into the same working tree (decide before committing), 2. Large catalogs: false "not in the catalog" answers (medium, both passes), 3. `buildStoreFacts` runs concurrent queries on one transaction client (medium, *verified*), 4. `{merchant_name}` replacement breaks on `$` in the name (low-medium, *verified*), 5. An over-long policy disappears and the model is told there are none (medium, read from code) (+11 more)

### Community 32 - "labeled-examples.controller.ts"
Cohesion: 0.22
Nodes (13): Create, DEFAULT_INTENTS, extraction, intent, Update, createExample(), deleteExample(), embeddingFor() (+5 more)

### Community 33 - "dal.ts"
Cohesion: 0.13
Nodes (12): loginWithKeyAction(), logoutAction(), ERRORS, navigation, SidebarClient(), COOKIES, LOGIN_MARKER, SESSION_COOKIES (+4 more)

### Community 34 - "merchant/actions.ts"
Cohesion: 0.20
Nodes (28): checkResponse(), ConversationRecord, createExampleAction(), createProductAction(), deleteExampleAction(), deleteProductAction(), deleteProductImageAction(), fetchExamplesAction() (+20 more)

### Community 36 - "config.ts"
Cohesion: 0.08
Nodes (22): bool, csvOrJson, FALSE, loadSettings(), schema, TRUE, RateLimitMiddleware, Inject (+14 more)

### Community 37 - "checkout.controller.ts"
Cohesion: 0.12
Nodes (16): CheckoutController, loadItems(), ManualOrder, NOTIFY_STATUSES, StatusUpdate, toOrderRead(), Body, Controller (+8 more)

### Community 39 - "ar.json"
Cohesion: 0.12
Nodes (15): demo_catalog_aka, demo_catalog_egp, demo_catalog_empty, demo_catalog_matched, demo_catalog_no_options, demo_catalog_title, demo_knowledge_empty, demo_knowledge_keywords (+7 more)

### Community 40 - "tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, rootDir, exclude, extends, include, node_modules, dist, **/*spec.ts (+3 more)

### Community 41 - "en.json"
Cohesion: 0.12
Nodes (15): demo_catalog_aka, demo_catalog_egp, demo_catalog_empty, demo_catalog_matched, demo_catalog_no_options, demo_catalog_title, demo_knowledge_empty, demo_knowledge_keywords (+7 more)

### Community 42 - "parse"
Cohesion: 0.17
Nodes (12): parse(), Body, HttpCode, Post, HandoffController, Body, Controller, HttpCode (+4 more)

### Community 43 - "ZernioConnectController"
Cohesion: 0.24
Nodes (7): Controller, Get, Param, Query, Res, UseGuards, ZernioConnectController

### Community 44 - "StoreKnowledgeController"
Cohesion: 0.15
Nodes (11): deleteKnowledge(), StoreKnowledgeController, Body, Controller, Delete, HttpCode, Inject, Param (+3 more)

### Community 47 - "Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price"
Cohesion: 0.18
Nodes (10): AI-engineering review, Context, Decisions built in (override at approval), Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price, Manual steps after merge, Recommended changes (TDD: write W0 first, watch it fail, then W1-W5), Reply to forward to the merchant (Arabic, edit freely), Verification (+2 more)

### Community 48 - "Implementation decisions (phases 1-6, built 2026-11-04)"
Cohesion: 0.25
Nodes (7): Architecture, Decisions, Deliberate behavior differences from Python (all bug-fixes or hardening), Format, Implementation decisions (phases 1-6, built 2026-11-04), Known gaps / follow-ups, NestJS migration: decision log

### Community 49 - "TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)"
Cohesion: 0.05
Nodes (37): Architecture, Backend layout (`backend/src/`), Commands (pnpm, inside `backend/`), ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, Known in-progress / not-yet-implemented, Schema, Testing, Two-stage AI routing (+29 more)

### Community 51 - ".ingest"
Cohesion: 0.20
Nodes (8): ingestInTransaction(), MessagesController, Body, Controller, Inject, Post, Res, UseGuards

### Community 54 - "backend/package.json"
Cohesion: 0.22
Nodes (8): author, description, license, name, packageManager, private, type, version

### Community 56 - "HealthController"
Cohesion: 0.29
Nodes (5): HealthController, RootController, Controller, Get, Inject

### Community 58 - "fetchKnowledgeAction"
Cohesion: 0.30
Nodes (10): createKnowledgeAction(), deleteKnowledgeAction(), fetchKnowledgeAction(), updateKnowledgeAction(), isRedirect(), PoliciesPage(), PoliciesClient(), KNOWLEDGE_TYPES (+2 more)

### Community 59 - ".oxlintrc.json"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 63 - "AuthController"
Cohesion: 0.29
Nodes (5): AuthController, Controller, Get, Inject, UseGuards

### Community 64 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 65 - "products/service.ts"
Cohesion: 0.09
Nodes (34): iso(), num(), StoreKnowledge, getConversationMessages(), listConversations(), isOfferActive(), OfferFields, resolveUnitPrice() (+26 more)

### Community 69 - "prompts.ts"
Cohesion: 0.16
Nodes (16): pyJsonDumps(), buildContextPrompt(), HistoryMessage, PromptExample, PromptMode, truthy(), replyProvider(), CustomerGender (+8 more)

### Community 72 - "TijaratkBot backend (NestJS)"
Cohesion: 0.50
Nodes (3): Layout, Schema changes, TijaratkBot backend (NestJS)

### Community 73 - "getSettings"
Cohesion: 0.12
Nodes (23): AppModule, Module, getSettings(), DetailExceptionFilter, AICallError, AiClient, build(), getEmbeddingClient() (+15 more)

### Community 84 - "MerchantsController"
Cohesion: 0.20
Nodes (8): MerchantsController, read(), Body, Controller, Get, Inject, Patch, UseGuards

### Community 85 - "action-resolution.ts"
Cohesion: 0.43
Nodes (6): ActionResolution, renderResponse(), stripInternal(), ProposedAction, StoreFacts, ActionOutcome

### Community 88 - "schemas.ts"
Cohesion: 0.12
Nodes (19): cpLen(), stripChars(), COST_PER_1K_TOKENS, estimateCost(), J, objectSig(), ours(), sig() (+11 more)

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
Cohesion: 0.21
Nodes (5): cairo, tajawal, Analytics(), WhatsAppWidget(), SITE_URL

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
- **747 isolated node(s):** `$schema`, `typescript/no-explicit-any`, `typescript/no-floating-promises`, `node`, `$schema` (+742 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Merchant` connect `CurrentMerchant` to `labeled-examples.controller.ts`, `checkout.controller.ts`, `index.ts`, `parse`, `ZernioConnectController`, `StoreKnowledgeController`, `.ingest`, `MerchantsController`, `delivery.controller.ts`, `LabeledExamplesController`, `AuthController`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `CurrentMerchant` connect `CurrentMerchant` to `labeled-examples.controller.ts`, `checkout.controller.ts`, `index.ts`, `parse`, `ZernioConnectController`, `StoreKnowledgeController`, `.ingest`, `MerchantsController`, `delivery.controller.ts`, `LabeledExamplesController`, `AuthController`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Db` connect `index.ts` to `labeled-examples.controller.ts`, `units.spec.ts`, `harness.ts`, `checkout.controller.ts`, `parse`, `StoreKnowledgeController`, `CurrentMerchant`, `.ingest`, `MerchantsController`, `delivery.controller.ts`, `LabeledExamplesController`, `AuthController`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript/no-explicit-any`, `typescript/no-floating-promises` to the rest of the system?**
  _747 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `units.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.056022408963585436 - nodes in this community are weakly interconnected._
- **Should `harness.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05543859649122807 - nodes in this community are weakly interconnected._
- **Should `gender.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._