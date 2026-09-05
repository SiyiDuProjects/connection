import { notFound } from 'next/navigation';
import { ComponentChecks } from './component-checks';

export default function UIPreviewPage() {
  if (!process.env.REACHARD_PREVIEW_DIST_DIR) notFound();
  return <ComponentChecks />;
}
