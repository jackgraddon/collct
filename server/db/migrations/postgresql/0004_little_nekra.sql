ALTER TABLE "pending_authorizations" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "pending_authorizations" ADD COLUMN "code_challenge" text;--> statement-breakpoint
ALTER TABLE "pending_authorizations" ADD COLUMN "code_challenge_method" text DEFAULT 'S256';