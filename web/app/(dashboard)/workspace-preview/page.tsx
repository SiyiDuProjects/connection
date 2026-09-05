import { DashboardPreview } from './dashboard-preview';
import { notFound } from 'next/navigation';

export default function WorkspacePreviewPage() {
  if (!process.env.REACHARD_PREVIEW_DIST_DIR) notFound();
  return <DashboardPreview />;
}
