CREATE TABLE "auth_rate_limits" (
  "key" text PRIMARY KEY,
  "attempts" integer NOT NULL CHECK ("attempts" >= 1),
  "resets_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "auth_rate_limits" ("resets_at");
--> statement-breakpoint
CREATE FUNCTION consume_auth_rate_limit(bucket_key text, maximum integer, window_seconds integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE bucket auth_rate_limits%ROWTYPE;
BEGIN
  IF maximum < 1 OR window_seconds < 1 OR length(bucket_key) > 160 THEN
    RAISE EXCEPTION 'Invalid rate-limit policy';
  END IF;
  INSERT INTO auth_rate_limits (key, attempts, resets_at)
    VALUES (bucket_key, 1, now() + make_interval(secs => window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN auth_rate_limits.resets_at <= now() THEN 1 ELSE least(auth_rate_limits.attempts + 1, maximum + 1) END,
    resets_at = CASE WHEN auth_rate_limits.resets_at <= now() THEN now() + make_interval(secs => window_seconds) ELSE auth_rate_limits.resets_at END
  RETURNING * INTO bucket;
  IF bucket.attempts > maximum THEN
    RETURN greatest(1, ceil(extract(epoch FROM bucket.resets_at - now()))::integer);
  END IF;
  RETURN 0;
END;
$$;
