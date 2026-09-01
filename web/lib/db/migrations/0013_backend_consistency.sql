ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "request_id" text;
--> statement-breakpoint
ALTER TABLE "api_usage" ADD COLUMN IF NOT EXISTS "request_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_idempotency_keys" ADD CONSTRAINT "api_idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DELETE FROM "team_members" older
USING "team_members" newer
WHERE older."user_id" = newer."user_id"
  AND older."team_id" = newer."team_id"
  AND older."id" > newer."id";
--> statement-breakpoint
UPDATE "extension_api_tokens" older
SET "revoked_at" = now()
FROM "extension_api_tokens" newer
WHERE older."user_id" = newer."user_id"
  AND older."revoked_at" IS NULL
  AND newer."revoked_at" IS NULL
  AND older."id" < newer."id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_user_team_unique" ON "team_members" ("user_id", "team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_user_id_idx" ON "team_members" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "extension_api_tokens_active_user_unique" ON "extension_api_tokens" ("user_id") WHERE "revoked_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_ledger_user_created_at_idx" ON "credit_ledger" ("user_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_user_action_request_unique" ON "credit_ledger" ("user_id", "action", "request_id") WHERE "request_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_user_created_at_idx" ON "api_usage" ("user_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_usage_successful_request_unique" ON "api_usage" ("user_id", "action", "request_id") WHERE "request_id" IS NOT NULL AND "status" = 'success';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_idempotency_keys_user_action_key_unique" ON "api_idempotency_keys" ("user_id", "action", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_idempotency_keys_updated_at_idx" ON "api_idempotency_keys" ("updated_at");
