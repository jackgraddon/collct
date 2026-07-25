CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"user_code" text,
	"device_code_hash" text,
	"authorization_code" text,
	"app_name" text,
	"redirect_uri" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"approved_at" timestamp,
	CONSTRAINT "pending_authorizations_user_code_unique" UNIQUE("user_code"),
	CONSTRAINT "pending_authorizations_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "pending_authorizations_authorization_code_unique" UNIQUE("authorization_code")
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "group_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_authorizations" ADD CONSTRAINT "pending_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;