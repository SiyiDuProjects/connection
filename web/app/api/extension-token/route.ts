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
  return Response.json({ hasToken: Boolean(token), token });
}

export async function POST() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await createExtensionToken(user.id);
  return Response.json(token);
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
