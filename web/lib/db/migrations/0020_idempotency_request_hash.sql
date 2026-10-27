-- Additive: older services can continue writing NULL during a staged rollout.
-- Historical payloads were not retained in full, so their digests cannot be
-- reconstructed safely. New services refuse ambiguous replay of those rows.
ALTER TABLE "api_idempotency_keys" ADD COLUMN "request_hash" varchar(64);
