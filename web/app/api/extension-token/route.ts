import { getActiveExtensionTokenInfo, getUser } from '@/lib/db/queries';
import {
  createExtensionToken,
  revokeExtensionToken,
  revokeExtensionTokens
} from '@/lib/extension-tokens';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getActiveExtensionTokenInfo(user.id);
  return Response.json({
    hasToken: Boolean(token),
    token,
    extensionId: getDefaultExtensionId()
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const extensionId = clean(payload.extensionId) || getDefaultExtensionId();
  const allowedIds = getAllowedExtensionIds();
  if (!extensionId) {
    return Response.json({ error: 'Chrome extension id is required.' }, { status: 400 });
  }
  if (allowedIds.length > 0 && !allowedIds.includes(extensionId)) {
    return Response.json({ error: 'This Chrome extension is not allowed.' }, { status: 403 });
  }
  if (process.env.NODE_ENV === 'production' && allowedIds.length === 0) {
    return Response.json({ error: 'Production Chrome extension allowlist is not configured.' }, { status: 503 });
  }

  const token = await createExtensionToken(user.id);
  return Response.json({ ...token, extensionId });
}

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await revokeExtensionTokens(user.id);

  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const tokenId = Number(payload.tokenId);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    return Response.json({ error: 'Valid tokenId is required.' }, { status: 400 });
  }

  await revokeExtensionToken(user.id, tokenId);
  return Response.json({ ok: true });
}

function getDefaultExtensionId() {
  return getAllowedExtensionIds()[0] || '';
}

function getAllowedExtensionIds() {
  return [
    process.env.ALLOWED_EXTENSION_IDS,
    process.env.CHROME_EXTENSION_ID,
    process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function clean(value: unknown) {
  return String(value || '').trim();
}
