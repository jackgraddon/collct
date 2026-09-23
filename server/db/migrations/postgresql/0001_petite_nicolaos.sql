ALTER TABLE "push_subscriptions" ALTER COLUMN "auth_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "p256dh_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "platform" text DEFAULT 'web' NOT NULL;