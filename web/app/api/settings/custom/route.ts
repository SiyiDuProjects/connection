import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { userSettings } from '@/lib/db/schema';
import { getSettings, getUser } from '@/lib/db/queries';
import { getUserFromExtensionBearer } from '@/lib/extension-tokens';

const customSchema = z.object({
  tone: z.enum(['warm', 'direct', 'formal', 'confident']).optional(),
  length: z.enum(['short', 'concise', 'detailed']).optional(),
  goal: z.enum(['advice', 'referral', 'intro']).optional(),
  notes: z.string().max(500).optional()
});

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getSettings(user.id);
  return Response.json({
    ok: true,
    custom: settingsToCustom(settings)
  });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = customSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Check custom settings and try again.' }, { status: 400 });
  }

  const custom = normalizeCustom(parsed.data);
  const values = {
    userId: user.id,
    emailTone: custom.emailTone,
    outreachLength: custom.outreachLength,
    outreachGoal: custom.outreachGoal,
    outreachStyleNotes: custom.outreachStyleNotes,
    defaultSearchPreferences: {},
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

  return Response.json({
    ok: true,
    custom: {
      tone: custom.tone,
      length: custom.outreachLength,
      goal: custom.outreachGoal,
      notes: custom.outreachStyleNotes
    }
  });
}

async function getAuthenticatedUser(request: Request) {
  return (await getUser()) || (await getUserFromExtensionBearer(request));
}

function settingsToCustom(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    tone: toneFromEmailTone(settings?.emailTone),
    length: settings?.outreachLength || 'concise',
    goal: settings?.outreachGoal || 'advice',
    notes: settings?.outreachStyleNotes || ''
  };
}

function normalizeCustom(input: z.infer<typeof customSchema>) {
  const tone = input.tone || 'warm';
  return {
    tone,
    emailTone: tone === 'direct' ? 'concise' : tone,
    outreachLength: input.length || 'concise',
    outreachGoal: input.goal || 'advice',
    outreachStyleNotes: String(input.notes || '').trim().slice(0, 500)
  };
}

function toneFromEmailTone(value: unknown) {
  const tone = String(value || 'warm');
  return tone === 'concise' ? 'direct' : tone;
}
