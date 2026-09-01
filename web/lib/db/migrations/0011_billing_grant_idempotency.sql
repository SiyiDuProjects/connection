DELETE FROM "credit_ledger" older
USING "credit_ledger" newer
WHERE older.action = 'subscription.initial_grant'
  AND newer.action = older.action
  AND older.metadata->>'subscriptionId' IS NOT NULL
  AND older.metadata->>'subscriptionId' = newer.metadata->>'subscriptionId'
  AND older.id > newer.id;
--> statement-breakpoint
DELETE FROM "credit_ledger" older
USING "credit_ledger" newer
WHERE older.action = 'subscription.monthly_grant'
  AND newer.action = older.action
  AND older.metadata->>'invoiceId' IS NOT NULL
  AND older.metadata->>'invoiceId' = newer.metadata->>'invoiceId'
  AND older.id > newer.id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_initial_subscription_unique"
  ON "credit_ledger" ((metadata->>'subscriptionId'))
  WHERE action = 'subscription.initial_grant';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_monthly_invoice_unique"
  ON "credit_ledger" ((metadata->>'invoiceId'))
  WHERE action = 'subscription.monthly_grant';
