import crypto from "node:crypto";
import postgres from "postgres";

const sql = process.env.POSTGRES_URL ? postgres(process.env.POSTGRES_URL) : null;

export async function getGmailStatus(userId) {
  ensureConfigured();
  const rows = await sql`
    select id, email_address, connected_at, last_sync_at
    from gmail_connections
    where user_id = ${userId}
      and disconnected_at is null
    limit 1
  `;
  return rows[0] || null;
}

export async function sendTrackedGmail({ userId, to, subject, body, contact = {}, job = {} }) {
  ensureConfigured();
  const connection = await activeConnection(userId);
  if (!connection) {
    const error = new Error("Connect Gmail from the dashboard before sending tracked emails.");
    error.status = 409;
    throw error;
  }

  const accessToken = await refreshAccessToken(decryptSecret(connection.refresh_token_encrypted));
  const sent = await gmailFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", accessToken, {
    method: "POST",
    body: JSON.stringify({
      raw: encodeRawEmail({ from: connection.email_address, to, subject, body })
    })
  });

  const followUpDueAt = addBusinessDays(new Date(), 5);
  const rows = await sql`
    insert into outreach_emails (
      user_id,
      gmail_connection_id,
      recipient_email,
      recipient_name,
      recipient_title,
      company_name,
      job_title,
      contact_linkedin_url,
      gmail_thread_id,
      gmail_message_id,
      follow_up_due_at
    )
    values (
      ${userId},
      ${connection.id},
      ${to},
      ${clean(contact.name)},
      ${clean(contact.title)},
      ${clean(job.companyName || contact.companyName)},
      ${clean(job.jobTitle)},
      ${clean(contact.linkedinUrl)},
      ${sent.threadId},
      ${sent.id},
      ${followUpDueAt}
    )
    returning id, sent_at
  `;

  return {
    outreachId: rows[0]?.id,
    sentAt: rows[0]?.sent_at || new Date(),
    followUpDueAt,
    threadId: sent.threadId,
    messageId: sent.id
  };
}

async function activeConnection(userId) {
  const rows = await sql`
    select *
    from gmail_connections
    where user_id = ${userId}
      and disconnected_at is null
    limit 1
  `;
  return rows[0] || null;
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token"
    })
  });
  const data = await googleJson(response);
  return data.access_token;
}

async function gmailFetch(url, accessToken, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  return googleJson(response);
}

async function googleJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.error?.message || `Google API failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function encodeRawEmail({ from, to, subject, body }) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decryptSecret(value) {
  const [ivText, tagText, encryptedText] = String(value || "").split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Encrypted Gmail token is malformed.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function encryptionKey() {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY or AUTH_SECRET is required.");
  return crypto.createHash("sha256").update(secret).digest();
}

function addBusinessDays(start, days) {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
  }
  return date;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is not configured.`);
  return process.env[name];
}

function ensureConfigured() {
  if (!sql) {
    const error = new Error("POSTGRES_URL is not configured.");
    error.status = 500;
    throw error;
  }
}
