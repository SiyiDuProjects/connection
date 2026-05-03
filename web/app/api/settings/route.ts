import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { userSettings } from '@/lib/db/schema';
import { getSettings, getUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json(await getSettings(user.id));
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const values = {
    userId: user.id,
    targetRole: clean(payload.targetRole),
    emailTone: clean(payload.emailTone) || 'warm',
    senderProfile: clean(payload.senderProfile),
    defaultSearchPreferences: {
      location: clean(payload.location),
      seniority: clean(payload.seniority)
    },
    updatedAt: new Date()
  };

  const existing = await getSettings(user.id);
  if (existing) {
    await db
      .update(userSettings)
      .set(values)
      .where(eq(userSettings.userId, user.id));
  } else {
    await db.insert(userSettings).values(values);
  }

  return Response.json({ ok: true });
}

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
