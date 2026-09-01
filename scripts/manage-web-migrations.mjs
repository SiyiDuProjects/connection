import crypto from "node:crypto";
import fs from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("POSTGRES_URL is required.");

const sql = postgres(databaseUrl, { max: 1 });
const backupTable = "credit_ledger_backup_0011_20260830";
const consistencyBackupTables = {
  teamMembers: "team_members_backup_0013",
  extensionTokens: "extension_api_tokens_backup_0013"
};

try {
  const report = await audit();
  console.log(JSON.stringify(report));

  const migrationSpecs = process.argv.slice(2);
  if (!migrationSpecs.length) process.exitCode = 0;
  else {
    await backupDuplicateBillingGrants(report);
    if (migrationSpecs.some((spec) => spec.includes("0013_backend_consistency.sql"))) {
      await backupConsistencyRows();
    }
    for (const spec of migrationSpecs) await applyMigration(spec);
    console.log(JSON.stringify(await audit()));
  }
} finally {
  await sql.end();
}

async function audit() {
  const [{ creditLedger, productEvents, apiIdempotencyKeys, migrationTable, backup }] = await sql`
    SELECT
      to_regclass('public.credit_ledger')::text AS "creditLedger",
      to_regclass('public.product_events')::text AS "productEvents",
      to_regclass('public.api_idempotency_keys')::text AS "apiIdempotencyKeys",
      to_regclass('drizzle.__drizzle_migrations')::text AS "migrationTable",
      to_regclass(${`public.${backupTable}`})::text AS backup
  `;

  const result = {
    creditLedger: Boolean(creditLedger),
    productEvents: Boolean(productEvents),
    apiIdempotencyKeys: Boolean(apiIdempotencyKeys),
    migrationTable: Boolean(migrationTable),
    backupTable: Boolean(backup),
    duplicateInitialGrantRows: 0,
    duplicateMonthlyGrantRows: 0,
    expectedIndexes: [],
    latestMigrationCreatedAt: null
  };

  if (creditLedger) {
    const [duplicates] = await sql`
      SELECT
        COALESCE(SUM(initial_count - 1), 0)::int AS "initialRows",
        COALESCE(SUM(monthly_count - 1), 0)::int AS "monthlyRows"
      FROM (
        SELECT
          CASE WHEN action = 'subscription.initial_grant' THEN COUNT(*) ELSE 1 END AS initial_count,
          CASE WHEN action = 'subscription.monthly_grant' THEN COUNT(*) ELSE 1 END AS monthly_count
        FROM credit_ledger
        WHERE (action = 'subscription.initial_grant' AND metadata->>'subscriptionId' IS NOT NULL)
           OR (action = 'subscription.monthly_grant' AND metadata->>'invoiceId' IS NOT NULL)
        GROUP BY action,
          CASE WHEN action = 'subscription.initial_grant' THEN metadata->>'subscriptionId' END,
          CASE WHEN action = 'subscription.monthly_grant' THEN metadata->>'invoiceId' END
        HAVING COUNT(*) > 1
      ) duplicate_groups
    `;
    result.duplicateInitialGrantRows = duplicates.initialRows;
    result.duplicateMonthlyGrantRows = duplicates.monthlyRows;

    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'credit_ledger_initial_subscription_unique',
          'credit_ledger_monthly_invoice_unique',
          'credit_ledger_user_action_request_unique',
          'credit_ledger_user_created_at_idx',
          'api_usage_successful_request_unique',
          'api_usage_user_created_at_idx',
          'api_idempotency_keys_user_action_key_unique',
          'api_idempotency_keys_updated_at_idx',
          'extension_api_tokens_active_user_unique',
          'team_members_user_team_unique',
          'product_events_event_created_at_idx',
          'product_events_user_created_at_idx'
        )
      ORDER BY indexname
    `;
    result.expectedIndexes = indexes.map((row) => row.indexname);
  }

  if (migrationTable) {
    const [latest] = await sql`
      SELECT created_at AS "createdAt"
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `;
    result.latestMigrationCreatedAt = latest?.createdAt === undefined ? null : String(latest.createdAt);
  }

  return result;
}

async function backupDuplicateBillingGrants(report) {
  const duplicateRows = report.duplicateInitialGrantRows + report.duplicateMonthlyGrantRows;
  if (!report.creditLedger || duplicateRows === 0) return;

  await sql.begin(async (tx) => {
    await tx.unsafe(`CREATE TABLE IF NOT EXISTS ${backupTable} AS SELECT * FROM credit_ledger WHERE false`);
    await tx.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS ${backupTable}_id_unique ON ${backupTable} (id)`);
    await tx.unsafe(`
      INSERT INTO ${backupTable}
      SELECT DISTINCT older.*
      FROM credit_ledger older
      JOIN credit_ledger newer
        ON older.action = newer.action
       AND older.id > newer.id
       AND (
         (older.action = 'subscription.initial_grant'
          AND older.metadata->>'subscriptionId' IS NOT NULL
          AND older.metadata->>'subscriptionId' = newer.metadata->>'subscriptionId')
         OR
         (older.action = 'subscription.monthly_grant'
          AND older.metadata->>'invoiceId' IS NOT NULL
          AND older.metadata->>'invoiceId' = newer.metadata->>'invoiceId')
       )
      ON CONFLICT (id) DO NOTHING
    `);
  });
  console.log(JSON.stringify({ backupCreated: backupTable, duplicateRows }));
}

async function backupConsistencyRows() {
  const [{ teamMembers, extensionTokens }] = await sql.begin(async (tx) => {
    await tx.unsafe(
      `CREATE TABLE IF NOT EXISTS ${consistencyBackupTables.teamMembers} AS TABLE team_members`
    );
    await tx.unsafe(
      `CREATE TABLE IF NOT EXISTS ${consistencyBackupTables.extensionTokens} AS TABLE extension_api_tokens`
    );
    return tx`
      SELECT
        (SELECT COUNT(*)::int FROM ${tx(consistencyBackupTables.teamMembers)}) AS "teamMembers",
        (SELECT COUNT(*)::int FROM ${tx(consistencyBackupTables.extensionTokens)}) AS "extensionTokens"
    `;
  });

  console.log(JSON.stringify({
    backupCreated: consistencyBackupTables,
    rows: { teamMembers, extensionTokens }
  }));
}

async function applyMigration(spec) {
  const separator = spec.lastIndexOf(":");
  if (separator < 1) throw new Error(`Invalid migration spec: ${spec}`);
  const filePath = spec.slice(0, separator);
  const createdAt = Number(spec.slice(separator + 1));
  if (!Number.isSafeInteger(createdAt)) throw new Error(`Invalid migration timestamp: ${spec}`);

  const query = await fs.readFile(filePath, "utf8");
  const hash = crypto.createHash("sha256").update(query).digest("hex");

  await sql.begin(async (tx) => {
    await tx.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    const [existing] = await tx`
      SELECT id
      FROM drizzle.__drizzle_migrations
      WHERE hash = ${hash}
      LIMIT 1
    `;
    if (existing) return;

    const statements = query
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await tx.unsafe(statement);
    await tx`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${createdAt})
    `;
  });
  console.log(JSON.stringify({ applied: filePath, createdAt }));
}
