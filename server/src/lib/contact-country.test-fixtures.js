import assert from 'node:assert/strict';
import { locationCountries, jobCountries, personMatchesCountries } from './contact-country.js';
import { searchTregContacts } from './treg.js';

for (const [location, expected] of [
  ['San Francisco Bay Area', ['US']], ['San Francisco, CA', ['US']], ['Austin, TX', ['US']],
  ['Boston, Massachusetts', ['US']], ['New York, NY, United States', ['US']],
  ['London, United Kingdom', ['GB']], ['Bangkok, Thailand', ['TH']], ['Bengaluru, India', ['IN']],
  ['Toronto, Ontario, Canada', ['CA']], ['Paris, France', ['FR']], ['Seoul, South Korea', ['KR']],
  ['Berlin, Germany', ['DE']], ['Remote - United States', ['US']], ['Remote', []],
  ['Remote (UK)', ['GB']], ['Remote - US', ['US']], ['Toronto, Ontario', ['CA']],
  ['United States | Canada', ['US', 'CA']], ['US', ['US']], ['UK', ['GB']], ['USA', ['US']],
  ['Georgia', []], ['Unknown city', []], ['北京市, 中国', ['CN']]
]) assert.deepEqual(locationCountries(location), expected, location);
assert.deepEqual(locationCountries({ country: { name: 'India' } }), ['IN']);
assert.deepEqual(jobCountries({ jobLocation: 'Paris, France', school: 'UC Berkeley', searchPreferences: { region: { label: 'United States' } } }), ['FR']);
assert.deepEqual(jobCountries({ jobLocation: 'Remote' }), ['US']);
assert.deepEqual(jobCountries({}), ['US']);
assert.deepEqual(jobCountries({ type: 'company_site', jobLocation: 'Seoul, South Korea' }), ['US'], 'company-page profile region is not a job location');
assert.throws(() => jobCountries({ jobLocation: 'Unknown City' }), error => error.status === 422);
assert.equal(personMatchesCountries({ country: 'India', address: 'United States' }, '', ['US']), false);
assert.equal(personMatchesCountries({ currentCompany: { country: 'US' }, address: 'Thailand' }, '', ['US']), false);
assert.equal(personMatchesCountries({}, '', ['US']), false);

const savedFetch = globalThis.fetch;
const keys = ['TREG_TOKEN', 'TREG_SEARCH_SIZE', 'TREG_SEARCH_MAX_PAGES'];
const savedEnv = Object.fromEntries(keys.map(k => [k, process.env[k]]));
let calls = [];
let queue = [];
const lead = (id, location) => ({ id, name: id, title: 'Software Engineer', lastCompanyName: 'Acme', lastCompanyWebsite: 'acme.com', profileUrl: `https://linkedin.com/in/${id}`, address: location });
try {
  process.env.TREG_TOKEN = 'fixture-only'; process.env.TREG_SEARCH_SIZE = '25'; process.env.TREG_SEARCH_MAX_PAGES = '3';
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    assert.ok(queue.length, 'unexpected extra provider request');
    return new Response(JSON.stringify(queue.shift()), { status: 200 });
  };
  queue = [
    { leads: [lead('india', 'Bengaluru, India'), lead('thailand', 'Bangkok, Thailand'), lead('missing', ''), lead('us', 'Boston, Massachusetts')], pagination: { token: 'next' } },
    { leads: [lead('us2', 'San Francisco, CA'), lead('ca', 'Toronto, Canada')] }
  ];
  const results = await searchTregContacts({ companyName: 'Acme', companyDomain: 'acme.com', jobLocation: 'New York, United States' });
  assert.deepEqual(results.map(p => p.id), ['us', 'us2']);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.query.profileLocation, { include: ['US'] });
    assert.equal(call.query.location, undefined);
    assert.equal(call.query['currentCompany.location'], undefined);
  }
  assert.deepEqual(calls[0].query, calls[1].query, 'never relax country on replenishment');
  calls = [];
  queue = [{ leads: [lead('fr', 'Paris, France'), lead('us', 'Boston, United States')] }];
  const france = await searchTregContacts({ companyName: 'Acme', jobLocation: 'Paris, France' });
  assert.deepEqual(france.map(p => p.id), ['fr']);
  assert.deepEqual(calls[0].query.profileLocation, { include: ['FR'] });
  calls = [];
  await assert.rejects(searchTregContacts({ companyName: 'Acme', jobLocation: 'Unknown City' }), error => error.status === 422);
  assert.equal(calls.length, 0, 'unknown explicit location fails before paid retrieval');
  console.log('Country fixtures passed: job-country detection, US/France hard filters, foreign/unknown rejection, pagination, no resume inference.');
} finally {
  globalThis.fetch = savedFetch;
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
