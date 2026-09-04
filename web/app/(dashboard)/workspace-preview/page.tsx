import { ContactWorkspace } from '../dashboard/search/search-workspace';
import { ComponentPreview } from '@/components/dev/component-preview';

export default async function WorkspacePreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  if (process.env.NODE_ENV === 'development' && view === 'components') return <ComponentPreview />;
  return <ContactWorkspace />;
}
