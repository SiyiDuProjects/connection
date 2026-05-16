import { getUser } from '@/lib/db/queries';

const HOST = process.env.RAPIDAPI_PEOPLE_HOST || 'fresh-linkedin-scraper-api.p.rapidapi.com';

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

  const url = new URL(`https://${HOST}/api/v1/search/schools`);
  url.searchParams.set('keyword', query);

  const response = await fetch(url, { headers: rapidHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false || data.status === 'ERROR') {
    return Response.json({ ok: false, error: data.message || 'Could not resolve school.' }, { status: 502 });
  }

  const results = Array.isArray(data.data) ? data.data : [];
  const sorted = [...results].sort((first: Record<string, unknown>, second: Record<string, unknown>) => {
    const firstName = String(first.name || '').toLowerCase();
    const secondName = String(second.name || '').toLowerCase();
    const wanted = query.toLowerCase();
    const firstExact = firstName === wanted ? 1 : 0;
    const secondExact = secondName === wanted ? 1 : 0;
    if (firstExact !== secondExact) return secondExact - firstExact;
    return Number(second.membersCount || 0) - Number(first.membersCount || 0);
  });

  return Response.json({
    ok: true,
    items: sorted.map((school: Record<string, unknown>) => ({
      id: String(school.id || ''),
      label: String(school.name || ''),
      subtitle: String(school.location || school.headline || ''),
      type: 'school'
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
