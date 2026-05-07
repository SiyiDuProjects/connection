import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { users, userSettings } from '@/lib/db/schema';
import { getSettings, getUser } from '@/lib/db/queries';

const settingsSchema = z.object({
  name: z.string().max(100).optional(),
  senderName: z.string().max(120).optional(),
  region: z.string().max(160).optional(),
  school: z.string().max(160).optional(),
  emailSignature: z.string().max(1000).optional(),
  introStyle: z.enum(['student', 'career-switcher', 'experienced', 'founder']).default('student'),
  emailTone: z.enum(['warm', 'concise', 'confident', 'formal']).default('warm'),
  outreachLength: z.enum(['short', 'concise', 'detailed']).default('concise'),
  outreachGoal: z.enum(['advice', 'referral', 'intro']).default('advice'),
  outreachStyleNotes: z.string().max(500).optional(),
  targetRole: z.string().max(200).optional(),
  senderProfile: z.string().max(2000).optional(),
  resumeContext: z.string().max(40000).optional(),
  resumeFileName: z.string().max(260).optional()
});

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({
    ...(await getSettings(user.id)),
    name: user.name
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'Check the highlighted fields and try again.' },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const name = clean(payload.name);
  const values = {
    userId: user.id,
    senderName: clean(payload.senderName),
    region: clean(payload.region),
    school: clean(payload.school),
    emailSignature: cleanMultiline(payload.emailSignature),
    introStyle: payload.introStyle,
    targetRole: clean(payload.targetRole),
    emailTone: payload.emailTone,
    outreachLength: payload.outreachLength,
    outreachGoal: payload.outreachGoal,
    outreachStyleNotes: cleanMultiline(payload.outreachStyleNotes),
    senderProfile: clean(payload.senderProfile),
    resumeContext: cleanMultiline(payload.resumeContext),
    resumeFileName: clean(payload.resumeFileName),
    defaultSearchPreferences: {},
    updatedAt: new Date()
  };

  const existing = await getSettings(user.id);
  if (name && name !== user.name) {
    await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

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

function cleanMultiline(value: unknown) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
