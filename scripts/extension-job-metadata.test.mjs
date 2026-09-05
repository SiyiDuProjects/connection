import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual reader with publisher metadata and page-text boundaries.
const source = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('  function readJobMetadata()'), source.indexOf('  function linkedInAdapter()'));
let posting = null, pageSalary = '';
const { readJobMetadata, formatJobSalary } = vm.runInNewContext(`${helpers}\n({readJobMetadata, formatJobSalary})`, {
  structuredJobPosting: () => posting, textFrom: () => pageSalary, Intl, Date
});
assert.equal(formatJobSalary({currency:'USD',value:{minValue:130000,maxValue:200000,unitText:'YEAR'}}), 'USD 130,000–200,000 / year');
assert.equal(formatJobSalary({currency:'CAD',value:{value:42.5,unitText:'HOUR'}}), 'CAD 42.5 / hour');
assert.equal(formatJobSalary({currency:'EUR',value:{minValue:80000,unitText:'YEAR'}}), 'EUR From 80,000 / year');
assert.equal(formatJobSalary({currency:'USD',value:{minValue:200000,maxValue:100000}}), '');
assert.equal(formatJobSalary({value:{minValue:100000,maxValue:200000}}), '', 'do not infer a currency');
assert.equal(formatJobSalary({currency:'USD',value:{minValue:null,maxValue:''}}), '');
assert.equal(readJobMetadata().jobSalary, '');
assert.equal(readJobMetadata().jobDatePosted, '');
pageSalary = '$130,000 - $200,000 USD / year';
assert.equal(readJobMetadata().jobSalary, pageSalary);
pageSalary = 'Competitive compensation and equity';
assert.equal(readJobMetadata().jobSalary, '', 'no fabricated salary from vague copy');
posting = {datePosted:'2025-03-10T23:30:00-07:00'};
assert.equal(readJobMetadata().jobDatePosted, '2025-03-10T00:00:00.000Z', 'preserve the publisher calendar date');
for (const datePosted of ['not a date', '2025-02-31', '2099-01-01']) {
  posting = {datePosted};
  assert.equal(readJobMetadata().jobDatePosted, '', 'reject invalid or future publication dates');
}
assert.equal('confirmedLive' in readJobMetadata(), false);
console.log('Job metadata: salary ranges, currencies, hourly rates, missing data, source dates and invalid dates passed.');
