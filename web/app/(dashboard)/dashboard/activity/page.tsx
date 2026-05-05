import { AlertCircle, MailCheck, MailPlus, MessageSquareReply, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveGmailConnection, getOutreachStats, getRecentUsage, getUser } from '@/lib/db/queries';
import { EmailActions } from './email-actions';

export default async function ActivityPage() {
  const user = await getUser();
  const usage = user ? await getRecentUsage(user.id) : [];
  const gmail = user ? await getActiveGmailConnection(user.id) : null;
  const outreach = user
    ? await getOutreachStats(user.id)
    : { sent: 0, replied: 0, replyRate: 0, followUps: [] };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-medium text-gray-900 lg:text-2xl">Outreach activity</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track credits, sent emails, reply rate, and follow-ups without storing email content.
          </p>
        </div>
        <EmailActions connected={Boolean(gmail)} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric icon={Wallet} label="Credits used recently" value={usage.reduce((sum, row) => sum + Math.max(0, row.credits), 0)} />
        <Metric icon={MailPlus} label="Tracked sends" value={outreach.sent} />
        <Metric icon={MessageSquareReply} label="Replies" value={outreach.replied} />
        <Metric icon={MailCheck} label="Reply rate" value={`${outreach.replyRate}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>API usage and credits</CardTitle>
          </CardHeader>
          <CardContent>
            {usage.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2">Action</th>
                      <th className="py-2">Credits</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="py-2">{formatUsageAction(row.action)}</td>
                        <td className="py-2">{row.credits}</td>
                        <td className="py-2">{row.status}</td>
                        <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No credit usage yet" body="Contact searches, email reveals, and AI drafts will appear here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gmail tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-950">{gmail ? gmail.emailAddress : 'Gmail not connected'}</p>
              <p className="mt-1 text-sm text-gray-600">
                {gmail
                  ? `Last metadata sync: ${gmail.lastSyncAt ? new Date(gmail.lastSyncAt).toLocaleString() : 'never'}`
                  : 'Connect Gmail to send tracked outreach and calculate reply rate.'}
              </p>
            </div>

            {outreach.followUps.length ? (
              <div>
                <p className="mb-3 text-sm font-medium text-gray-950">Follow-up due</p>
                <ul className="space-y-3">
                  {outreach.followUps.map((item) => (
                    <li key={item.id} className="border border-gray-200 p-3 text-sm">
                      <p className="font-medium text-gray-950">{item.recipientName || item.recipientEmail}</p>
                      <p className="text-gray-600">{[item.companyName, item.jobTitle].filter(Boolean).join(' - ') || 'Tracked outreach'}</p>
                      <p className="text-xs text-gray-500">Sent {new Date(item.sentAt).toLocaleDateString()}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState title="No follow-ups due" body="Unreplied emails will appear here after five business days." />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="mb-3 h-5 w-5 text-gray-700" />
        <p className="text-2xl font-semibold text-gray-950">{value}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="mb-4 h-10 w-10 text-gray-400" />
      <h3 className="mb-2 text-base font-semibold text-gray-900">{title}</h3>
      <p className="max-w-sm text-sm text-gray-500">{body}</p>
    </div>
  );
}

function formatUsageAction(action: string) {
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
