-- Contract only after the personal-account release is live. This migration
-- removes temporary compatibility objects, never ledger or activity history.
LOCK TABLE billing_accounts, team_members, invitations, activity_logs IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM billing_accounts WHERE user_id IS NULL)
    OR EXISTS (SELECT 1 FROM invitations) THEN
    RAISE EXCEPTION 'Unmapped billing accounts or invitations require review';
  END IF;
END $$;
--> statement-breakpoint
DROP VIEW teams;
--> statement-breakpoint
DROP TRIGGER sync_legacy_billing_membership ON billing_accounts;
--> statement-breakpoint
DROP FUNCTION sync_legacy_billing_membership();
--> statement-breakpoint
DROP TRIGGER sync_personal_billing_owner ON team_members;
--> statement-breakpoint
DROP FUNCTION sync_personal_billing_owner();
--> statement-breakpoint
DROP TABLE invitations;
--> statement-breakpoint
DROP TABLE team_members;
--> statement-breakpoint
ALTER TABLE activity_logs DROP COLUMN team_id;
--> statement-breakpoint
ALTER TABLE billing_accounts DROP COLUMN name;
--> statement-breakpoint
ALTER TABLE billing_accounts ALTER COLUMN user_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE users DROP COLUMN role;
--> statement-breakpoint
-- One-off copies from the earlier 0013 rollout are retained in the verified
-- private database dump, rather than as live application-schema tables.
DROP TABLE IF EXISTS team_members_backup_0013;
--> statement-breakpoint
DROP TABLE IF EXISTS extension_api_tokens_backup_0013;
