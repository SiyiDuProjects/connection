import "dotenv/config";
import postgres from "postgres";

const daysArg = process.argv.find((value) => value.startsWith("--days="));
const days = Math.max(1, Math.min(365, Number(daysArg?.split("=")[1] || 30)));
if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL is not configured.");

const sql = postgres(process.env.POSTGRES_URL, { max: 1, idle_timeout: 5 });

try {
  const rows = await sql`
    select
      action,
      coalesce(response->'internalCost'->>'source', '') as source,
      coalesce(response->'internalCost'->>'provider', '') as provider,
      coalesce(response->'internalCost'->>'endpoint', '') as endpoint,
      coalesce(response->'internalCost'->>'model', '') as model,
      coalesce(response->'internalCost'->>'billing', '') as billing,
      count(*)::int as calls,
      coalesce(sum((response->'internalCost'->>'costMicroUsd')::bigint), 0)::bigint as cost_micro_usd,
      coalesce(sum((response->'internalCost'->>'inputTokens')::bigint), 0)::bigint as input_tokens,
      coalesce(sum((response->'internalCost'->>'outputTokens')::bigint), 0)::bigint as output_tokens,
      round(coalesce(avg((response->'internalCost'->>'durationMs')::numeric), 0), 0)::int as avg_duration_ms
    from api_usage
    where created_at >= now() - (${days}::text || ' days')::interval
      and response ? 'internalCost'
    group by action, source, provider, endpoint, model, billing
    order by cost_micro_usd desc, calls desc
  `;

  console.table(rows.map((row) => ({
    action: row.action,
    source: row.source,
    provider: row.provider,
    endpoint: row.endpoint,
    model: row.model,
    billing: row.billing,
    calls: Number(row.calls),
    costUsd: (Number(row.cost_micro_usd) / 1_000_000).toFixed(6),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    avgDurationMs: Number(row.avg_duration_ms)
  })));
} finally {
  await sql.end({ timeout: 5 });
}
