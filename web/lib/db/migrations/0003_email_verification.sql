ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
--> statement-breakpoint
UPDATE "users"
SET "email_verified_at" = COALESCE("email_verified_at", "created_at", now())
WHERE "email_verified_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "used_at" timestamp,
  CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
