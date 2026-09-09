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
  const mapping = { tone: 'emailTone', length: 'outreachLength', goal: 'outreachGoal', notes: 'outreachStyleNotes' } as const;
  const patch: Partial<typeof userSettings.$inferInsert> = {};
  for (const key of Object.keys(mapping) as (keyof typeof mapping)[]) {
    if (Object.prototype.hasOwnProperty.call(parsed.data, key)) patch[mapping[key]] = custom[mapping[key]];
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: true, custom: settingsToCustom(await getSettings(user.id)) });
  }
  // An atomic partial upsert preserves omitted fields and tolerates concurrent first saves.
  const [saved] = await db.insert(userSettings).values({ userId: user.id, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...patch, updatedAt: new Date() } }).returning();
  return Response.json({ ok: true, custom: settingsToCustom(saved) });
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
