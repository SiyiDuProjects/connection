import { notFound } from 'next/navigation';
import { FirstRunPreview } from './preview';

export default function FirstRunPreviewPage() {
  if (!process.env.REACHARD_PREVIEW_DIST_DIR) notFound();
  return <FirstRunPreview />;
}
