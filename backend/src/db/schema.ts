import { pgTable, customType, varchar, text, index, foreignKey, integer, doublePrecision, boolean, timestamp, json, uniqueIndex, vector, numeric, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { encryptedString } from "./encrypted-string.js"

export const cartstatus = pgEnum("cartstatus", ['ACTIVE', 'CHECKED_OUT'])
export const channel = pgEnum("channel", ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP'])
export const convstate = pgEnum("convstate", ['NEW', 'GATHERING', 'CONFIRMING', 'COMPLETED', 'ABANDONED'])
export const deliveryareastatus = pgEnum("deliveryareastatus", ['ACTIVE', 'INACTIVE'])
export const direction = pgEnum("direction", ['INBOUND', 'OUTBOUND'])
export const handoffreason = pgEnum("handoffreason", ['USER_REQUEST', 'AI_ESCALATION', 'MERCHANT_TAKEOVER'])
export const merchantstatus = pgEnum("merchantstatus", ['ACTIVE', 'SUSPENDED'])
export const modeltier = pgEnum("modeltier", ['RULE', 'DEEPSEEK'])
export const ordersource = pgEnum("ordersource", ['AI_EXTRACTION', 'CART_CHECKOUT', 'MANUAL'])
export const orderstatus = pgEnum("orderstatus", ['AUTO_CONFIRMED', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'GATHERING_ITEMS', 'FAILED_VALIDATION'])
export const variantstatus = pgEnum("variantstatus", ['ACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'])


export const aiUsageEvents = pgTable("ai_usage_events", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	conversationId: varchar("conversation_id"),
	messageId: varchar("message_id"),
	tier: varchar().notNull(),
	provider: varchar().notNull(),
	model: varchar().notNull(),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	latencyMs: doublePrecision("latency_ms").notNull(),
	estimatedCost: doublePrecision("estimated_cost"),
	success: boolean().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_ai_usage_events_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("ix_ai_usage_events_message_id").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	index("ix_ai_usage_events_tier").using("btree", table.tier.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "ai_usage_events_conversation_id_fkey"
		}),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "ai_usage_events_message_id_fkey"
		}),
]);

export const webhookEvents = pgTable("webhook_events", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	channel: channel().notNull(),
	rawPayload: json("raw_payload"),
	receivedAt: timestamp("received_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	processingError: varchar("processing_error"),
});

export const aiActions = pgTable("ai_actions", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	conversationId: varchar("conversation_id").notNull(),
	messageId: varchar("message_id").notNull(),
	actionType: varchar("action_type").notNull(),
	arguments: json().notNull(),
	status: varchar().notNull(),
	errors: json().notNull(),
	result: json(),
	createdAt: timestamp("created_at", { mode: 'date' }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
	index("ix_ai_actions_action_type").using("btree", table.actionType.asc().nullsLast().op("text_ops")),
	index("ix_ai_actions_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("ix_ai_actions_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	index("ix_ai_actions_message_id").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	index("ix_ai_actions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "ai_actions_conversation_id_fkey"
		}),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "ai_actions_merchant_id_fkey"
		}),
]);

export const messages = pgTable("messages", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	conversationId: varchar("conversation_id").notNull(),
	direction: direction().notNull(),
	rawText: varchar("raw_text"),
	normalizedText: varchar("normalized_text"),
	intent: varchar(),
	intentConfidence: doublePrecision("intent_confidence"),
	modelTier: modeltier("model_tier"),
	escalationReason: varchar("escalation_reason"),
	embedding: vector({ dimensions: 1024 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	clusteredAt: timestamp("clustered_at", { withTimezone: true, mode: 'date' }),
	externalMessageId: varchar("external_message_id"),
	messageType: varchar("message_type"),
	richPayload: json("rich_payload"),
	postbackPayload: json("postback_payload"),
	aiAnswered: boolean("ai_answered").default(false).notNull(),
}, (table) => [
	index("ix_messages_conversation_id_created_at").using("btree", table.conversationId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast()),
	uniqueIndex("ix_messages_external_message_id_unique").using("btree", table.externalMessageId.asc().nullsLast().op("text_ops")).where(sql`(external_message_id IS NOT NULL)`),
	index("ix_messages_intent").using("btree", table.intent.asc().nullsLast().op("text_ops")),
	index("messages_embedding_hnsw_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_fkey"
		}),
]);

export const carts = pgTable("carts", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	conversationId: varchar("conversation_id").notNull(),
	status: cartstatus().default('ACTIVE').notNull(),
	createdAt: timestamp("created_at", { mode: 'date' }).$defaultFn(() => new Date()).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'date' }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
	index("ix_carts_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("ix_carts_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_carts_one_active_per_conversation").using("btree", table.conversationId.asc().nullsLast().op("text_ops")).where(sql`(status = 'ACTIVE'::cartstatus)`),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "carts_conversation_id_fkey"
		}),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "carts_merchant_id_fkey"
		}),
]);

export const products = pgTable("products", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	name: varchar().notNull(),
	aliases: varchar().array().$defaultFn(() => []).notNull(),
	embedding: vector({ dimensions: 1024 }),
	price: numeric({ precision: 10, scale:  2 }),
	category: varchar(),
	description: varchar(),
	imageUrl: varchar("image_url"),
	offerPrice: numeric("offer_price", { precision: 10, scale:  2 }),
	offerEndsAt: timestamp("offer_ends_at", { withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ix_products_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("ix_products_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	index("products_embedding_hnsw_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "products_merchant_id_fkey"
		}),
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

// One image per product, served publicly by GET /product-images/:id (Meta/Zernio fetch it by URL).
export const productImages = pgTable("product_images", {
	productId: varchar("product_id").primaryKey().notNull(),
	contentType: varchar("content_type").notNull(),
	data: bytea().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_images_product_id_fkey"
		}).onDelete("cascade"),
]);

export const storeKnowledge = pgTable("store_knowledge", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	knowledgeType: varchar("knowledge_type").notNull(),
	title: varchar().notNull(),
	content: varchar().notNull(),
	keywords: varchar().array().$defaultFn(() => []).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_store_knowledge_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "store_knowledge_merchant_id_fkey"
		}),
]);

export const productVariants = pgTable("product_variants", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	productId: varchar("product_id").notNull(),
	label: varchar().notNull(),
	sku: varchar(),
	price: numeric({ precision: 10, scale:  2 }),
	stock: integer(),
	status: variantstatus().default('ACTIVE').notNull(),
	attributes: json().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_product_variants_product_id").using("btree", table.productId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_variants_product_id_fkey"
		}).onDelete("cascade"),
]);

export const cartItems = pgTable("cart_items", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	cartId: varchar("cart_id").notNull(),
	productId: varchar("product_id").notNull(),
	quantity: doublePrecision().notNull(),
	notes: varchar(),
	createdAt: timestamp("created_at", { mode: 'date' }).$defaultFn(() => new Date()).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'date' }).$defaultFn(() => new Date()).notNull(),
	variantId: varchar("variant_id"),
}, (table) => [
	index("ix_cart_items_cart_id").using("btree", table.cartId.asc().nullsLast().op("text_ops")),
	index("ix_cart_items_product_id").using("btree", table.productId.asc().nullsLast().op("text_ops")),
	index("ix_cart_items_variant_id").using("btree", table.variantId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_cart_items_cart_product_no_variant").using("btree", table.cartId.asc().nullsLast().op("text_ops"), table.productId.asc().nullsLast().op("text_ops")).where(sql`(variant_id IS NULL)`),
	uniqueIndex("uq_cart_items_cart_product_variant").using("btree", table.cartId.asc().nullsLast().op("text_ops"), table.productId.asc().nullsLast().op("text_ops"), table.variantId.asc().nullsLast().op("text_ops")).where(sql`(variant_id IS NOT NULL)`),
	foreignKey({
			columns: [table.cartId],
			foreignColumns: [carts.id],
			name: "cart_items_cart_id_fkey"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "cart_items_product_id_fkey"
		}),
	foreignKey({
			columns: [table.variantId],
			foreignColumns: [productVariants.id],
			name: "fk_cart_items_variant_id_product_variants"
		}).onDelete("cascade"),
]);

export const orderItems = pgTable("order_items", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	orderId: varchar("order_id").notNull(),
	productId: varchar("product_id"),
	nameSnapshot: varchar("name_snapshot").notNull(),
	variantSnapshot: varchar("variant_snapshot"),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	quantity: doublePrecision().notNull(),
	variantId: varchar("variant_id"),
}, (table) => [
	index("ix_order_items_order_id").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("ix_order_items_product_id").using("btree", table.productId.asc().nullsLast().op("text_ops")),
	index("ix_order_items_variant_id").using("btree", table.variantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_fkey"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "order_items_product_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.variantId],
			foreignColumns: [productVariants.id],
			name: "fk_order_items_variant_id_product_variants"
		}).onDelete("set null"),
]);

export const labeledExamples = pgTable("labeled_examples", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id"),
	normalizedText: varchar("normalized_text").notNull(),
	intent: varchar().notNull(),
	extraction: json(),
	embedding: vector({ dimensions: 1024 }),
	source: varchar().notNull(),
}, (table) => [
	index("labeled_examples_embedding_hnsw_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "fk_labeled_examples_merchant_id_merchants"
		}).onDelete("set null"),
]);

export const deliveryAreas = pgTable("delivery_areas", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	area: varchar().notNull(),
	deliveryFee: numeric("delivery_fee", { precision: 10, scale:  2 }).notNull(),
	estimatedDelivery: varchar("estimated_delivery"),
	status: deliveryareastatus().default('ACTIVE').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_delivery_areas_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "delivery_areas_merchant_id_fkey"
		}),
]);

export const orders = pgTable("orders", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	conversationId: varchar("conversation_id").notNull(),
	extractedPayload: json("extracted_payload").notNull(),
	confirmedPayload: json("confirmed_payload"),
	status: orderstatus().notNull(),
	confidenceScore: doublePrecision("confidence_score").notNull(),
	extractedByTier: modeltier("extracted_by_tier").notNull(),
	messageId: varchar("message_id").notNull(),
	escalationReason: varchar("escalation_reason"),
	merchantId: varchar("merchant_id").notNull(),
	source: ordersource().default('AI_EXTRACTION').notNull(),
	cartId: varchar("cart_id"),
	orderNumber: integer("order_number"),
	customerName: varchar("customer_name"),
	customerPhone: varchar("customer_phone"),
	deliveryAddress: varchar("delivery_address"),
	subtotal: numeric({ precision: 10, scale:  2 }),
	total: numeric({ precision: 10, scale:  2 }),
	deliveryFee: numeric("delivery_fee", { precision: 10, scale:  2 }),
}, (table) => [
	index("ix_orders_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("ix_orders_escalation_reason").using("btree", table.escalationReason.asc().nullsLast().op("text_ops")),
	index("ix_orders_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	index("ix_orders_message_id").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
	index("ix_orders_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "orders_conversation_id_fkey"
		}),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "orders_message_id_fkey"
		}),
	foreignKey({
			columns: [table.cartId],
			foreignColumns: [carts.id],
			name: "fk_orders_cart_id_carts"
		}),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "fk_orders_merchant_id_merchants"
		}),
	unique("uq_orders_merchant_order_number").on(table.merchantId, table.orderNumber),
]);

export const humanHandoffs = pgTable("human_handoffs", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	conversationId: varchar("conversation_id").notNull(),
	reason: handoffreason().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'date' }),
	notes: varchar(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	index("ix_human_handoffs_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "human_handoffs_conversation_id_fkey"
		}),
]);

export const conversations = pgTable("conversations", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	customerRef: varchar("customer_ref").notNull(),
	state: convstate().notNull(),
	slots: json().default({}).notNull(),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'date' }).notNull(),
	channelConnectionId: varchar("channel_connection_id"),
	aiEnabled: boolean("ai_enabled").default(true).notNull(),
	humanTakeover: boolean("human_takeover").default(false).notNull(),
}, (table) => [
	index("ix_conversations_channel_connection_id").using("btree", table.channelConnectionId.asc().nullsLast().op("text_ops")),
	index("ix_conversations_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "conversations_merchant_id_fkey"
		}),
	foreignKey({
			columns: [table.channelConnectionId],
			foreignColumns: [channelConnections.id],
			name: "conversations_channel_connection_id_fkey"
		}),
	unique("uq_conversations_channel_connection_customer_ref").on(table.customerRef, table.channelConnectionId),
]);

export const channelConnections = pgTable("channel_connections", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	merchantId: varchar("merchant_id").notNull(),
	channel: channel().notNull(),
	externalAccountId: varchar("external_account_id").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	pageAccessToken: encryptedString("page_access_token"),
	accountName: varchar("account_name"),
	aiEnabled: boolean("ai_enabled").default(true).notNull(),
	aiPausedUntil: timestamp("ai_paused_until", { withTimezone: true, mode: 'date' }),
	aiInstructions: text("ai_instructions"),
}, (table) => [
	index("ix_channel_connections_merchant_id").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "channel_connections_merchant_id_fkey"
		}),
	unique("uq_channel_connections_channel_external_account_id").on(table.channel, table.externalAccountId),
]);

export const merchants = pgTable("merchants", {
	id: varchar().primaryKey().notNull().$defaultFn(() => randomUUID()),
	name: varchar().notNull(),
	aiToolOrderingEnabled: boolean("ai_tool_ordering_enabled").default(false).notNull(),
	currency: varchar().default('EGP').notNull(),
	nextOrderNumber: integer("next_order_number").default(1).notNull(),
	status: merchantstatus().default('ACTIVE').notNull(),
	facebookUserId: varchar("facebook_user_id"),
	aiEnabled: boolean("ai_enabled").default(true).notNull(),
	autoLearningEnabled: boolean("auto_learning_enabled").default(false).notNull(),
}, (table) => [
	unique("uq_merchants_facebook_user_id").on(table.facebookUserId),
]);
