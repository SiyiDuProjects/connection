ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "region" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "outreach_length" varchar(40) DEFAULT 'concise' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "outreach_goal" varchar(40) DEFAULT 'advice' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "outreach_style_notes" text;
--> statement-breakpoint
