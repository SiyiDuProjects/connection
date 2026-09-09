export type DashboardUsage = {
  id: number;
  action: string;
  status: string;
  createdAt: string;
  credits?: number;
  request?: { companyName?: string; jobTitle?: string } | null;
};

export type DashboardAccount = {
  user: { id?: number; name: string | null; email: string };
  credits: { remaining: number; unlimited?: boolean };
  settings?: { senderName?: string | null; school?: string | null; region?: string | null; resumeFileName?: string | null } | null;
  subscription?: { planName?: string; status?: string };
  extension?: { connected: boolean };
  trial?: { total: number; remaining: number; requiresCard: false } | null;
  usage: DashboardUsage[];
};

export const actionNames: Record<string, string> = {
  'contacts.search': 'People search', 'contacts.reveal': 'Email reveal', 'email.draft': 'Email draft'
};

export function summarizeUsage(usage: DashboardUsage[]) {
  const successful = usage.filter(row => row.status === 'success');
  const count = (action: string) => successful.filter(row => row.action === action).length;
  const daily = new Map<string, { date: string; reveals: number; drafts: number }>();
  for (const row of successful) {
    if (!['contacts.reveal', 'email.draft'].includes(row.action) || !Number.isFinite(Date.parse(row.createdAt))) continue;
    const date = new Date(row.createdAt).toISOString().slice(0, 10);
    const point = daily.get(date) || { date, reveals: 0, drafts: 0 };
    if (row.action === 'contacts.reveal') point.reveals++;
    else point.drafts++;
    daily.set(date, point);
  }
  return {
    reveals: count('contacts.reveal'), drafts: count('email.draft'),
    byAction: Object.entries(actionNames).map(([action, name]) => ({ name, count: count(action) })),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  };
}
