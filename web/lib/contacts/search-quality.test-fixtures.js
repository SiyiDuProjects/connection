import assert from 'node:assert/strict';
import { rankContacts } from './ranking.js';
import { inferFunction, normalizeCompanyName } from './contact-taxonomy.js';
import { searchTregContacts } from './treg.js';

const person = (title, extra = {}) => ({ name: title, title, companyName: 'Acme', companyDomain: 'acme.com', linkedinUrl: `https://www.linkedin.com/in/${title.replace(/\W/g, '')}`, ...extra });
const roles = ['Software Engineer', 'Data Scientist', 'Product Designer', 'Financial Analyst', 'Marketing Specialist', 'Technical Recruiter'];
for (const role of roles) {
  const results = rankContacts([
    person('Member of Conseil de Surveillance'), person('CEO'), person('Director of Company Partnerships'),
    person(role), person('VP Sales'), person('Technical Recruiter')
  ], { jobTitle: role, companyName: 'Acme', companyDomain: 'acme.com' });
  assert.equal(results[0].title, role, `${role}: relevant colleague should beat unrelated leadership`);
  assert.ok(!results[0].reasons.some(reason => /^(Manager|Director|Head) fit$/.test(reason)));
}
const engineers = rankContacts([
  person('Director of Engineering, Platform'), person('Software Engineer, Platform'), person('Engineering Manager, Platform'), person('CEO')
], { jobTitle: 'Software Engineer, Platform' });
assert.equal(engineers[0].title, 'Software Engineer, Platform');
assert.ok(engineers.findIndex(p => p.title.startsWith('Engineering Manager')) < engineers.findIndex(p => p.title.startsWith('Director')));
const leadership = rankContacts([person('Software Engineer'), person('Director of Engineering')], { jobTitle: 'Director of Engineering' });
assert.equal(leadership[0].title, 'Director of Engineering', 'leadership searches must still work');
assert.equal(inferFunction('Financial Analyst'), 'finance');
assert.equal(inferFunction('Product Designer'), 'design');
assert.equal(inferFunction('Vice President of Engineering'), 'engineering');
assert.equal(inferFunction('Interim Senior Manager, Girls Partnerships'), 'unknown', 'substring "hr" in Partnerships is not HR');
assert.notEqual(normalizeCompanyName('腾讯'), normalizeCompanyName('百度'), 'non-Latin company names must not collapse to empty strings');

const originalFetch = globalThis.fetch;
const envKeys = ['TREG_TOKEN', 'TREG_SEARCH_SIZE', 'TREG_SEARCH_MAX_PAGES', 'TREG_SEARCH_ENDPOINT'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const calls = [];
let queue = [];
const lead = (id, overrides = {}) => ({ id, fullName: `Fixture ${id}`, lastJobTitle: 'Software Engineer', lastCompanyName: 'Acme', lastCompanyWebsite: 'acme.com', address: 'United States', profileUrl: `https://linkedin.com/in/${id}`, ...overrides });
try {
  process.env.TREG_TOKEN = 'fixture-only';
  process.env.TREG_SEARCH_SIZE = '25';
  process.env.TREG_SEARCH_MAX_PAGES = '3';
  process.env.TREG_SEARCH_ENDPOINT = 'icypeas.people.search';
  globalThis.fetch = async (_url, init) => {
    const next = queue.shift();
    assert.ok(next, 'unexpected provider call');
    calls.push({ body: JSON.parse(init.body), key: init.headers['Idempotency-Key'] });
    return new Response(JSON.stringify(next.body), { status: next.status || 200, headers: { 'X-Treg-Cost-Micro': '100', 'Content-Type': 'application/json' } });
  };
  const job = { companyName: 'Acme', companyDomain: 'acme.com', jobTitle: 'Software Engineer' };
  queue = [{ body: { leads: [
    lead('alias', { lastCompanyName: 'Acme Research Division' }),
    lead('conflict', { lastCompanyWebsite: 'another-company.com' }),
    lead('missing-domain', { lastCompanyWebsite: '' }),
    lead('former', { lastCompanyName: '', lastCompanyWebsite: '', experience: [{ title: 'Software Engineer', company: { name: 'Acme', domain: 'acme.com' }, current: false }] }),
    lead('unrelated', { lastCompanyName: 'Other Co', lastCompanyWebsite: '' })
  ], pagination: { token: 'page-two' } } }, { body: { leads: [lead('alias'), ...Array.from({ length: 10 }, (_, i) => lead(`more-${i}`))], pagination: { token: 'page-three' } } }];
  const request = { idempotencyKey: 'quality-fixture' };
  const result = await searchTregContacts(job, request);
  assert.equal(result.length, 12, 'two eligible on first page should be replenished and duplicates removed');
  assert.equal(rankContacts(result, job).slice(0, 10).length, 10);
  assert.ok(result.some(p => p.id === 'alias'), 'matching provider domain should admit company-name variations');
  assert.equal(result.find(p => p.id === 'missing-domain').companyDomain, '', 'do not invent provider evidence');
  assert.ok(!result.some(p => ['former', 'conflict', 'unrelated'].includes(p.id)));
  assert.equal(calls.length, 2, 'stop replenishment once 10 eligible people are available');
  assert.deepEqual(calls[0].body.query, calls[1].body.query, 'pagination preserves company-only query');
  assert.equal(calls[1].body.pagination.token, 'page-two');
  assert.notEqual(calls[0].key, calls[1].key, 'different pages need different idempotency keys');
  assert.equal(request.internalCost.costMicroUsd, 200, 'account for every successful page');
  assert.equal(request.internalCost.calls, 2);

  calls.length = 0;
  queue = [{ body: { leads: Array.from({ length: 12 }, (_, i) => lead(`unrelated-${i}`, { lastJobTitle: 'Director of Company Partnerships' })), pagination: { token: 'relevant-next' } } },
    { body: { leads: [lead('peer'), lead('peer-2'), lead('recruiter', { lastJobTitle: 'Technical Recruiter' })] } }];
  const betterPool = await searchTregContacts(job);
  assert.equal(calls.length, 2, 'a large but unrelated first page should not suppress replenishment');
  assert.ok(['peer', 'peer-2'].includes(rankContacts(betterPool, job)[0].id));

  queue = [{ body: { leads: [lead('canonical'), lead('canonical-duplicate', { profileUrl: 'https://www.linkedin.com/in/canonical/?trk=sample' })] } }];
  assert.equal((await searchTregContacts(job)).length, 1, 'URL tracking and trailing slash variants identify the same person');

  calls.length = 0;
  queue = [{ body: { leads: [lead('one')], pagination: { token: 'same' } } }, { body: { leads: [lead('one')], pagination: { token: 'same' } } }];
  assert.equal((await searchTregContacts(job)).length, 1);
  assert.equal(calls.length, 2, 'repeating cursors must terminate');

  calls.length = 0;
  queue = Array.from({ length: 3 }, (_, i) => ({ body: { leads: [lead(`bound-${i}`)], pagination: { token: `token-${i}` } } }));
  assert.equal((await searchTregContacts(job)).length, 3);
  assert.equal(calls.length, 3, 'enforce bounded retrieval even with more available pages');

  queue = [{ body: { leads: [lead('survivor')], pagination: { token: 'failure' } } }, { status: 503, body: { error: 'fixture provider unavailable' } }];
  const partialRequest = {};
  assert.equal((await searchTregContacts(job, partialRequest))[0].id, 'survivor');
  assert.equal(partialRequest.internalCost.costMicroUsd, 100);

  queue = [{ body: { leads: [lead('only-one')] } }];
  assert.equal((await searchTregContacts(job)).length, 1, 'never pad scarce results with fabricated contacts');
  process.env.TREG_SEARCH_MAX_PAGES = '1';
  queue = [{ body: { leads: [lead('single-page')], pagination: { token: 'unused' } } }];
  assert.equal((await searchTregContacts(job)).length, 1, 'operator can retain single-page cost ceiling');
  assert.equal(queue.length, 0);
  console.log('Search quality fixtures passed: six role families, leadership, company evidence, 2-to-10 replenishment, deduplication, budgets, partial failure and cost accounting.');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
