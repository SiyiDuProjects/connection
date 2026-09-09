// Resolve countries from location evidence, never from nationality, school or names.
const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const names = new Map();
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[().]/g, '').replace(/\s+/g, ' ').trim();
for (const locale of ['en', 'zh']) {
  const display = new Intl.DisplayNames([locale], { type: 'region' });
  for (const code of codes) names.set(normalize(display.of(code)), code);
}
for (const [name, code] of Object.entries({ usa:'US', 'u s a':'US', 'united states of america':'US', america:'US', uk:'GB', 'u k':'GB', 'great britain':'GB', england:'GB', scotland:'GB', wales:'GB', 'northern ireland':'GB', korea:'KR', 'republic of korea':'KR', 'south korea':'KR', 'viet nam':'VN', 'russian federation':'RU', 'united arab emirates':'AE' })) names.set(name, code);
// Georgia alone can be a country or a US state. Require stronger context.
names.delete('georgia');
const usStates = new Set('alabama alaska arizona arkansas california colorado connecticut delaware florida hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming'.split(' '));
const usMultiStates = ['new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'rhode island', 'south carolina', 'south dakota', 'west virginia', 'district of columbia'];
const usStateCodes = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
const usMetros = /\b(san francisco|san jose|san diego|los angeles|new york city|seattle|boston|chicago|austin|dallas|houston|washington dc|san francisco bay area|silicon valley)\b/i;

export function locationCountries(value) {
  if (Array.isArray(value)) return [...new Set(value.flatMap(locationCountries))];
  if (value && typeof value === 'object') {
    const direct = value.countryCode || value.country_code || value.addressCountry || value.country;
    if (direct) return locationCountries(typeof direct === 'object' ? direct.name || direct.code : direct);
    return locationCountries([value.fullName, value.full_name, value.name, [value.city, value.state || value.region].filter(Boolean).join(', ')].filter(Boolean).join(', '));
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (/[|;]/.test(raw)) return [...new Set(raw.split(/[|;]/).flatMap(locationCountries))];
  const parts = raw.split(/[|;,/]/).map(part => part.trim()).filter(Boolean);
  // Prefer explicit full country names over city/state heuristics.
  const full = new Set();
  for (const [name, code] of names) {
    const text = normalize(raw);
    if (name.length > 3 && (` ${text} `).includes(` ${name} `)) full.add(code);
    if (parts.some(part => normalize(part) === name)) full.add(code);
  }
  if (full.size) return [...full];
  const short = raw.match(/\b(?:US|USA|UK|GB|UAE)\b/g);
  if (short) return [...new Set(short.map(code => ({ USA: 'US', UK: 'GB', UAE: 'AE' })[code] || code))];
  const text = normalize(raw);
  if (parts.some(part => /^(ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland and labrador|prince edward island)$/i.test(part))) return ['CA'];
  const states = parts.some(part => usStates.has(normalize(part))) || usMultiStates.some(state => text.includes(state));
  const last = parts.at(-1)?.replace(/\s+\d{5}(?:-\d{4})?$/, '');
  if (states || (usMetros.test(raw) && (!last || !codes.includes(last) || usStateCodes.has(last)))) return ['US'];
  if (parts.length > 1 && usStateCodes.has(last) && !codes.includes(last)) return ['US'];
  // Short codes are accepted only as complete, uppercase location segments.
  const explicitCodes = parts.filter(part => codes.includes(part));
  return [...new Set(explicitCodes)];
}

export function jobCountries(job = {}) {
  const companyPage = ['linkedin_company', 'company_site'].includes(job.type);
  // Older API contexts copy the profile region into company-page jobLocation.
  // That is not a job-country source.
  const location = companyPage ? '' : String(job.jobLocation || '').trim();
  const countries = companyPage ? [] : locationCountries(job.jobCountry || location);
  if (countries.length) return countries;
  // The agreed fallback covers company pages and genuinely unspecified remote roles.
  if (!location || /^(remote|worldwide|global|anywhere|remote worldwide)(\s*\(.*\))?$/i.test(location)) return ['US'];
  const error = new Error('Job country could not be determined from its location.');
  error.status = 422;
  error.publicMessage = 'Could not identify the job country. Open a job page with a country or full location and try again.';
  throw error;
}

export function personMatchesCountries(person, normalizedLocation, allowed) {
  const evidence = [person.countryCode, person.country_code, person.country, person.location, person.profileLocation, person.profile_location, person.address, person.city_region_country, normalizedLocation].filter(Boolean);
  const found = [...new Set(evidence.flatMap(locationCountries))];
  // Unknown or conflicting evidence is not enough for a hard country match.
  return found.length > 0 && found.every(code => allowed.includes(code));
}
