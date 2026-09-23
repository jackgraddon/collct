CREATE TABLE "presigned_url_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"blob_pathname" text NOT NULL,
	"presigned_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	CONSTRAINT "presigned_url_cache_blob_pathname_unique" UNIQUE("blob_pathname")
);
--> statement-breakpoint
CREATE INDEX "presigned_url_cache_expires_idx" ON "presigned_url_cache" USING btree ("expires_at");