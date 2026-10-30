// Both the website's Drizzle rows and the contacts SQL projection use this policy.
export function getOnboardingStatus(user, settings) {
  const clean = value => String(value || '').trim();
  const fields = [['name', user?.name], ['school', settings?.school]];
  const background = clean(settings?.senderProfile ?? settings?.sender_profile) || clean(settings?.resumeContext ?? settings?.resume_context);
  const missingFields = fields.filter(([,value]) => !clean(value)).map(([key]) => key);
  if (!background) missingFields.push('background');
  return {complete:missingFields.length===0, missingFields, completedFields:3-missingFields.length, totalFields:3};
}
