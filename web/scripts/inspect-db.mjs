import postgres from "postgres";
import "dotenv/config";

const sql = postgres(process.env.POSTGRES_URL);
const rows = await sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name
`;

console.log(rows.map((row) => row.table_name).join("\n") || "(no public tables)");
await sql.end();
