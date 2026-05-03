import { getActiveExtensionTokenInfo, getUser } from '@/lib/db/queries';
import { createExtensionToken, revokeExtensionTokens } from '@/lib/extension-tokens';

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
  return Response.json({ token });
}

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await revokeExtensionTokens(user.id);

  return Response.json({ ok: true });
}
