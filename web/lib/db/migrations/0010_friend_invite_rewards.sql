CREATE TABLE IF NOT EXISTS "friend_invite_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"redemption_id" integer NOT NULL,
	"inviter_user_id" integer NOT NULL,
	"invited_user_id" integer NOT NULL,
	"checkout_session_id" text NOT NULL,
	"invited_subscription_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_credit_balance_transaction_id" text,
	"amount" integer,
	"currency" varchar(10),
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friend_invite_rewards_redemption_id_unique"
  ON "friend_invite_rewards" ("redemption_id");
--> statement-breakpoint
DELETE FROM "friend_invite_redemptions" older
USING "friend_invite_redemptions" newer
WHERE older."invited_user_id" = newer."invited_user_id"
  AND older."id" > newer."id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friend_invite_redemptions_invited_user_id_unique"
  ON "friend_invite_redemptions" ("invited_user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_invite_rewards" ADD CONSTRAINT "friend_invite_rewards_redemption_id_friend_invite_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."friend_invite_redemptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_invite_rewards" ADD CONSTRAINT "friend_invite_rewards_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_invite_rewards" ADD CONSTRAINT "friend_invite_rewards_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
