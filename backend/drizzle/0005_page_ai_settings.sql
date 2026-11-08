ALTER TABLE "channel_connections" ADD COLUMN "ai_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD COLUMN "ai_paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD COLUMN "ai_instructions" text;