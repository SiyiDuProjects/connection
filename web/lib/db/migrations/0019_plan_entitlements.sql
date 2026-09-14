CREATE TABLE "contact_email_unlocks" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_fingerprint" text NOT NULL,
  "contact_key" text,
  "email" text NOT NULL,
  "provider" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "email_fingerprint")
);
--> statement-breakpoint
CREATE INDEX "contact_email_unlocks_user_contact_idx" ON "contact_email_unlocks" ("user_id", "contact_key");
--> statement-breakpoint
-- Preserve only email unlocks evidenced by successful historical responses.
-- Records already pruned from the idempotency table cannot be reconstructed.
INSERT INTO contact_email_unlocks (user_id, email_fingerprint, contact_key, email, provider, created_at)
SELECT DISTINCT ON (history.user_id, lower(trim(history.response->>'email')))
  history.user_id,
  encode(sha256(convert_to(lower(trim(history.response->>'email')), 'UTF8')), 'hex'),
  nullif(history.response->>'contactKey', ''), lower(trim(history.response->>'email')),
  coalesce(history.response->>'provider', ''), history.created_at
FROM (
  SELECT user_id, response, created_at FROM api_idempotency_keys
    WHERE action = 'contacts.reveal' AND status = 'succeeded'
  UNION ALL
  SELECT user_id, response, created_at FROM api_usage
    WHERE action = 'contacts.reveal' AND status = 'success'
) history
INNER JOIN users ON users.id = history.user_id AND users.deleted_at IS NULL
WHERE jsonb_typeof(history.response->'email') = 'string'
  AND trim(history.response->>'email') LIKE '%@%'
ORDER BY history.user_id, lower(trim(history.response->>'email')), history.created_at
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- The website and contacts service read the same purchased entitlement. New
-- monthly allowances are isolated from trial credits and every earlier period.
-- Display names never grant unlimited access, so legacy Plus remains limited.
CREATE FUNCTION get_account_entitlement(target_user_id integer)
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
  SELECT teams.subscription_status::text AS status, teams.stripe_subscription_id
  FROM teams INNER JOIN team_members ON team_members.team_id = teams.id
  WHERE team_members.user_id = target_user_id AND team_members.role = 'owner'
  ORDER BY teams.created_at DESC, teams.id DESC LIMIT 1
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
