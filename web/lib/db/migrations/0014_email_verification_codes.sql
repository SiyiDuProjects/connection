ALTER TABLE "email_verification_tokens" ADD COLUMN "code_hash" text;
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_created_idx" ON "email_verification_tokens" ("user_id", "created_at");
