CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."cartstatus" AS ENUM('ACTIVE', 'CHECKED_OUT');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('FACEBOOK', 'INSTAGRAM', 'WHATSAPP');--> statement-breakpoint
CREATE TYPE "public"."convstate" AS ENUM('NEW', 'GATHERING', 'CONFIRMING', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."deliveryareastatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('INBOUND', 'OUTBOUND');--> statement-breakpoint
CREATE TYPE "public"."handoffreason" AS ENUM('USER_REQUEST', 'AI_ESCALATION', 'MERCHANT_TAKEOVER');--> statement-breakpoint
CREATE TYPE "public"."merchantstatus" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."modeltier" AS ENUM('RULE', 'DEEPSEEK');--> statement-breakpoint
CREATE TYPE "public"."ordersource" AS ENUM('AI_EXTRACTION', 'CART_CHECKOUT', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."orderstatus" AS ENUM('AUTO_CONFIRMED', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'GATHERING_ITEMS', 'FAILED_VALIDATION');--> statement-breakpoint
CREATE TYPE "public"."variantstatus" AS ENUM('ACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED');--> statement-breakpoint
CREATE TABLE "ai_actions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_id" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"arguments" json NOT NULL,
	"status" varchar NOT NULL,
	"errors" json NOT NULL,
	"result" json,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"conversation_id" varchar,
	"message_id" varchar,
	"tier" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"model" varchar NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" double precision NOT NULL,
	"estimated_cost" double precision,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"cart_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" double precision NOT NULL,
	"notes" varchar,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"variant_id" varchar
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"status" "cartstatus" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_connections" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"channel" "channel" NOT NULL,
	"external_account_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"page_access_token" varchar,
	"account_name" varchar,
	CONSTRAINT "uq_channel_connections_channel_external_account_id" UNIQUE("channel","external_account_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"customer_ref" varchar NOT NULL,
	"state" "convstate" NOT NULL,
	"slots" json DEFAULT '{}'::json NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"channel_connection_id" varchar,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"human_takeover" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uq_conversations_channel_connection_customer_ref" UNIQUE("customer_ref","channel_connection_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_areas" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"area" varchar NOT NULL,
	"delivery_fee" numeric(10, 2) NOT NULL,
	"estimated_delivery" varchar,
	"status" "deliveryareastatus" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_handoffs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"reason" "handoffreason" NOT NULL,
	"resolved_at" timestamp with time zone,
	"notes" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labeled_examples" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar,
	"normalized_text" varchar NOT NULL,
	"intent" varchar NOT NULL,
	"extraction" json,
	"embedding" vector(1024),
	"source" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"ai_tool_ordering_enabled" boolean DEFAULT false NOT NULL,
	"currency" varchar DEFAULT 'EGP' NOT NULL,
	"next_order_number" integer DEFAULT 1 NOT NULL,
	"status" "merchantstatus" DEFAULT 'ACTIVE' NOT NULL,
	"facebook_user_id" varchar,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"auto_learning_enabled" boolean DEFAULT false NOT NULL,
	"welcome_message" varchar DEFAULT 'أهلاً بيك في {store_name}! 👋
تحب تعمل إيه؟' NOT NULL,
	CONSTRAINT "uq_merchants_facebook_user_id" UNIQUE("facebook_user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"direction" "direction" NOT NULL,
	"raw_text" varchar,
	"normalized_text" varchar,
	"intent" varchar,
	"intent_confidence" double precision,
	"model_tier" "modeltier",
	"escalation_reason" varchar,
	"embedding" vector(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"clustered_at" timestamp with time zone,
	"external_message_id" varchar,
	"message_type" varchar,
	"rich_payload" json,
	"postback_payload" json
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"product_id" varchar,
	"name_snapshot" varchar NOT NULL,
	"variant_snapshot" varchar,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" double precision NOT NULL,
	"variant_id" varchar
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"extracted_payload" json NOT NULL,
	"confirmed_payload" json,
	"status" "orderstatus" NOT NULL,
	"confidence_score" double precision NOT NULL,
	"extracted_by_tier" "modeltier" NOT NULL,
	"message_id" varchar NOT NULL,
	"escalation_reason" varchar,
	"merchant_id" varchar NOT NULL,
	"source" "ordersource" DEFAULT 'AI_EXTRACTION' NOT NULL,
	"cart_id" varchar,
	"order_number" integer,
	"customer_name" varchar,
	"customer_phone" varchar,
	"delivery_address" varchar,
	"subtotal" numeric(10, 2),
	"total" numeric(10, 2),
	"delivery_fee" numeric(10, 2),
	CONSTRAINT "uq_orders_merchant_order_number" UNIQUE("merchant_id","order_number")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" varchar PRIMARY KEY NOT NULL,
	"product_id" varchar NOT NULL,
	"label" varchar NOT NULL,
	"sku" varchar,
	"price" numeric(10, 2),
	"stock" integer,
	"status" "variantstatus" DEFAULT 'ACTIVE' NOT NULL,
	"attributes" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"aliases" varchar[] NOT NULL,
	"embedding" vector(1024),
	"price" numeric(10, 2),
	"category" varchar,
	"description" varchar,
	"image_url" varchar
);
--> statement-breakpoint
CREATE TABLE "store_knowledge" (
	"id" varchar PRIMARY KEY NOT NULL,
	"merchant_id" varchar NOT NULL,
	"knowledge_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" varchar NOT NULL,
	"keywords" varchar[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"channel" "channel" NOT NULL,
	"raw_payload" json,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_error" varchar
);
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_variant_id_product_variants" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_connection_id_fkey" FOREIGN KEY ("channel_connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_areas" ADD CONSTRAINT "delivery_areas_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_handoffs" ADD CONSTRAINT "human_handoffs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labeled_examples" ADD CONSTRAINT "fk_labeled_examples_merchant_id_merchants" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_variant_id_product_variants" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_cart_id_carts" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_merchant_id_merchants" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_knowledge" ADD CONSTRAINT "store_knowledge_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_ai_actions_action_type" ON "ai_actions" USING btree ("action_type" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_actions_conversation_id" ON "ai_actions" USING btree ("conversation_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_actions_merchant_id" ON "ai_actions" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_actions_message_id" ON "ai_actions" USING btree ("message_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_actions_status" ON "ai_actions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_usage_events_conversation_id" ON "ai_usage_events" USING btree ("conversation_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_usage_events_message_id" ON "ai_usage_events" USING btree ("message_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_ai_usage_events_tier" ON "ai_usage_events" USING btree ("tier" text_ops);--> statement-breakpoint
CREATE INDEX "ix_cart_items_cart_id" ON "cart_items" USING btree ("cart_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_cart_items_product_id" ON "cart_items" USING btree ("product_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_cart_items_variant_id" ON "cart_items" USING btree ("variant_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cart_items_cart_product_no_variant" ON "cart_items" USING btree ("cart_id" text_ops,"product_id" text_ops) WHERE (variant_id IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cart_items_cart_product_variant" ON "cart_items" USING btree ("cart_id" text_ops,"product_id" text_ops,"variant_id" text_ops) WHERE (variant_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "ix_carts_conversation_id" ON "carts" USING btree ("conversation_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_carts_merchant_id" ON "carts" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carts_one_active_per_conversation" ON "carts" USING btree ("conversation_id" text_ops) WHERE (status = 'ACTIVE'::cartstatus);--> statement-breakpoint
CREATE INDEX "ix_channel_connections_merchant_id" ON "channel_connections" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_conversations_channel_connection_id" ON "conversations" USING btree ("channel_connection_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_conversations_merchant_id" ON "conversations" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_delivery_areas_merchant_id" ON "delivery_areas" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_human_handoffs_conversation_id" ON "human_handoffs" USING btree ("conversation_id" text_ops);--> statement-breakpoint
CREATE INDEX "labeled_examples_embedding_hnsw_idx" ON "labeled_examples" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ix_messages_conversation_id_created_at" ON "messages" USING btree ("conversation_id" text_ops,"created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_messages_external_message_id_unique" ON "messages" USING btree ("external_message_id" text_ops) WHERE (external_message_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "ix_messages_intent" ON "messages" USING btree ("intent" text_ops);--> statement-breakpoint
CREATE INDEX "messages_embedding_hnsw_idx" ON "messages" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ix_order_items_order_id" ON "order_items" USING btree ("order_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_order_items_product_id" ON "order_items" USING btree ("product_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_order_items_variant_id" ON "order_items" USING btree ("variant_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_orders_conversation_id" ON "orders" USING btree ("conversation_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_orders_escalation_reason" ON "orders" USING btree ("escalation_reason" text_ops);--> statement-breakpoint
CREATE INDEX "ix_orders_merchant_id" ON "orders" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_orders_message_id" ON "orders" USING btree ("message_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_orders_status" ON "orders" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "ix_product_variants_product_id" ON "product_variants" USING btree ("product_id" text_ops);--> statement-breakpoint
CREATE INDEX "ix_products_category" ON "products" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "ix_products_merchant_id" ON "products" USING btree ("merchant_id" text_ops);--> statement-breakpoint
CREATE INDEX "products_embedding_hnsw_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ix_store_knowledge_merchant_id" ON "store_knowledge" USING btree ("merchant_id" text_ops);