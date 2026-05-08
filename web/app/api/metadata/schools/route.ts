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

  const searches = schoolSearchTerms(query);
  const responses = await Promise.all(searches.map((term) => searchSchools(term)));
  const failed = responses.find((result) => result.error);
  if (failed?.error) {
    return Response.json({ ok: false, error: failed.error }, { status: 502 });
  }

  const sorted = dedupeSchools(responses.flatMap((result) => result.results))
    .sort((first, second) => scoreSchool(second, query) - scoreSchool(first, query))
    .slice(0, 8);

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

async function searchSchools(query: string) {
  const url = new URL(`https://${HOST}/api/search/schools`);
  url.searchParams.set('keywords', query);
  url.searchParams.set('limit', '8');

  const response = await fetch(url, { headers: rapidHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === 'ERROR') {
    return {
      results: [],
      error: data.message || 'Could not resolve school.'
    };
  }

  return {
    results: Array.isArray(data.data?.data) ? data.data.data : [],
    error: ''
  };
}

function schoolSearchTerms(query: string) {
  const terms = [query];
  const normalized = normalizeName(query);
  if (['ucberkeley', 'ucb', 'berkeley', 'universityofcaliforniaberkeley'].includes(normalized)) {
    terms.push('University of California Berkeley');
  }
  return [...new Set(terms)];
}

function dedupeSchools(results: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const schools: Record<string, unknown>[] = [];
  for (const school of results) {
    const key = String(school.id || school.entityUrn || school.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    schools.push(school);
  }
  return schools;
}

function scoreSchool(school: Record<string, unknown>, query: string) {
  const name = String(school.name || '');
  const normalizedName = normalizeName(name);
  const normalizedQuery = normalizeName(query);
  let score = Math.min(Number(school.membersCount || 0) / 1000, 50);

  if (normalizedName === normalizedQuery) score += 120;
  if (normalizedName.includes(normalizedQuery)) score += 30;

  const broadBerkeleyQuery = ['ucberkeley', 'ucb', 'berkeley', 'universityofcaliforniaberkeley'].includes(normalizedQuery);
  if (broadBerkeleyQuery) {
    if (normalizedName === 'universityofcaliforniaberkeley') score += 240;
    if (/\b(extension|college|school|division|department|rausser|letters|engineering|public health|information)\b/i.test(name)) {
      score -= 80;
    }
  }

  return score;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

function rapidHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY || ''
  };
}
