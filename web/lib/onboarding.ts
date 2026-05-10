import type { UserSettings, User } from '@/lib/db/schema';

export type OnboardingStatus = {
  complete: boolean;
  missingFields: string[];
  completedFields: number;
  totalFields: number;
};

export function getOnboardingStatus(
  user: Pick<User, 'name'> | null | undefined,
  settings: Partial<UserSettings> | null | undefined
): OnboardingStatus {
  const fields = [
    ['name', user?.name],
    ['school', settings?.school],
    ['targetRole', settings?.targetRole]
  ] as const;
  const hasBackground = Boolean(clean(settings?.senderProfile) || clean(settings?.resumeContext));
  const missingFields: string[] = fields
    .filter(([, value]) => !clean(value))
    .map(([key]) => key);

  if (!hasBackground) missingFields.push('background');

  return {
    complete: missingFields.length === 0,
    missingFields,
    completedFields: fields.length + 1 - missingFields.length,
    totalFields: fields.length + 1,
  };
}

function clean(value: unknown) {
  return String(value || '').trim();
}
