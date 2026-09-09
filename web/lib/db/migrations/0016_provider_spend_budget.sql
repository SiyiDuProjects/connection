CREATE TABLE "provider_budget_days" (
  "day" date PRIMARY KEY,
  "limit_micro_usd" bigint NOT NULL CHECK ("limit_micro_usd" > 0),
  "spent_micro_usd" bigint NOT NULL DEFAULT 0 CHECK ("spent_micro_usd" >= 0),
  "reserved_micro_usd" bigint NOT NULL DEFAULT 0 CHECK ("reserved_micro_usd" >= 0),
  "breached" boolean NOT NULL DEFAULT false,
  "alert_emitted" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_spend_reservations" (
  "id" uuid PRIMARY KEY,
  "day" date NOT NULL REFERENCES "provider_budget_days"("day"),
  "provider" varchar(80) NOT NULL,
  "action" varchar(80) NOT NULL,
  "customer_id" varchar(80),
  "reserved_micro_usd" bigint NOT NULL CHECK ("reserved_micro_usd" > 0),
  "actual_micro_usd" bigint CHECK ("actual_micro_usd" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "settled_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX "provider_spend_reservations_day_idx" ON "provider_spend_reservations" ("day");
