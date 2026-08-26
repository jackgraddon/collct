ALTER TABLE "notifications" ADD COLUMN "notification_tag" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_tag_active_unique" ON "notifications" ("notification_tag") WHERE "is_read" = false;
