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

  const searchTerms = buildSchoolSearchTerms(query);
  const responses = await Promise.all(searchTerms.map((term) => searchSchools(term)));
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

function buildSchoolSearchTerms(query: string) {
  const terms = [query];
  const cleaned = query.replace(/\s+/g, ' ').trim();
  const normalized = normalizeName(cleaned);
  const lower = cleaned.toLowerCase();

  const knownAliases: Record<string, string[]> = {
    mit: ['Massachusetts Institute of Technology'],
    cmu: ['Carnegie Mellon University'],
    ucla: ['University of California Los Angeles'],
    ucsd: ['University of California San Diego'],
    ucsb: ['University of California Santa Barbara'],
    uci: ['University of California Irvine'],
    ucr: ['University of California Riverside'],
    ucd: ['University of California Davis'],
    ucsc: ['University of California Santa Cruz'],
    ucsf: ['University of California San Francisco'],
    usc: ['University of Southern California'],
    uiuc: ['University of Illinois Urbana Champaign'],
    gatech: ['Georgia Institute of Technology'],
    georgiatech: ['Georgia Institute of Technology'],
    uw: ['University of Washington'],
    nyu: ['New York University']
  };

  terms.push(...(knownAliases[normalized] || []));

  const ucMatch = lower.match(/^uc\s+(.+)$/);
  if (ucMatch?.[1]) {
    terms.push(`University of California ${ucMatch[1]}`);
  }

  const csuMatch = lower.match(/^(?:csu|cal state)\s+(.+)$/);
  if (csuMatch?.[1]) {
    terms.push(`California State University ${csuMatch[1]}`);
  }

  const stateMatch = lower.match(/^(.+)\s+state$/);
  if (stateMatch?.[1]) {
    terms.push(`${titleCase(stateMatch[1])} State University`);
  }

  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))].slice(0, 3);
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
  const queryTokens = tokenize(query);
  const nameTokens = tokenize(name);
  let score = Math.min(Number(school.membersCount || 0) / 1000, 60);

  if (normalizedName === normalizedQuery) score += 140;
  if (normalizedName.includes(normalizedQuery)) score += 45;
  if (queryTokens.length && queryTokens.every((token) => nameTokens.includes(token))) score += 55;
  if (normalizedQuery.length >= 2 && acronym(name) === normalizedQuery) score += 120;
  if (isMainInstitutionName(name)) score += 65;
  if (isSubInstitutionName(name)) score -= 90;

  return score;
}

function isMainInstitutionName(name: string) {
  return /\b(university|institute of technology|college|polytechnic|school of mines)\b/i.test(name)
    && !isSubInstitutionName(name);
}

function isSubInstitutionName(name: string) {
  return /\b(extension|continuing studies|professional studies|college of|school of|department|division|faculty of|graduate school|law school|business school|medical school|school for|center for)\b/i.test(name);
}

function tokenize(value: string): string[] {
  return value.toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) || [];
}

function normalizeName(value: string) {
  return tokenize(value).join('');
}

function acronym(value: string) {
  return tokenize(value)
    .filter((token) => !['of', 'the', 'and', 'at', 'for'].includes(token))
    .map((token) => token[0])
    .join('');
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function rapidHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY || ''
  };
}
