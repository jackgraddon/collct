CREATE TABLE IF NOT EXISTS "pending_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"user_code" text,
	"device_code_hash" text,
	"authorization_code" text,
	"app_name" text,
	"redirect_uri" text,
	"status" text NOT NULL DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"approved_at" timestamp,
	CONSTRAINT "pending_authorizations_user_code_unique" UNIQUE("user_code"),
	CONSTRAINT "pending_authorizations_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "pending_authorizations_authorization_code_unique" UNIQUE("authorization_code"),
	CONSTRAINT "pending_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action
);
