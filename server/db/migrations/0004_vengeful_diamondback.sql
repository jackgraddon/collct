CREATE TYPE "public"."reaction_type" AS ENUM('thumbs_up', 'thumbs_down', 'heart', 'cry');--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_user_comment_unique" UNIQUE("user_id","comment_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"photo_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "likes_user_photo_unique" UNIQUE("user_id","photo_id")
);
--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reactions_comment_id_idx" ON "comment_reactions" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comments_photo_id_idx" ON "comments" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "likes_photo_id_idx" ON "likes" USING btree ("photo_id");