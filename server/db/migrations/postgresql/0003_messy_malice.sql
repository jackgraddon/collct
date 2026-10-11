DROP INDEX "presigned_url_cache_expires_idx";--> statement-breakpoint
CREATE INDEX "presigned_cache_expires_idx" ON "presigned_url_cache" USING btree ("expires_at");