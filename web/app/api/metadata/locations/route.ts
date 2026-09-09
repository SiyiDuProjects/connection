import { getUser } from '@/lib/db/queries';

// Legacy paid suggestion lookups are retired. Profile fields accept plain text.
export async function GET(request: Request) {
  if (!await getUser()) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const query = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (query.length < 2 || query.length > 160) {
    return Response.json({ ok: false, error: 'Enter between 2 and 160 characters.' }, { status: 400 });
  }
  return Response.json({ ok: false, error: 'Enter the name yourself. Search suggestions are no longer available.' }, { status: 410 });
}
