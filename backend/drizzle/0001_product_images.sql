CREATE TABLE "product_images" (
	"product_id" varchar PRIMARY KEY NOT NULL,
	"content_type" varchar NOT NULL,
	"data" bytea NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;