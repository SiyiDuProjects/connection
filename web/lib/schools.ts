import universities from './data/universities.json';

export type SchoolOption = { id: string; label: string; country: string; domain: string };
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const schools: SchoolOption[] = Array.from(new Map(universities.map(row => {
  const domain = row.domains[0] || '';
  const id = `${domain}:${row.name}`;
  return [id, { id, label: row.name, country: row.country, domain }];
})).values());

// Bundled MIT-licensed Hipo directory. Searching never calls a paid provider.
export function searchSchools(query: string): SchoolOption[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ');
  return schools.filter(row => {
    const haystack = normalize(`${row.label} ${row.domain}`);
    return tokens.every(token => haystack.includes(token));
  }).sort((a, b) => Number(normalize(b.label).startsWith(q)) - Number(normalize(a.label).startsWith(q)) || a.label.localeCompare(b.label)).slice(0, 20);
}

export function schoolById(id: string) { return schools.find(row => row.id === id); }
