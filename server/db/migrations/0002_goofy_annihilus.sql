ALTER TABLE "credentials" ALTER COLUMN "backed_up" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "backed_up" SET DATA TYPE boolean USING "backed_up"::boolean;--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "backed_up" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");