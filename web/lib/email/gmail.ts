import { db } from '@/lib/db/drizzle';
import { gmailConnections, outreachEmails } from '@/lib/db/schema';
import { decryptSecret, encryptSecret } from './crypto';
import { and, eq, isNull } from 'drizzle-orm';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.metadata'
].join(' ');

export function gmailScopes() {
  return GMAIL_SCOPES;
}

export function gmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && appBaseUrl());
}

export function gmailAuthUrl(state: string) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', requiredEnv('GOOGLE_CLIENT_ID'));
  url.searchParams.set('redirect_uri', gmailRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function connectGmail(userId: number, code: string) {
  const token = await exchangeCode(code);
  if (!token.refresh_token) {
    throw new Error('Google did not return a refresh token. Disconnect and try again.');
  }

  const profile = await gmailFetch<{ emailAddress: string }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    token.access_token
  );

  await db.transaction(async (tx) => {
    await tx
      .update(gmailConnections)
      .set({ disconnectedAt: new Date() })
      .where(
        and(
          eq(gmailConnections.userId, userId),
          isNull(gmailConnections.disconnectedAt)
        )
      );

    await tx.insert(gmailConnections).values({
      userId,
      emailAddress: profile.emailAddress,
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      scope: token.scope || GMAIL_SCOPES
    });
  });
}

export async function disconnectGmail(userId: number) {
  await db
    .update(gmailConnections)
    .set({ disconnectedAt: new Date() })
    .where(
      and(
        eq(gmailConnections.userId, userId),
        isNull(gmailConnections.disconnectedAt)
      )
    );
}

export async function sendTrackedGmail({
  userId,
  to,
  subject,
  body,
  contact,
  job
}: {
  userId: number;
  to: string;
  subject: string;
  body: string;
  contact?: Record<string, unknown>;
  job?: Record<string, unknown>;
}) {
  const connection = await activeConnection(userId);
  if (!connection) throw new Error('Connect Gmail before sending tracked emails.');

  const accessToken = await refreshAccessToken(decryptSecret(connection.refreshTokenEncrypted));
  const payload = await gmailFetch<{ id: string; threadId: string }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        raw: encodeRawEmail({
          from: connection.emailAddress,
          to,
          subject,
          body
        })
      })
    }
  );

  const sentAt = new Date();
  const followUpDueAt = addBusinessDays(sentAt, 5);
  const [row] = await db
    .insert(outreachEmails)
    .values({
      userId,
      gmailConnectionId: connection.id,
      recipientEmail: to,
      recipientName: clean(contact?.name),
      recipientTitle: clean(contact?.title),
      companyName: clean(job?.companyName || contact?.companyName),
      jobTitle: clean(job?.jobTitle),
      contactLinkedinUrl: clean(contact?.linkedinUrl),
      gmailThreadId: payload.threadId,
      gmailMessageId: payload.id,
      sentAt,
      followUpDueAt
    })
    .returning();

  return { messageId: payload.id, threadId: payload.threadId, sentAt, followUpDueAt, outreachId: row.id };
}

export async function syncGmailReplies(userId: number) {
  const connection = await activeConnection(userId);
  if (!connection) throw new Error('Connect Gmail before syncing replies.');

  const pending = await db
    .select()
    .from(outreachEmails)
    .where(
      and(
        eq(outreachEmails.userId, userId),
        isNull(outreachEmails.repliedAt)
      )
    )
    .limit(50);

  if (!pending.length) return { checked: 0, replied: 0 };

  const accessToken = await refreshAccessToken(decryptSecret(connection.refreshTokenEncrypted));
  let replied = 0;
  for (const item of pending) {
    if (!item.gmailThreadId || !item.gmailMessageId) continue;
    const thread = await gmailFetch<{ messages?: { id: string; internalDate?: string }[] }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${item.gmailThreadId}?format=metadata`,
      accessToken
    );
    const reply = (thread.messages || []).find((message) => message.id !== item.gmailMessageId);
    if (!reply) continue;

    replied += 1;
    await db
      .update(outreachEmails)
      .set({ repliedAt: reply.internalDate ? new Date(Number(reply.internalDate)) : new Date() })
      .where(eq(outreachEmails.id, item.id));
  }

  await db
    .update(gmailConnections)
    .set({ lastSyncAt: new Date() })
    .where(eq(gmailConnections.id, connection.id));

  return { checked: pending.length, replied };
}

async function activeConnection(userId: number) {
  const [connection] = await db
    .select()
    .from(gmailConnections)
    .where(
      and(
        eq(gmailConnections.userId, userId),
        isNull(gmailConnections.disconnectedAt)
      )
    )
    .limit(1);
  return connection || null;
}

async function exchangeCode(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: gmailRedirectUri(),
      grant_type: 'authorization_code'
    })
  });
  return parseGoogleResponse<{
    access_token: string;
    refresh_token?: string;
    scope?: string;
  }>(response);
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token'
    })
  });
  const token = await parseGoogleResponse<{ access_token: string }>(response);
  return token.access_token;
}

async function gmailFetch<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return parseGoogleResponse<T>(response);
}

async function parseGoogleResponse<T>(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error?.message || `Google API failed with ${response.status}`);
  }
  return payload as T;
}

function encodeRawEmail({ from, to, subject, body }: { from: string; to: string; subject: string; body: string }) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

function gmailRedirectUri() {
  return `${appBaseUrl()}/api/email/google/callback`;
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.BASE_URL || '').replace(/\/+$/, '');
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
