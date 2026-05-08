import { getUser } from '@/lib/db/queries';

const HOST = process.env.RAPIDAPI_METADATA_HOST || 'z-real-time-linkedin-scraper-api1.p.rapidapi.com';

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (query.length < 2) {
    return Response.json({ ok: false, error: 'Enter at least 2 characters.' }, { status: 400 });
  }
  if (!process.env.RAPIDAPI_KEY) {
    return Response.json({ ok: false, error: 'RapidAPI is not configured.' }, { status: 500 });
  }

  const url = new URL(`https://${HOST}/api/search/metadata/location`);
  url.searchParams.set('search', query);
  url.searchParams.set('limit', '8');

  const response = await fetch(url, { headers: rapidHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === 'ERROR') {
    return Response.json({ ok: false, error: data.message || 'Could not resolve location.' }, { status: 502 });
  }

  const results = Array.isArray(data.data) ? data.data : [];
  return Response.json({
    ok: true,
    items: results.map((location: Record<string, unknown>) => ({
      id: String(location.id || ''),
      label: String(location.name || ''),
      subtitle: String(location.countryCode || ''),
      type: 'location'
    })).filter((item: { id: string; label: string }) => item.id && item.label)
  });
}

function rapidHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY || ''
  };
}
