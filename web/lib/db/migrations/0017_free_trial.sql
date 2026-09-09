CREATE TABLE "free_trial_claims" (
  "email_fingerprint" text PRIMARY KEY,
  "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id"),
  "searches" integer NOT NULL DEFAULT 0 CHECK ("searches" >= 0),
  "reveal_attempts" integer NOT NULL DEFAULT 0 CHECK ("reveal_attempts" >= 0),
  "drafts" integer NOT NULL DEFAULT 0 CHECK ("drafts" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_free_trial_unique" ON "credit_ledger" ("user_id")
WHERE "action" = 'trial.initial_grant';
--> statement-breakpoint
-- The website and contacts service share this transaction boundary. A verified
-- email gets one trial, including after account deletion and re-registration.
CREATE FUNCTION ensure_free_trial(target_user_id integer) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  account users%ROWTYPE;
  claimed_user integer;
BEGIN
  SELECT * INTO account FROM users WHERE id = target_user_id FOR UPDATE;
  IF NOT FOUND OR account.deleted_at IS NOT NULL OR account.email_verified_at IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE user_id = target_user_id
    AND action IN ('subscription.initial_grant', 'subscription.monthly_grant')) THEN
    RETURN false;
  END IF;
  INSERT INTO free_trial_claims (email_fingerprint, user_id)
    VALUES (encode(sha256(convert_to(lower(trim(account.email)), 'UTF8')), 'hex'), target_user_id)
    ON CONFLICT DO NOTHING RETURNING user_id INTO claimed_user;
  IF claimed_user IS NOT NULL THEN
    INSERT INTO credit_ledger (user_id, amount, action, metadata)
      VALUES (target_user_id, 3, 'trial.initial_grant', '{"policy":"three-emails-no-card-v1"}'::jsonb)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN EXISTS (SELECT 1 FROM free_trial_claims WHERE user_id = target_user_id);
END;
$$;
--> statement-breakpoint
-- Bound upstream work even when searches or unsuccessful reveals cost no
-- customer credits. Counters survive process restarts and concurrent requests.
CREATE FUNCTION consume_free_trial_operation(target_user_id integer, operation text) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE changed_user integer;
BEGIN
  IF operation = 'contacts.search' THEN
    UPDATE free_trial_claims SET searches = searches + 1
      WHERE user_id = target_user_id AND searches < 20 RETURNING user_id INTO changed_user;
  ELSIF operation = 'contacts.reveal' THEN
    UPDATE free_trial_claims SET reveal_attempts = reveal_attempts + 1
      WHERE user_id = target_user_id AND reveal_attempts < 30 RETURNING user_id INTO changed_user;
  ELSIF operation = 'email.draft' THEN
    UPDATE free_trial_claims SET drafts = drafts + 1
      WHERE user_id = target_user_id AND drafts < 12 RETURNING user_id INTO changed_user;
  END IF;
  RETURN changed_user IS NOT NULL;
END;
$$;
