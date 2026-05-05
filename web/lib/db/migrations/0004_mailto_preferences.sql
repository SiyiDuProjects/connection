ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sender_name" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "school" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "email_signature" text;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "intro_style" varchar(40) DEFAULT 'student' NOT NULL;
--> statement-breakpoint
