# TijaratkBot --- Facebook Messenger Commerce Bot Implementation Plan

**Version:** 1.0\
**Date:** 2026-09-07\
**Implementation stack:** Next.js + Python FastAPI + PostgreSQL + Redis\
**Phase 1:** Facebook Messenger\
**Phase 2:** WhatsApp\
**Primary design pillar:** Customer-facing UI/UX inside the messaging
channel

------------------------------------------------------------------------

## 1. Executive Summary

This document defines a production-oriented implementation plan for
building TijaratkBot as a commerce bot that can take orders through
Facebook Messenger first and WhatsApp second.

The most important architectural decision is this:

> **Do not build a generic chatbot. Build a commerce interface that
> happens to live inside Messenger/WhatsApp.**

For a catalog of around 300 products, a pure text conversation is a poor
UX. Customers should not be forced to type product names repeatedly or
scroll through hundreds of products in one giant message.

The system should therefore use a **hybrid conversational commerce UX**:

1.  Structured interactive UI for browsing and selecting products.
2.  Natural-language input for questions, search, recommendations, and
    ordering.
3.  A deterministic cart and checkout engine.
4.  AI only where natural language provides real value.
5.  Backend services as the source of truth for products, prices, stock,
    delivery fees, and orders.

The implementation should be split into two major phases:

### Phase 1 --- Facebook Messenger

Build:

-   Facebook Page connection
-   Messenger webhook ingestion
-   Messenger outbound messaging
-   Rich catalog browsing
-   Categories
-   Product cards
-   Product details
-   Variants
-   Cart
-   Checkout
-   Order creation
-   Optional AI commerce layer
-   Merchant dashboard
-   Human takeover

### Phase 2 --- WhatsApp

Reuse the same:

-   Catalog service
-   Product search
-   Cart service
-   Checkout service
-   Order service
-   AI orchestration
-   Merchant dashboard
-   Conversation model

Only the channel adapter and channel-specific UX/delivery constraints
should differ.

This avoids building two independent bots.

------------------------------------------------------------------------

# 2. Product Thesis

TijaratkBot should solve one core problem:

> **Turn a social-media conversation into a structured order with as
> little friction as possible.**

The existing product requirements define two modes:

-   **Catalog Mode:** deterministic product/catalog shopping without AI.
-   **AI Commerce Mode:** Catalog Mode plus natural-language AI
    capabilities.

The AI is an optional add-on rather than a mandatory part of the base
product. This is important both commercially and technically.

The source PRD explicitly describes TijaratkBot as a commerce system
with an AI interaction layer rather than a generic chatbot. The SRD also
requires AI to remain separate from the deterministic commerce core.

------------------------------------------------------------------------

# 3. Critical Design Decision: Do Not Make the Customer Browse 300 Products Linearly

A 300-item catalog changes the UX requirements substantially.

A naive implementation might do:

``` text
Customer:
Show products

Bot:
Product 1
Product 2
Product 3
...
Product 300
```

This is unacceptable.

Instead, use a layered discovery model:

``` text
                  CUSTOMER
                      |
          +-----------+-----------+
          |                       |
       Browse                  Search
          |                       |
     Categories             Natural language
          |                       |
     Subcategories          AI / search engine
          |                       |
     Product cards          Product results
          |                       |
          +-----------+-----------+
                      |
                Product details
                      |
                 Add to cart
                      |
                    Cart
                      |
                  Checkout
                      |
                    Order
```

The customer should almost never need to traverse all 300 items.

------------------------------------------------------------------------

# 4. UI/UX Is a First-Class Technical Requirement

UI/UX is not a presentation layer to be added after the backend.

For this product, the channel UI is part of the product architecture.

The implementation must answer:

-   How does a customer discover a product?
-   How many products can be displayed at once?
-   How does the customer go back?
-   How does the customer change a variant?
-   How does the customer see the cart?
-   How does the customer recover from an accidental selection?
-   How does the customer search 300 products?
-   How does the customer move from conversation to order?
-   What happens if AI misunderstands the customer?
-   How does the customer know that an order was actually created?

The system should optimize for **minimum cognitive load**, not maximum
AI sophistication.

------------------------------------------------------------------------

# 5. Recommended Customer UX

Use three interaction modes.

## Mode A --- Structured browsing

For customers who prefer tapping.

Example:

``` text
Welcome

What would you like to do?

[ Browse Products ]
[ Search Products ]
[ My Cart ]
[ Track Order ]
```

Then:

``` text
Categories

[ T-Shirts ]
[ Pants ]
[ Shoes ]
[ Dresses ]
[ Accessories ]
[ Offers ]
```

Then:

``` text
T-Shirts

[ Product A ]
[ Product B ]
[ Product C ]

[ Next ]
```

The actual number of cards displayed should respect the channel's
current interactive-message limits. Do not design the product around an
assumed unlimited card carousel. Keep the messaging adapter responsible
for pagination and presentation limits.

------------------------------------------------------------------------

## Mode B --- Natural-language search

Customer can type:

> "عايز تيشيرت اسود XL في حدود 700 جنيه"

The backend should interpret:

``` text
category = t-shirt
color = black
size = XL
max_price = 700
```

The catalog service then performs deterministic retrieval.

AI does not invent products.

------------------------------------------------------------------------

## Mode C --- Conversational ordering

Customer can type:

> "عايز 2 من الأسود XL وواحد أبيض L"

The AI extracts the requested intent and candidate attributes.

The commerce backend resolves actual product/variant IDs.

The cart service validates everything.

The customer sees a verified cart summary.

------------------------------------------------------------------------

# 6. The Hybrid UX Principle

The customer should not have to choose between:

-   a rigid bot, or
-   an uncontrolled AI chatbot.

Use both.

### Structured UI for:

-   Categories
-   Product selection
-   Variant selection
-   Cart
-   Checkout
-   Confirmation
-   Retry
-   Navigation

### AI for:

-   Search
-   Questions
-   Recommendations
-   Ambiguous natural language
-   Product comparisons
-   Natural-language cart changes
-   Customer information extraction

This is the central UX architecture.

------------------------------------------------------------------------

# 7. Why This Is Especially Important for 300 Products

A 300-product catalog creates three problems:

### Problem 1 --- Discovery

The customer does not know the exact product name.

### Problem 2 --- Decision overload

Showing too many choices at once increases friction.

### Problem 3 --- Conversation context

Customers naturally refer to previous products:

> "هاتلي التاني ده باللون الأزرق"

The system therefore needs structured conversation state.

Do not depend on the LLM remembering everything from a long message
history.

------------------------------------------------------------------------

# 8. Recommended Customer Conversation Flow

## 8.1 Entry

Customer sends:

> "Hi"

Bot:

``` text
أهلاً بيك في [Store Name]

تحب تعمل إيه؟

[تصفح المنتجات]
[ابحث عن منتج]
[السلة]
```

------------------------------------------------------------------------

## 8.2 Browse

Customer:

> Browse products

Bot:

``` text
اختار القسم:

[ملابس]
[أحذية]
[إكسسوارات]
[عروض]
```

Customer selects:

``` text
ملابس
```

Bot:

``` text
ملابس

[تيشيرتات]
[قمصان]
[بناطيل]
[جاكتات]
```

------------------------------------------------------------------------

# 9. Product Results UX

Do not display 50 products.

Use paginated result sets.

Example:

``` text
تيشيرتات — 37 منتج

[Image]
تيشيرت Basic Black
599 جنيه

[اختار المنتج]

[Image]
تيشيرت Oversize
699 جنيه

[اختار المنتج]

[Image]
تيشيرت Cotton Pro
749 جنيه

[اختار المنتج]

[التالي]
```

The exact number of products per channel response should be
configurable.

------------------------------------------------------------------------

# 10. Product Detail UX

When a customer selects a product:

``` text
تيشيرت Basic Black

599 جنيه

خامة قطن
متوفر

اختار اللون:
[أسود] [أبيض] [رمادي]

اختار المقاس:
[S] [M] [L] [XL]

الكمية:
[-]  1  [+]

[أضف للسلة]
[رجوع]
```

The UI must not ask the customer to type:

> "عايز اللون الأسود مقاس XL كمية 2"

unless the customer prefers conversational interaction.

Buttons should handle common interactions.

------------------------------------------------------------------------

# 11. Variant Resolution

Variants should be selected deterministically.

Example:

``` text
Product
  |
  +-- Black
  |    +-- S
  |    +-- M
  |    +-- L
  |    +-- XL
  |
  +-- White
       +-- S
       +-- M
       +-- L
       +-- XL
```

The frontend/dashboard should represent variants as structured
attributes.

The customer-facing adapter should render those attributes into the
channel's available interaction primitives.

------------------------------------------------------------------------

# 12. Cart UX

The cart should be available at any time.

Example:

``` text
السلة

1x تيشيرت Basic Black - XL
599 جنيه

2x بنطلون Classic - L
1,400 جنيه

الإجمالي: 1,999 جنيه

[تعديل السلة]
[إتمام الطلب]
[متابعة التسوق]
```

Never make the customer reconstruct their cart from conversation
history.

The cart service is authoritative.

------------------------------------------------------------------------

# 13. Checkout UX

Keep checkout short.

Recommended sequence:

``` text
Cart
  |
  v
Name
  |
  v
Phone
  |
  v
Delivery area
  |
  v
Full address
  |
  v
Delivery fee
  |
  v
Final confirmation
  |
  v
Order created
```

If the customer already supplied information in conversation, reuse it
rather than asking again.

------------------------------------------------------------------------

# 14. Natural-Language Checkout

Example:

> "محمد أحمد، 01012345678، 15 شارع التحرير الدقي الدور التالت"

AI extracts:

``` json
{
  "name": "محمد أحمد",
  "phone": "01012345678",
  "address": "15 شارع التحرير الدقي الدور التالت"
}
```

But the AI does not create the order directly.

The backend validates:

``` text
Phone
Address
Delivery area
Cart
Prices
Availability
Delivery fee
```

Then asks for confirmation.

------------------------------------------------------------------------

# 15. Final Confirmation UX

Always show a final authoritative summary.

Example:

``` text
تمام، راجع الأوردر:

تيشيرت Basic Black - XL
الكمية: 2
1,198 جنيه

التوصيل: 50 جنيه

الإجمالي: 1,248 جنيه

العنوان:
15 شارع التحرير، الدقي، الدور الثالث

الموبايل:
01012345678

[تأكيد الأوردر]
[تعديل البيانات]
[تعديل السلة]
```

Only after the customer confirms should `create_order` execute.

------------------------------------------------------------------------

# 16. Order Success UX

After order creation:

``` text
تم تأكيد الأوردر بنجاح.

رقم الأوردر: TK-10452

الإجمالي: 1,248 جنيه

هنجهز طلبك ونتواصل معاك بخصوص التوصيل.
```

The order number must come from the backend.

------------------------------------------------------------------------

# 17. Facebook Messenger Phase 1 Architecture

Recommended architecture:

``` text
                  Facebook Messenger
                         |
                         v
                  Meta Webhook
                         |
                         v
                 FastAPI Webhook
                         |
                         v
                Message Normalizer
                         |
                         v
                Conversation Service
                         |
             +-----------+-----------+
             |                       |
             v                       v
        L0 Router                 AI Router
             |                       |
             |                  L1 / L2
             |                       |
             +-----------+-----------+
                         |
                         v
                 Action Validator
                         |
                         v
                  Commerce Services
                         |
          +--------------+--------------+
          |              |              |
       Catalog          Cart          Order
          |              |              |
          +--------------+--------------+
                         |
                         v
                 Response Builder
                         |
                         v
                 Messenger Adapter
                         |
                         v
                    Facebook
```

------------------------------------------------------------------------

# 18. Phase 1 Scope --- Facebook Messenger

Implement the following first:

## Channel

-   Facebook Page connection
-   Meta webhook verification
-   Message receive webhook
-   Message deduplication
-   Page access token management
-   Send text
-   Send supported interactive/rich messages
-   Delivery/read events where useful
-   Error handling
-   Rate limiting

## Commerce

-   Catalog
-   Categories
-   Product details
-   Variants
-   Cart
-   Checkout
-   Orders
-   Delivery areas

## AI

-   Egyptian Arabic
-   Arabizi
-   Product search
-   FAQ
-   Natural-language cart
-   Natural-language checkout extraction
-   Escalation

## Merchant

-   Dashboard
-   Inbox
-   Catalog management
-   Orders
-   AI settings
-   Human takeover

------------------------------------------------------------------------

# 19. Facebook Webhook Design

FastAPI endpoint:

``` text
GET /webhooks/facebook
POST /webhooks/facebook
```

GET:

-   Verify Meta webhook challenge.

POST:

-   Validate request.
-   Parse event.
-   Identify Page.
-   Resolve tenant.
-   Deduplicate.
-   Persist message.
-   Queue processing.
-   Return quickly.

Do not perform a long AI request before acknowledging the webhook.

------------------------------------------------------------------------

# 20. Webhook Event Pipeline

``` text
Meta
 |
 v
POST /webhooks/facebook
 |
 v
Validate
 |
 v
Deduplicate
 |
 v
Persist event
 |
 v
Queue event
 |
 v
Return 200
 |
 v
Worker
 |
 v
Normalize message
 |
 v
Conversation processor
```

This is important because external webhook systems may retry deliveries.

------------------------------------------------------------------------

# 21. Idempotency

Use the external Meta message/event ID as an idempotency key.

Example:

``` text
facebook:{page_id}:{message_id}
```

Before processing:

``` text
if already_processed:
    acknowledge
else:
    persist and process
```

This prevents duplicate orders and duplicate bot replies.

------------------------------------------------------------------------

# 22. Conversation Locking

Use Redis to prevent simultaneous processing of the same conversation.

Example:

``` text
lock:conversation:{conversation_id}
```

Flow:

``` text
Acquire lock
   |
Process message
   |
Update conversation state
   |
Release lock
```

Use a timeout to avoid deadlocks.

------------------------------------------------------------------------

# 23. Background Jobs

Recommended queue architecture:

``` text
FastAPI
  |
Redis
  |
Worker
```

Jobs:

``` text
process_incoming_message
send_outbound_message
run_ai_request
create_order
sync_catalog
```

For a small MVP, a Redis-backed worker such as RQ, Celery, or Dramatiq
can be used.

Do not introduce Kafka at this stage.

------------------------------------------------------------------------

# 24. FastAPI Application Structure

Recommended:

``` text
app/
├── main.py
├── config.py
├── api/
│   ├── auth.py
│   ├── merchants.py
│   ├── products.py
│   ├── conversations.py
│   ├── orders.py
│   ├── ai.py
│   └── webhooks/
│       └── facebook.py
│
├── domain/
│   ├── merchants/
│   ├── channels/
│   ├── conversations/
│   ├── catalog/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── delivery/
│   └── ai/
│
├── services/
│
├── repositories/
│
├── integrations/
│   ├── meta/
│   │   └── facebook.py
│   ├── ai/
│   │   ├── gateway.py
│   │   ├── nile_chat.py
│   │   └── deepseek.py
│   └── storage/
│
├── workers/
└── tests/
```

The exact organization may vary, but the separation between domain logic
and external providers should remain.

------------------------------------------------------------------------

# 25. Next.js Application Structure

Recommended:

``` text
web/
├── app/
│   ├── login/
│   ├── onboarding/
│   ├── dashboard/
│   │   ├── inbox/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── channels/
│   │   ├── ai/
│   │   └── settings/
│   └── api/
│
├── components/
│   ├── inbox/
│   ├── products/
│   ├── orders/
│   ├── catalog/
│   └── ui/
│
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   └── realtime.ts
│
└── types/
```

Next.js is the merchant-facing application.

The Facebook/WhatsApp customer UI is rendered by the messaging channel
adapter, not by Next.js.

------------------------------------------------------------------------

# 26. Important Architecture Clarification

Next.js does **not** need to render the customer-facing Messenger UI.

The customer-facing UI is constrained by Meta's messaging capabilities.

Next.js should provide:

-   Merchant dashboard
-   Catalog management
-   Conversation inbox
-   Order management
-   Channel connection
-   AI settings
-   Human takeover

FastAPI provides:

-   Webhooks
-   Commerce APIs
-   AI orchestration
-   Channel integrations
-   Business logic

------------------------------------------------------------------------

# 27. Database

Use PostgreSQL.

Core tables:

``` text
tenants
users
channel_connections
customers
conversations
messages

categories
products
product_variants
product_images

carts
cart_items

delivery_areas

orders
order_items

store_knowledge

subscriptions
subscription_addons

ai_requests
ai_actions
ai_usage_events

human_handoffs

webhook_events
```

------------------------------------------------------------------------

# 28. Multi-Tenancy

Every merchant is a tenant.

All tenant-owned data must contain:

``` text
tenant_id
```

Examples:

``` text
products.tenant_id
conversations.tenant_id
orders.tenant_id
customers.tenant_id
store_knowledge.tenant_id
```

Never rely only on a frontend-provided tenant ID.

Resolve tenant context from authenticated user/session or verified
channel connection.

------------------------------------------------------------------------

# 29. Channel Abstraction

Do not put Facebook-specific code inside the commerce engine.

Define:

``` python
class ChannelAdapter(Protocol):
    async def send_text(...): ...
    async def send_product_list(...): ...
    async def send_product_detail(...): ...
    async def send_cart(...): ...
```

Then implement:

``` text
FacebookMessengerAdapter
WhatsAppAdapter
```

The commerce layer calls the interface.

------------------------------------------------------------------------

# 30. Channel Adapter Responsibilities

Each adapter handles:

-   Incoming event parsing
-   Customer identity mapping
-   Message normalization
-   Supported UI primitives
-   Outbound API calls
-   Channel-specific limits
-   Error handling
-   Retry behavior
-   Message IDs
-   Delivery state

The adapter should convert channel-specific structures into a common
internal representation.

------------------------------------------------------------------------

# 31. Internal Message Model

Normalize incoming messages into:

``` json
{
  "channel": "facebook",
  "external_conversation_id": "...",
  "external_message_id": "...",
  "customer_external_id": "...",
  "type": "text",
  "text": "عايز تيشيرت اسود",
  "timestamp": "..."
}
```

The rest of the system should not care whether the message originated
from Facebook or WhatsApp.

------------------------------------------------------------------------

# 32. Outbound Message Model

Create a common internal representation:

``` json
{
  "type": "text",
  "text": "اختار القسم",
  "actions": []
}
```

Or:

``` json
{
  "type": "product_list",
  "products": [
    {
      "product_id": "...",
      "title": "...",
      "price": 599,
      "image_url": "..."
    }
  ],
  "pagination": {
    "next_cursor": "..."
  }
}
```

The Facebook adapter translates this into the currently supported Meta
message format.

The WhatsApp adapter later translates the same semantic response into
WhatsApp-supported interactive messages.

------------------------------------------------------------------------

# 33. Product Pagination

Do not use page numbers internally.

Use cursors where practical.

Example:

``` text
GET /products?category=tshirts&cursor=abc
```

The cursor can represent:

``` text
sort position
product ID
filters
```

This prevents inconsistent pagination when products change.

------------------------------------------------------------------------

# 34. Product Search Architecture

For MVP:

``` text
Customer query
      |
      v
Normalization
      |
      v
Query parser
      |
      v
PostgreSQL search
      |
      v
Ranking
      |
      v
Top N products
```

Use:

-   normalized Arabic
-   Arabizi aliases
-   `pg_trgm`
-   PostgreSQL full-text search
-   category filters
-   price filters
-   variant filters
-   availability

Vector search should not be a launch requirement.

------------------------------------------------------------------------

# 35. Search Query Examples

Input:

``` text
عايز تيشيرت اسود xl
```

Normalized intent:

``` json
{
  "query": "تيشيرت",
  "filters": {
    "color": "black",
    "size": "XL"
  }
}
```

Input:

``` text
3ayz 7aga s3rha a2al mn 500
```

Potential interpretation:

``` json
{
  "query": null,
  "filters": {
    "max_price": 500
  }
}
```

The AI may help parse the query, but actual filtering is done by the
catalog service.

------------------------------------------------------------------------

# 36. AI Architecture

Use a three-tier model:

``` text
L0 — Deterministic
        |
        v
L1 — Fast/Efficient Model
        |
        v
L2 — Escalation Model
        |
        v
L3 — Human
```

The source roadmap already calls for a two-stage AI
classification/extraction pipeline and escalation telemetry. The
implementation should preserve that idea while adapting the application
to FastAPI.

------------------------------------------------------------------------

# 37. L0 --- No AI

Use deterministic logic for:

-   Category button
-   Product button
-   Variant button
-   Add to cart
-   Remove item
-   Increase quantity
-   Decrease quantity
-   View cart
-   Confirm order
-   Cancel
-   Back

This is the cheapest and most reliable path.

------------------------------------------------------------------------

# 38. L1 --- Primary AI

Use the primary fast model for:

-   Egyptian Arabic
-   Arabizi
-   Product search interpretation
-   FAQ
-   Product questions
-   Simple recommendations
-   Customer information extraction
-   Natural-language cart operations

The model should return structured output.

Example:

``` json
{
  "intent": "search_products",
  "confidence": 0.94,
  "arguments": {
    "query": "تيشيرت",
    "filters": {
      "color": "black",
      "size": "XL"
    }
  }
}
```

------------------------------------------------------------------------

# 39. L2 --- Escalation Model

Use DeepSeek V4 Flash only for harder cases.

Escalation examples:

-   Ambiguous product references
-   Multiple products with complex constraints
-   L1 structured-output failure
-   Complex recommendation
-   Complex natural-language order
-   Repeated misunderstanding
-   Difficult address extraction

The goal is not:

``` text
Every message -> DeepSeek
```

The goal is:

``` text
Most messages -> L0/L1
Difficult messages -> L2
```

------------------------------------------------------------------------

# 40. L3 --- Human

If AI still cannot resolve the request:

``` text
AI
 |
 +-- retry
 |
 +-- L2
 |
 +-- human takeover
```

Human takeover must be visible in the merchant inbox.

------------------------------------------------------------------------

# 41. AI Must Never Be the Commerce Source of Truth

AI may say:

> "المنتج متوفر"

only after the catalog service confirms it.

AI must never invent:

-   Price
-   Stock
-   Variant
-   Delivery fee
-   Discount
-   Order total
-   Order number
-   Payment status

All of these come from backend services.

------------------------------------------------------------------------

# 42. AI Tool Layer

Use tools/actions:

``` text
search_products
get_product
get_product_variants

get_cart
add_to_cart
update_cart
remove_from_cart

get_checkout_state
update_customer_info
create_order

search_store_knowledge
```

Each action has a Pydantic schema.

Example:

``` python
class AddToCartItem(BaseModel):
    variant_id: UUID
    quantity: int = Field(gt=0)

class AddToCartAction(BaseModel):
    action: Literal["add_to_cart"]
    items: list[AddToCartItem]
```

------------------------------------------------------------------------

# 43. Action Validation

Pipeline:

``` text
LLM output
   |
   v
Pydantic validation
   |
   v
Tenant validation
   |
   v
Business validation
   |
   v
Commerce service
```

If any validation fails:

``` text
Do not execute.
```

------------------------------------------------------------------------

# 44. AI Context

Do not send the full 300-product catalog to the model.

Instead:

``` text
Recent conversation
+
Conversation state
+
Current cart
+
Top relevant product results
+
Relevant store knowledge
+
Allowed tools
```

Example:

``` text
Conversation:
Customer: عايز تيشيرت اسود XL

Search results:
1. Basic Black — 599 — XL available
2. Oversize Black — 699 — XL available
3. Premium Black — 799 — XL unavailable
```

This is dramatically cheaper and easier for the model to reason over.

------------------------------------------------------------------------

# 45. Conversation State

Store structured state:

``` json
{
  "intent": "shopping",
  "last_search_query": "تيشيرت اسود",
  "last_product_ids": [
    "p1",
    "p2"
  ],
  "current_product_id": "p1",
  "selected_variant_id": "v17",
  "cart_id": "cart123",
  "checkout_stage": null
}
```

This allows:

> "هات التاني"

to resolve against the last displayed result set without sending the
entire conversation to the model.

------------------------------------------------------------------------

# 46. Store Knowledge

Separate product data from merchant knowledge.

Knowledge examples:

``` text
Shipping
Returns
Exchanges
Payment
Working hours
Delivery time
Store policy
FAQ
```

Use PostgreSQL full-text retrieval initially.

Later:

``` text
PostgreSQL + pgvector
```

can be introduced for semantic retrieval.

------------------------------------------------------------------------

# 47. AI Cost Strategy

The biggest cost mistake would be sending every customer message to an
expensive model.

Use:

``` text
Button interaction -> L0
Simple FAQ/search -> L1
Complex request -> L2
Unresolved -> Human
```

Also:

-   Limit prompt size.
-   Retrieve only relevant products.
-   Store structured state.
-   Avoid resending old conversation history.
-   Cache merchant knowledge.
-   Track tokens per conversation.
-   Track AI cost per order.

The existing product research estimates AI inference can be a small part
of overall unit cost when lightweight models and selective escalation
are used. Treat that as an initial hypothesis and replace it with
measured production economics.

------------------------------------------------------------------------

# 48. Important Correction to Messaging-Cost Strategy

Do not design the architecture around the assumption that "Facebook
messages are free" or that WhatsApp will always have one fixed session
cost.

Meta's pricing, eligibility rules, message types, and policies can
change.

The architecture should instead:

1.  Isolate messaging costs from SaaS subscription revenue.
2.  Record outbound message type and channel.
3.  Maintain a channel cost ledger.
4.  Make channel pricing configurable.
5.  Re-check Meta's current commercial terms before launch.

The customer-facing product should not depend on hard-coded historical
pricing assumptions.

------------------------------------------------------------------------

# 49. Facebook UX Should Be Built Before AI

A common mistake is to start with:

``` text
Webhook
-> LLM
-> reply
```

That produces a chatbot, not a commerce product.

Instead implement:

``` text
Catalog
-> Product UI
-> Cart
-> Checkout
-> Order
```

first.

Then add:

``` text
AI search
AI questions
AI ordering
```

on top.

This creates a fallback path when AI fails.

------------------------------------------------------------------------

# 50. Recommended MVP Customer UX

Minimum commands/actions:

``` text
Start
Browse products
Search
View product
Select variant
Add to cart
View cart
Edit cart
Checkout
Confirm order
Cancel
Talk to human
```

The customer should always have a deterministic path to complete an
order.

------------------------------------------------------------------------

# 51. Merchant Dashboard UX

The merchant dashboard should have five primary areas:

``` text
Inbox
Products
Orders
Channels
Settings
```

AI should be a section under settings or inbox rather than the entire
application.

------------------------------------------------------------------------

# 52. Inbox UX

Desktop layout:

``` text
+----------------+--------------------------+------------------+
| Conversations  | Conversation             | Customer / Order |
|                |                          |                  |
| Ahmed          | Customer: ...            | Customer         |
| Mohamed        | Bot: ...                 | Phone            |
| Sara           | Customer: ...            | Address          |
|                |                          | Cart             |
|                | [Reply box]              | Order            |
+----------------+--------------------------+------------------+
```

Show:

-   Channel
-   Customer
-   Last message
-   AI/human state
-   Order state
-   Unread state

------------------------------------------------------------------------

# 53. Human Takeover UX

The merchant should have an obvious action:

``` text
[Take over conversation]
```

When active:

``` text
AI paused
Human mode active
```

The AI must not send customer-facing messages until the merchant returns
control.

Button:

``` text
[Return to AI]
```

------------------------------------------------------------------------

# 54. Product Management UX

Product creation should be simple.

Fields:

``` text
Name
Description
Price
Category
Images
Variants
Availability
```

Variant editor:

``` text
Color
Size
SKU
Price
Stock
```

Bulk import should be considered early because merchants with 300
products should not have to enter everything manually.

Recommended MVP import:

``` text
CSV / Excel
```

The import pipeline should validate rows before committing them.

------------------------------------------------------------------------

# 55. Catalog Import Flow

``` text
Upload CSV
   |
   v
Preview
   |
   v
Validate
   |
   +-- Errors -> Show row-level errors
   |
   v
Confirm import
   |
   v
Create/update products
```

Do not silently import malformed products.

------------------------------------------------------------------------

# 56. Product Image Storage

Use object storage for images.

Database stores:

``` text
image_url
storage_key
alt_text
sort_order
```

Do not store large image binaries directly in PostgreSQL.

Use CDN-backed URLs where practical.

------------------------------------------------------------------------

# 57. API Design

Example endpoints:

## Authentication

``` text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Products

``` text
GET    /api/products
POST   /api/products
GET    /api/products/{id}
PATCH  /api/products/{id}
DELETE /api/products/{id}
POST   /api/products/import
```

## Conversations

``` text
GET  /api/conversations
GET  /api/conversations/{id}
POST /api/conversations/{id}/reply
POST /api/conversations/{id}/takeover
POST /api/conversations/{id}/return-to-ai
```

## Orders

``` text
GET   /api/orders
GET   /api/orders/{id}
PATCH /api/orders/{id}
```

## Channels

``` text
GET  /api/channels
POST /api/channels/facebook/connect
DELETE /api/channels/{id}
```

------------------------------------------------------------------------

# 58. Facebook Connection Flow

Recommended merchant UX:

``` text
Dashboard
   |
   v
Channels
   |
   v
Connect Facebook
   |
   v
Meta authorization
   |
   v
Select Page
   |
   v
Grant permissions
   |
   v
Callback
   |
   v
Validate Page
   |
   v
Store channel connection
   |
   v
Subscribe webhook
   |
   v
Test message
```

Do not ask the merchant to manually copy tokens.

------------------------------------------------------------------------

# 59. Token Management

Store Meta credentials securely.

Recommended:

``` text
Database
  encrypted token
```

or a secrets manager for production.

Never:

``` text
console.log(access_token)
```

Never expose access tokens to Next.js browser code.

------------------------------------------------------------------------

# 60. Authentication Architecture

Recommended:

``` text
Browser
  |
  v
Next.js
  |
  v
FastAPI
```

The browser should authenticate against the application.

Channel credentials remain server-side.

Use:

-   Secure HTTP-only cookies or an equivalent secure session mechanism.
-   CSRF protection where applicable.
-   Role checks for merchant users.

------------------------------------------------------------------------

# 61. Realtime Dashboard

The merchant inbox should feel live.

Recommended MVP:

``` text
WebSocket
```

or Server-Sent Events.

Events:

``` text
message.created
message.updated
conversation.updated
order.created
order.updated
human_handoff.created
```

If WebSockets add unnecessary complexity initially, short polling can be
used for the first internal MVP, then upgraded.

------------------------------------------------------------------------

# 62. Order Lifecycle

Use deterministic statuses:

``` text
new
confirmed
processing
shipped
delivered
cancelled
```

For MVP, do not build a huge fulfillment state machine.

------------------------------------------------------------------------

# 63. Order Creation Transaction

Order creation should be atomic.

Conceptually:

``` text
BEGIN

validate cart
validate variants
validate availability
validate customer
validate delivery
calculate totals
snapshot order items
create order
mark cart checked out

COMMIT
```

If anything fails:

``` text
ROLLBACK
```

The customer must not receive an order-confirmed message unless the
transaction succeeds.

------------------------------------------------------------------------

# 64. Stock Strategy

For the first MVP, stock can be represented as:

``` text
in_stock
out_of_stock
```

or an integer quantity.

If using quantities:

``` text
available_quantity
```

must be validated before order creation.

Avoid building a complicated inventory reservation system unless real
merchants require it.

------------------------------------------------------------------------

# 65. Delivery

Merchant configures delivery areas:

``` text
Governorate
City
Area
Fee
Estimated delivery
```

Example:

``` text
Dokki
50 EGP
1-2 days
```

The delivery service returns the authoritative fee.

------------------------------------------------------------------------

# 66. Phone Normalization

Normalize independently of AI.

Accept:

``` text
01012345678
+201012345678
201012345678
٠١٠١٢٣٤٥٦٧٨
```

Store a canonical representation.

Do not let an LLM decide whether a phone number is valid.

------------------------------------------------------------------------

# 67. Address Strategy

Do not attempt to build a perfect Egyptian address parser in MVP.

Use:

``` text
AI extraction
+
basic deterministic validation
+
customer confirmation
+
human fallback
```

If the address is ambiguous:

``` text
ممكن توضح المنطقة أو الشارع؟
```

If still ambiguous:

``` text
Human takeover
```

------------------------------------------------------------------------

# 68. Error UX

The customer should never see:

``` text
500 Internal Server Error
```

Instead:

``` text
معلش حصلت مشكلة بسيطة وأنا بجهز الطلب.

ممكن تجرب تاني؟

[إعادة المحاولة]
[التحدث مع موظف]
```

Log the technical error internally.

------------------------------------------------------------------------

# 69. AI Failure UX

If the model misunderstands:

``` text
مش متأكد إني فهمت حضرتك صح.

تقصد:

[تيشيرت Basic Black]
[تيشيرت Oversize Black]
[اختار منتج تاني]
```

This is better than hallucinating.

------------------------------------------------------------------------

# 70. Search UX When Results Are Poor

If there are no exact results:

``` text
ملقتش منتج مطابق تماماً.

ممكن تجرب:

[تيشيرت]
[ملابس سوداء]
[منتجات أقل من 700 جنيه]
```

Or AI can suggest close alternatives based on actual catalog results.

------------------------------------------------------------------------

# 71. Conversation Memory UX

Do not show AI internal reasoning.

Show only:

-   customer-facing responses
-   selected products
-   cart
-   order status

Merchant may optionally see structured AI events for debugging.

------------------------------------------------------------------------

# 72. AI Observability

Track:

``` text
tenant_id
conversation_id
message_id
tier
provider
model
input_tokens
output_tokens
latency_ms
estimated_cost
intent
action
action_success
escalation_reason
human_handoff
order_created
```

This is essential for determining whether AI is economically viable.

------------------------------------------------------------------------

# 73. Metrics

## UX metrics

-   Search-to-product-click rate
-   Product-to-cart rate
-   Cart-to-checkout rate
-   Checkout completion rate
-   Average turns to order
-   Abandonment rate
-   Human handoff rate

## AI metrics

-   L0 rate
-   L1 rate
-   L2 rate
-   L3 rate
-   Action success
-   Product resolution
-   Invalid output
-   Customer correction
-   AI-assisted order rate

## Business metrics

-   Orders
-   Conversion
-   Revenue
-   Subscription
-   AI cost/order
-   Messaging cost/order
-   Gross margin

------------------------------------------------------------------------

# 74. Unit Economics

Track costs per:

``` text
conversation
customer
cart
order
merchant
```

Recommended metric:

``` text
AI Cost per Confirmed Order
```

and:

``` text
Messaging Cost per Confirmed Order
```

Then:

``` text
Contribution Margin per Merchant
=
Subscription Revenue
- AI Cost
- Messaging Cost
- Variable Infrastructure
- Payment Fees
```

Do not rely on theoretical token estimates once real traffic exists.

------------------------------------------------------------------------

# 75. Cost Controls

For every merchant:

``` text
AI usage
L1 usage
L2 usage
messages
orders
```

should be measurable.

If usage becomes abnormal:

``` text
Detect
 -> classify
 -> notify
 -> enforce fair use if necessary
```

Do not expose a complicated technical meter to small merchants.

------------------------------------------------------------------------

# 76. Recommended Infrastructure

Initial production:

``` text
                 Cloudflare
                     |
                     v
                 Next.js
                     |
                     v
                 FastAPI
                     |
          +----------+----------+
          |                     |
          v                     v
      PostgreSQL              Redis
                                |
                                v
                              Worker
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
         AI Gateway                          Meta APIs
             |
       +-----+------+
       |            |
       v            v
   L1 Model      DeepSeek
```

------------------------------------------------------------------------

# 77. AI Model Hosting

If running the primary model yourself:

``` text
vLLM
+
GPU instance
```

Keep the model server private.

Only FastAPI/AI Gateway should reach it.

Example:

``` text
FastAPI -> http://nile-chat:8000
```

not:

``` text
Internet -> vLLM
```

------------------------------------------------------------------------

# 78. Development Environments

Use:

``` text
Docker Compose
```

for local development.

Services:

``` text
frontend
backend
postgres
redis
worker
```

Optional:

``` text
ai-server
```

For developers without a GPU, allow the AI Gateway to point to an
external development provider.

------------------------------------------------------------------------

# 79. Repository Layout

Recommended monorepo:

``` text
tijaratkbot/
├── web/
│   └── Next.js
│
├── api/
│   └── FastAPI
│
├── worker/
│   └── background jobs
│
├── infra/
│   ├── docker/
│   └── nginx/
│
├── docs/
│
└── docker-compose.yml
```

If the existing repository already has a different layout, migrate
incrementally rather than rewriting everything.

------------------------------------------------------------------------

# 80. Testing Strategy

## Backend unit tests

Test:

-   Catalog search
-   Arabic normalization
-   Arabizi normalization
-   Phone normalization
-   Cart
-   Checkout
-   Delivery
-   Order creation
-   Action validation
-   Tenant isolation

## Integration tests

Test:

``` text
Webhook
-> Conversation
-> AI
-> Action
-> Catalog
-> Cart
-> Checkout
-> Order
```

## Channel tests

Test Facebook payloads using saved fixtures.

------------------------------------------------------------------------

# 81. AI Evaluation Dataset

Create a dedicated Egyptian ecommerce test dataset.

At minimum:

``` text
100–200 labeled conversations
```

Include:

-   Egyptian Arabic
-   Arabizi
-   Arabic + English
-   Typos
-   Product searches
-   Variant requests
-   Quantities
-   Multi-product orders
-   Recommendations
-   FAQ
-   Address extraction
-   Phone extraction
-   Ambiguous messages
-   Human handoff

Then grow the dataset using anonymized production examples.

------------------------------------------------------------------------

# 82. UX Test Dataset

Do not test only whether the model understood the message.

Test whether the customer completed the task.

Examples:

### Task

Find a black XL T-shirt.

Measure:

``` text
Time to product
Number of messages
Number of taps
Search retries
Abandonment
```

### Task

Buy two products.

Measure:

``` text
Time to checkout
Cart modifications
Checkout abandonment
```

The product should optimize these metrics.

------------------------------------------------------------------------

# 83. Phase 1 Delivery Plan

## Milestone 1 --- Foundation

Build:

-   FastAPI
-   Next.js
-   PostgreSQL
-   Redis
-   Authentication
-   Tenant model
-   Basic dashboard

Deliverable:

``` text
Merchant can create an account and store.
```

------------------------------------------------------------------------

## Milestone 2 --- Catalog

Build:

-   Categories
-   Products
-   Variants
-   Images
-   CSV import
-   Product search
-   Catalog dashboard

Deliverable:

``` text
Merchant can load 300 products.
```

------------------------------------------------------------------------

## Milestone 3 --- Commerce Core

Build:

-   Cart
-   Checkout
-   Delivery
-   Customer
-   Orders
-   Order confirmation

Deliverable:

``` text
A simulated customer can complete an order without AI.
```

This is the most important technical milestone.

------------------------------------------------------------------------

## Milestone 4 --- Facebook Integration

Build:

-   Meta app
-   Page connection
-   Webhook
-   Message normalization
-   Outbound messaging
-   Idempotency
-   Channel adapter

Deliverable:

``` text
Facebook customer message -> FastAPI -> response
```

------------------------------------------------------------------------

## Milestone 5 --- Messenger Catalog UX

Build:

-   Welcome
-   Categories
-   Product lists
-   Product details
-   Variant selection
-   Cart
-   Checkout
-   Confirmation

Deliverable:

``` text
Customer can place an order entirely through Messenger UI.
```

------------------------------------------------------------------------

## Milestone 6 --- AI Layer

Build:

-   L0 router
-   L1 provider
-   L2 provider
-   AI Gateway
-   Action schemas
-   Action validator
-   Conversation state
-   Product retrieval
-   Knowledge retrieval
-   Human escalation

Deliverable:

``` text
Customer can naturally ask for products and place an order.
```

------------------------------------------------------------------------

## Milestone 7 --- Merchant Inbox

Build:

-   Conversation list
-   Conversation detail
-   Customer context
-   Cart context
-   Order context
-   AI state
-   Human takeover

Deliverable:

``` text
Merchant can supervise and take over conversations.
```

------------------------------------------------------------------------

## Milestone 8 --- Observability and Billing

Build:

-   AI telemetry
-   Channel usage
-   Cost tracking
-   Subscription
-   AI add-on
-   Usage enforcement
-   Error monitoring

Deliverable:

``` text
You can calculate the actual cost and margin of every merchant.
```

------------------------------------------------------------------------

# 84. Phase 1 Acceptance Test

A merchant should be able to:

1.  Register.
2.  Create store.
3.  Import 300 products.
4.  Configure categories.
5.  Configure variants.
6.  Configure delivery areas.
7.  Connect a Facebook Page.
8.  Send a test message.
9.  Customer browses categories.
10. Customer opens product.
11. Customer selects variant.
12. Customer adds to cart.
13. Customer checks out.
14. Customer confirms order.
15. Merchant sees order.
16. Merchant sees conversation.
17. Merchant can take over.
18. AI can be enabled.
19. Customer can search naturally.
20. AI can create a validated cart action.
21. AI can extract customer information.
22. Backend creates an order only after validation and confirmation.

------------------------------------------------------------------------

# 85. Phase 2 --- WhatsApp

WhatsApp should be implemented as a new channel adapter, not a new
product.

Architecture:

``` text
                     Commerce Core
                          |
          +---------------+---------------+
          |                               |
          v                               v
 Facebook Adapter                   WhatsApp Adapter
          |                               |
          v                               v
      Messenger                       WhatsApp
```

Reuse:

``` text
Catalog
Search
Cart
Checkout
Orders
Delivery
AI
Knowledge
Human takeover
Dashboard
Billing
Telemetry
```

------------------------------------------------------------------------

# 86. WhatsApp Phase 2 Scope

Implement:

-   WhatsApp Business connection
-   Webhook
-   Message normalization
-   Outbound messaging
-   Interactive product/category UX
-   Cart
-   Checkout
-   Order
-   AI
-   Human takeover
-   Messaging cost ledger

Before implementation, verify Meta's current WhatsApp Business Platform
requirements, message categories, templates, pricing, and business
verification rules.

Do not copy historical WhatsApp assumptions into production code.

------------------------------------------------------------------------

# 87. Channel-Neutral Commerce API

The following endpoints should remain channel-independent:

``` text
GET /catalog
GET /products
GET /products/{id}

POST /carts
GET /carts/{id}
POST /carts/{id}/items
PATCH /carts/{id}/items/{item_id}
DELETE /carts/{id}/items/{item_id}

POST /checkout/validate
POST /orders
GET /orders/{id}
```

Facebook and WhatsApp should only determine how customer interaction
reaches these APIs.

------------------------------------------------------------------------

# 88. Channel-Neutral AI

The AI should receive:

``` text
NormalizedMessage
+
ConversationState
+
CatalogContext
+
CartContext
```

not:

``` text
FacebookPayload
```

or:

``` text
WhatsAppPayload
```

This makes the AI reusable.

------------------------------------------------------------------------

# 89. UI/UX Design System

The Next.js dashboard should establish a simple design system early.

Components:

``` text
Button
Input
Select
Modal
Drawer
Table
Card
Badge
Tabs
Toast
EmptyState
LoadingState
ErrorState
ConversationBubble
ProductCard
OrderSummary
```

Customer-channel UI should use a semantic component model:

``` text
Text
Image
ProductList
ProductDetail
ChoiceList
ActionButton
CartSummary
CheckoutSummary
```

The channel adapter decides how each semantic component is represented.

------------------------------------------------------------------------

# 90. Semantic Message UI Layer

This is a particularly important architectural recommendation.

Instead of business code generating Facebook-specific payloads:

Bad:

``` python
send_facebook_generic_template(...)
```

Use:

``` python
response = ProductList(
    title="تيشيرتات",
    products=[...]
)
```

Then:

``` text
ProductList
   |
   +--> FacebookRenderer
   |
   +--> WhatsAppRenderer
```

This dramatically reduces duplication between Phase 1 and Phase 2.

------------------------------------------------------------------------

# 91. UX Fallback Strategy

Every important action needs a fallback.

Example:

``` text
AI search
   |
   +-- success -> results
   |
   +-- uncertain -> clarification
   |
   +-- failure -> category browsing
   |
   +-- repeated failure -> human
```

Never make AI failure equal to commerce failure.

------------------------------------------------------------------------

# 92. Accessibility and Usability

Even though the customer is using Messenger/WhatsApp:

-   Keep text short.
-   Use clear Arabic.
-   Avoid technical terms.
-   Keep buttons/action labels explicit.
-   Always provide a back path.
-   Always provide cart access.
-   Avoid unnecessary questions.
-   Confirm irreversible actions.
-   Do not force customers to restart after an error.

------------------------------------------------------------------------

# 93. Egyptian Arabic UX Guidelines

Customer-facing copy should be:

-   Natural Egyptian Arabic.
-   Short.
-   Friendly.
-   Commercially clear.
-   Consistent.

Avoid overly formal language.

Prefer:

``` text
اختار المنتج
أضف للسلة
كمّل الطلب
أكد الأوردر
```

over overly formal wording.

AI should follow the merchant's configured tone where possible.

------------------------------------------------------------------------

# 94. Do Not Over-Automate

Not every message needs AI.

Examples:

``` text
"السلة"
```

should not require a large model.

``` text
"زود الكمية"
```

should use deterministic state.

``` text
"عايز حاجة شبه اللي فاتت بس أرخص"
```

may require AI.

This distinction is essential for both UX and cost.

------------------------------------------------------------------------

# 95. Security Boundaries

Required:

-   HTTPS
-   Secure sessions
-   Tenant isolation
-   Webhook verification
-   Meta token protection
-   Input validation
-   Pydantic schemas
-   AI output validation
-   Rate limiting
-   Audit logging
-   Secret management

Customer input is untrusted.

Never let customer text directly become:

``` text
SQL
database command
arbitrary tool call
```

------------------------------------------------------------------------

# 96. AI Prompt Injection Defense

Treat customer messages as untrusted.

The model must not be allowed to:

-   Reveal system prompts.
-   Reveal secrets.
-   Change prices.
-   Create unauthorized discounts.
-   Access another merchant.
-   Execute arbitrary database queries.
-   Override commerce validation.
-   Mark an order as confirmed without customer confirmation.

The backend remains the final authority.

------------------------------------------------------------------------

# 97. Rate Limiting

Protect:

``` text
Webhook endpoints
Authentication
Merchant APIs
Search
AI
Outbound messaging
```

Use Redis-backed rate limits where necessary.

------------------------------------------------------------------------

# 98. Retry Policy

External APIs can fail.

Use bounded retries with exponential backoff.

Do not blindly retry order creation.

For order creation, use idempotency.

For outbound messages:

``` text
message_id
+
delivery_attempt
```

must be tracked.

------------------------------------------------------------------------

# 99. Audit Trail

For each order, maintain:

``` text
created_by
source_conversation
source_channel
AI-assisted
human-assisted
created_at
updated_at
```

For important state changes:

``` text
order.confirmed
order.cancelled
human_takeover
ai_enabled
channel_connected
```

------------------------------------------------------------------------

# 100. Production Readiness Checklist

## Facebook

-   [ ] Meta app configured
-   [ ] Page connection works
-   [ ] Webhook verification works
-   [ ] Webhook signature/security checks implemented
-   [ ] Duplicate events handled
-   [ ] Outbound messaging works
-   [ ] Failure/retry behavior tested

## Commerce

-   [ ] 300-product catalog tested
-   [ ] Product search tested
-   [ ] Variants tested
-   [ ] Cart tested
-   [ ] Checkout tested
-   [ ] Delivery tested
-   [ ] Order transaction tested
-   [ ] Duplicate order protection tested

## AI

-   [ ] L0 implemented
-   [ ] L1 implemented
-   [ ] L2 implemented
-   [ ] Structured output validated
-   [ ] Tool/action validation implemented
-   [ ] AI cost tracked
-   [ ] Human escalation implemented

## UX

-   [ ] Browse flow tested
-   [ ] Search flow tested
-   [ ] Product flow tested
-   [ ] Cart flow tested
-   [ ] Checkout flow tested
-   [ ] Error recovery tested
-   [ ] Human takeover tested
-   [ ] Mobile merchant dashboard tested

------------------------------------------------------------------------

# 101. What Not to Build in Phase 1

Do not delay Facebook MVP for:

-   WhatsApp
-   Instagram
-   Vector database
-   Voice AI
-   Image search
-   Shipping-company integrations
-   Payment ecosystem
-   Advanced coupons
-   Marketing automation
-   Complex analytics
-   AI-generated content
-   Multi-country support

The existing roadmap explicitly places WhatsApp, payments, shipping
integrations, semantic search, advanced recommendations, and other
extensions after the initial MVP.

------------------------------------------------------------------------

# 102. Recommended Build Order

The most important ordering is:

``` text
1. Commerce domain
2. Catalog
3. Cart
4. Checkout
5. Orders
6. Messenger adapter
7. Messenger UI
8. Merchant dashboard
9. AI L0
10. AI L1
11. AI L2
12. Human takeover
13. Observability
14. Billing
15. WhatsApp adapter
```

Do not reverse this into:

``` text
LLM
-> chatbot
-> later figure out orders
```

That approach will produce a fragile system.

------------------------------------------------------------------------

# 103. Final Architecture

The recommended final architecture is:

``` text
                           CUSTOMER
                              |
                 +------------+------------+
                 |                         |
              Facebook                 WhatsApp
               Phase 1                  Phase 2
                 |                         |
                 +------------+------------+
                              |
                       Channel Adapters
                              |
                       Message Normalizer
                              |
                       Conversation Service
                              |
                    +---------+---------+
                    |                   |
                   L0              AI Orchestrator
                    |                   |
                    |              +----+----+
                    |              |         |
                    |             L1         L2
                    |              |         |
                    +--------------+---------+
                                   |
                           Action Validator
                                   |
                         Deterministic Commerce
                                   |
          +----------------+-------+-------+----------------+
          |                |               |                |
       Catalog            Cart          Checkout          Orders
          |                |               |                |
          +----------------+---------------+----------------+
                                   |
                              PostgreSQL
                                   |
                                Redis
                                   |
                         Background Workers

                         Merchant Dashboard
                              Next.js
                                   |
                              FastAPI API
```

------------------------------------------------------------------------

# 104. The Most Important Engineering Rule

The system should be designed around this invariant:

> **The customer may communicate however they want, but the commerce
> system must operate deterministically.**

For example:

``` text
Customer:
"3ayz el black xl w 2 mn el abyad"

        |
        v

AI:
understands intent

        |
        v

Catalog:
resolves actual variants

        |
        v

Cart:
adds validated variants

        |
        v

Checkout:
validates customer

        |
        v

Order:
creates authoritative order

        |
        v

Messenger:
renders confirmation
```

This gives TijaratkBot the best combination of:

-   Good UX
-   Low AI cost
-   High reliability
-   Easy debugging
-   Easy Facebook implementation
-   Easy WhatsApp expansion
-   Strong tenant isolation
-   Clear unit economics

------------------------------------------------------------------------

# 105. Final Recommendation

For a 300-product merchant catalog, the best solution is **not** a fully
AI-driven chat experience.

Build a **hybrid conversational commerce engine**:

``` text
Structured UI
     +
Fast catalog search
     +
Deterministic cart/checkout
     +
Optional AI
     +
Human fallback
```

Facebook Messenger should be the first production channel.

WhatsApp should be Phase 2 and should plug into the same commerce core
through a channel adapter.

The strongest implementation strategy is therefore:

> **Build the commerce engine once, build Messenger as the first
> channel, and treat AI as an interaction layer rather than the
> foundation of the ordering system.**
