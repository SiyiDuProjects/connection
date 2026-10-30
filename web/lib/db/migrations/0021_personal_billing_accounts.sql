-- Expand first. Keep the previous release working until 0022 is explicitly
-- applied after the new release passes acceptance. Never guess ownership.
LOCK TABLE teams, team_members, invitations, activity_logs IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM teams t LEFT JOIN team_members m ON m.team_id=t.id
    GROUP BY t.id HAVING count(m.id) <> 1 OR count(m.id) FILTER (WHERE m.role='owner') <> 1)
    OR EXISTS (SELECT 1 FROM team_members GROUP BY user_id HAVING count(*) <> 1)
    OR EXISTS (SELECT 1 FROM invitations) THEN
    RAISE EXCEPTION 'Personal billing migration requires unambiguous single owners and no invitations';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE teams RENAME TO billing_accounts;
--> statement-breakpoint
ALTER SEQUENCE teams_id_seq RENAME TO billing_accounts_id_seq;
--> statement-breakpoint
ALTER TABLE billing_accounts RENAME CONSTRAINT teams_pkey TO billing_accounts_pkey;
--> statement-breakpoint
ALTER TABLE billing_accounts RENAME CONSTRAINT teams_stripe_customer_id_unique TO billing_accounts_stripe_customer_id_unique;
--> statement-breakpoint
ALTER TABLE billing_accounts RENAME CONSTRAINT teams_stripe_subscription_id_unique TO billing_accounts_stripe_subscription_id_unique;
--> statement-breakpoint
ALTER TABLE billing_accounts ADD COLUMN user_id integer CONSTRAINT billing_accounts_user_id_unique UNIQUE
  CONSTRAINT billing_accounts_user_id_users_id_fk REFERENCES users(id);
--> statement-breakpoint
UPDATE billing_accounts a SET user_id=m.user_id FROM team_members m WHERE m.team_id=a.id;
--> statement-breakpoint
ALTER TABLE billing_accounts ALTER COLUMN name SET DEFAULT 'Personal account';
--> statement-breakpoint
ALTER TABLE activity_logs ALTER COLUMN team_id DROP NOT NULL;
--> statement-breakpoint
-- Preserve unattributed history without inventing an actor. The old team
-- association remains recoverable from the pre-migration backup.
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
-- An unsubscribed user created outside the starter signup also gets a personal
-- account. Never invent a link to an orphaned paid account (guarded above).
INSERT INTO billing_accounts(user_id)
  SELECT u.id FROM users u WHERE u.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM billing_accounts a WHERE a.user_id=u.id);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION get_account_entitlement(target_user_id integer)
RETURNS TABLE (
  status text,
  period_start bigint,
  period_end bigint,
  allowance_mode text,
  monthly_allowance integer,
  remaining integer,
  unlimited boolean,
  entitlement_grant_id integer
)
LANGUAGE sql STABLE AS $$
WITH membership AS (
  SELECT subscription_status::text AS status, stripe_subscription_id
  FROM billing_accounts WHERE user_id = target_user_id
), grants AS (
  SELECT ledger.id, ledger.amount, ledger.metadata,
    CASE WHEN ledger.metadata->>'periodStart' ~ '^[0-9]{1,12}$'
      THEN (ledger.metadata->>'periodStart')::bigint ELSE 0 END AS starts,
    CASE WHEN ledger.metadata->>'periodEnd' ~ '^[0-9]{1,12}$'
      THEN (ledger.metadata->>'periodEnd')::bigint ELSE 0 END AS ends
  FROM credit_ledger ledger, membership
  WHERE ledger.user_id = target_user_id
    AND ledger.action IN ('subscription.initial_grant', 'subscription.monthly_grant')
    AND ledger.metadata->>'subscriptionId' = membership.stripe_subscription_id
), current_grant AS (
  SELECT * FROM grants WHERE starts <= extract(epoch FROM now())
  ORDER BY ends DESC, starts DESC, id DESC LIMIT 1
), policy AS (
  SELECT
    CASE WHEN EXISTS (SELECT 1 FROM free_trial_claims WHERE user_id = target_user_id)
      AND NOT EXISTS (SELECT 1 FROM credit_ledger WHERE user_id = target_user_id
        AND action IN ('subscription.initial_grant', 'subscription.monthly_grant'))
      THEN 'free_trial' ELSE coalesce((SELECT status FROM membership), 'inactive') END AS status,
    coalesce((SELECT starts FROM current_grant), 0) AS starts,
    coalesce((SELECT ends FROM current_grant), 0) AS ends,
    CASE WHEN (SELECT metadata->>'entitlementVersion' FROM current_grant) = '2026-09-base50-plus-unlimited'
      AND (SELECT metadata->>'allowanceMode' FROM current_grant) IN ('monthly', 'unlimited')
      AND (SELECT starts FROM current_grant) > 0
      AND (SELECT ends FROM current_grant) > (SELECT starts FROM current_grant)
      THEN (SELECT metadata->>'allowanceMode' FROM current_grant) ELSE 'legacy' END AS mode,
    (SELECT id FROM current_grant) AS grant_id,
    coalesce((SELECT greatest(amount, 0) FROM current_grant), 0) AS grant_amount
), balance AS (
  SELECT policy.*,
    CASE WHEN mode = 'unlimited' THEN 0
      WHEN mode = 'monthly' AND (ends <= extract(epoch FROM now())
        OR status NOT IN ('active', 'trialing', 'past_due')) THEN 0
      WHEN mode = 'monthly' THEN greatest(0, 50 + coalesce((
        SELECT sum(amount) FROM credit_ledger
        WHERE user_id = target_user_id AND amount < 0
          AND (metadata->>'entitlementGrantId' = policy.grant_id::text
            OR (NOT metadata ? 'entitlementGrantId'
              AND created_at >= to_timestamp(policy.starts)
              AND created_at < to_timestamp(policy.ends)))
      ), 0))::integer
      ELSE coalesce((SELECT sum(amount) FROM credit_ledger WHERE user_id = target_user_id), 0)::integer
    END AS remaining
  FROM policy
)
SELECT status, starts, ends, mode,
  CASE WHEN mode = 'monthly' THEN 50 WHEN mode = 'unlimited' THEN 0 ELSE grant_amount END,
  remaining,
  mode = 'unlimited' AND status IN ('active', 'trialing', 'past_due') AND ends > extract(epoch FROM now()),
  grant_id
FROM balance;
$$;
