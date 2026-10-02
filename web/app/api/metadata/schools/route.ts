import { searchSchools } from '@/lib/schools';

// Public, bounded search over a bundled directory; no user data or provider calls.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (query.length < 2 || query.length > 160) {
    return Response.json({ ok: false, error: 'Enter between 2 and 160 characters.' }, { status: 400 });
  }
  return Response.json({ ok: true, schools: searchSchools(query) }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
