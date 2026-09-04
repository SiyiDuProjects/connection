import { getActiveExtensionTokenInfo, getUser } from '@/lib/db/queries';
import {
  createExtensionToken,
  revokeExtensionToken,
  revokeExtensionTokens
} from '@/lib/extension-tokens';
import {
  getAllowedExtensionIds,
  getDefaultExtensionId,
  isOpenExtensionIdBeta,
  isValidExtensionId
} from '@/lib/extension-id-policy';

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
  if (!isValidExtensionId(extensionId)) {
    return Response.json({ error: 'A valid Chrome extension id is required.' }, { status: 400 });
  }
  if (!isOpenExtensionIdBeta() && allowedIds.length > 0 && !allowedIds.includes(extensionId)) {
    return Response.json({ error: 'This Chrome extension is not allowed.' }, { status: 403 });
  }
  if (!isOpenExtensionIdBeta() && process.env.NODE_ENV === 'production' && allowedIds.length === 0) {
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

function clean(value: unknown) {
  return String(value || '').trim();
}
