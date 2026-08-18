ALTER TYPE "public"."notification_type" ADD VALUE 'moment';--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "moments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "is_moment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "moment_captured_at" timestamp;