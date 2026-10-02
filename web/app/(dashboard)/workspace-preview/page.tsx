import { DashboardPreview } from './dashboard-preview';
import { notFound } from 'next/navigation';

export default async function WorkspacePreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!process.env.REACHARD_PREVIEW_DIST_DIR) notFound();
  const { view } = await searchParams;
  return <DashboardPreview initialPath={view === 'billing' ? '/dashboard/billing' : '/dashboard'} />;
}
