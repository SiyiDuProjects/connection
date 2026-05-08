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
  introStyle: z.enum(['student', 'career-switcher', 'experienced', 'founder']).optional(),
  emailTone: z.enum(['warm', 'concise', 'confident', 'formal']).optional(),
  outreachLength: z.enum(['short', 'concise', 'detailed']).optional(),
  outreachGoal: z.enum(['advice', 'referral', 'intro']).optional(),
  outreachStyleNotes: z.string().max(500).optional(),
  targetRole: z.string().max(200).optional(),
  senderProfile: z.string().max(2000).optional(),
  resumeContext: z.string().max(40000).optional(),
  resumeFileName: z.string().max(260).optional(),
  resumeUploadedAt: z.string().datetime().nullable().optional(),
  defaultSearchPreferences: z.object({
    school: z.object({
      label: z.string().max(160),
      linkedinId: z.string().max(40)
    }).optional(),
    region: z.object({
      label: z.string().max(160),
      linkedinGeoId: z.string().max(40)
    }).optional()
  }).optional()
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
  const existing = await getSettings(user.id);
  const name = clean(payload.name);
  const has = (key: keyof typeof payload) => Object.prototype.hasOwnProperty.call(payload, key);
  const values = {
    userId: user.id,
    senderName: has('senderName') ? clean(payload.senderName) : existing?.senderName || '',
    region: has('region') ? clean(payload.region) : existing?.region || '',
    school: has('school') ? clean(payload.school) : existing?.school || '',
    emailSignature: has('emailSignature') ? cleanMultiline(payload.emailSignature) : existing?.emailSignature || '',
    introStyle: payload.introStyle || existing?.introStyle || 'student',
    targetRole: has('targetRole') ? clean(payload.targetRole) : existing?.targetRole || '',
    emailTone: payload.emailTone || existing?.emailTone || 'warm',
    outreachLength: payload.outreachLength || existing?.outreachLength || 'concise',
    outreachGoal: payload.outreachGoal || existing?.outreachGoal || 'advice',
    outreachStyleNotes: has('outreachStyleNotes') ? cleanMultiline(payload.outreachStyleNotes) : existing?.outreachStyleNotes || '',
    senderProfile: has('senderProfile') ? clean(payload.senderProfile) : existing?.senderProfile || '',
    resumeContext: has('resumeContext') ? cleanMultiline(payload.resumeContext) : existing?.resumeContext || '',
    resumeFileName: has('resumeFileName') ? clean(payload.resumeFileName) : existing?.resumeFileName || '',
    resumeUploadedAt: has('resumeUploadedAt')
      ? payload.resumeUploadedAt
        ? new Date(payload.resumeUploadedAt)
        : null
      : existing?.resumeUploadedAt || null,
    defaultSearchPreferences: has('defaultSearchPreferences')
      ? normalizeSearchPreferences(payload.defaultSearchPreferences)
      : normalizeSearchPreferences(existing?.defaultSearchPreferences),
    updatedAt: new Date()
  };

  if (has('name') && name && name !== user.name) {
    await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  await db
    .insert(userSettings)
    .values(values)
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: values
    });

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

function normalizeSearchPreferences(value: z.infer<typeof settingsSchema>['defaultSearchPreferences'] | unknown) {
  if (!value || typeof value !== 'object') {
    return {
      school: undefined,
      region: undefined
    };
  }
  const preferences = value as z.infer<typeof settingsSchema>['defaultSearchPreferences'];
  return {
    school: preferences?.school?.label && preferences.school.linkedinId
      ? {
          label: clean(preferences.school.label),
          linkedinId: clean(preferences.school.linkedinId)
        }
      : undefined,
    region: preferences?.region?.label && preferences.region.linkedinGeoId
      ? {
          label: clean(preferences.region.label),
          linkedinGeoId: clean(preferences.region.linkedinGeoId)
        }
      : undefined
  };
}
