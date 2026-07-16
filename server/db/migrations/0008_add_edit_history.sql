ALTER TABLE "comments" ADD COLUMN "edit_history" text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "caption_history" text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "caption_edited_at" timestamp;