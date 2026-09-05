// Read-only release preflight. Never print connection strings, keys, or user data.
import postgres from 'postgres';

const url = process.env.POSTGRES_URL;
if (!url) throw new Error('POSTGRES_URL is missing');
const target = new URL(url);
const sql = postgres(url, { max: 1, connect_timeout: 10 });
try {
  const columns = await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'email_verification_tokens'
      and column_name in ('code_hash', 'attempts')
  `;
  console.log(JSON.stringify({
    check: 'email-verification-readiness',
    databaseHost: target.hostname, databaseName: target.pathname.slice(1),
    mailKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    senderConfigured: Boolean(process.env.EMAIL_FROM?.trim()),
    authSecretReady: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
    verificationSchemaReady: columns.length === 2,
  }));
} catch {
  throw new Error('Could not complete the read-only email database preflight.');
} finally {
  await sql.end();
}
