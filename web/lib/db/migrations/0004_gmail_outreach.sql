ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sender_name" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "school" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "email_signature" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "intro_style" varchar(40) DEFAULT 'student' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gmail_connections" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "email_address" varchar(255) NOT NULL,
  "refresh_token_encrypted" text NOT NULL,
  "scope" text NOT NULL,
  "connected_at" timestamp DEFAULT now() NOT NULL,
  "disconnected_at" timestamp,
  "last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_emails" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "gmail_connection_id" integer,
  "recipient_email" varchar(255) NOT NULL,
  "recipient_name" text,
  "recipient_title" text,
  "company_name" text,
  "job_title" text,
  "contact_linkedin_url" text,
  "gmail_thread_id" text,
  "gmail_message_id" text,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "replied_at" timestamp,
  "follow_up_due_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gmail_connections_active_user_idx"
  ON "gmail_connections" ("user_id")
  WHERE "disconnected_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_emails_user_sent_idx"
  ON "outreach_emails" ("user_id", "sent_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_emails_thread_idx"
  ON "outreach_emails" ("gmail_thread_id")
  WHERE "gmail_thread_id" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_emails" ADD CONSTRAINT "outreach_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_emails" ADD CONSTRAINT "outreach_emails_gmail_connection_id_gmail_connections_id_fk" FOREIGN KEY ("gmail_connection_id") REFERENCES "public"."gmail_connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
