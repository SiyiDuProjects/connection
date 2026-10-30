-- Run in a transaction before reverting to the pre-personal-account image.
-- Preserve all billing, ledger, signup and log writes made by the new release.
LOCK TABLE billing_accounts, users, activity_logs IN ACCESS EXCLUSIVE MODE;
ALTER TABLE billing_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE billing_accounts ADD COLUMN name varchar(100) NOT NULL DEFAULT 'Personal account';
ALTER TABLE users ADD COLUMN role varchar(20) NOT NULL DEFAULT 'member';
ALTER TABLE activity_logs ADD COLUMN team_id integer REFERENCES billing_accounts(id);
UPDATE activity_logs l SET team_id=a.id FROM billing_accounts a WHERE a.user_id=l.user_id;
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL
);
ALTER TABLE team_members ADD FOREIGN KEY(user_id) REFERENCES users(id);
ALTER TABLE team_members ADD FOREIGN KEY(team_id) REFERENCES billing_accounts(id);
ALTER TABLE invitations ADD FOREIGN KEY(team_id) REFERENCES billing_accounts(id);
ALTER TABLE invitations ADD FOREIGN KEY(invited_by) REFERENCES users(id);
CREATE UNIQUE INDEX team_members_user_team_unique ON team_members(user_id,team_id);
CREATE INDEX team_members_user_id_idx ON team_members(user_id);
INSERT INTO team_members(user_id,team_id,role) SELECT user_id,id,'owner' FROM billing_accounts WHERE user_id IS NOT NULL;
CREATE VIEW teams AS SELECT id,name,created_at,updated_at,stripe_customer_id,
  stripe_subscription_id,stripe_product_id,plan_name,subscription_status FROM billing_accounts;
--> statement-breakpoint
-- Old signup writes the account before its membership. New signup writes the
-- user and billing account directly. Both releases must see either signup.
CREATE FUNCTION sync_personal_billing_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role <> 'owner' OR EXISTS (SELECT 1 FROM billing_accounts
    WHERE id=NEW.team_id AND user_id IS NOT NULL AND user_id<>NEW.user_id) THEN
    RAISE EXCEPTION 'Only personal billing accounts are supported';
  END IF;
  UPDATE billing_accounts SET user_id=NEW.user_id WHERE id=NEW.team_id AND user_id IS NULL;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sync_personal_billing_owner AFTER INSERT OR UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION sync_personal_billing_owner();
--> statement-breakpoint
CREATE FUNCTION sync_legacy_billing_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO team_members(user_id,team_id,role) VALUES (NEW.user_id,NEW.id,'owner')
      ON CONFLICT (user_id,team_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sync_legacy_billing_membership AFTER INSERT ON billing_accounts
  FOR EACH ROW EXECUTE FUNCTION sync_legacy_billing_membership();

--> statement-breakpoint
-- Mark only the contract migration undone. Expansion and purchased entitlements remain.
DELETE FROM drizzle.__drizzle_migrations WHERE created_at=1793318401000;
