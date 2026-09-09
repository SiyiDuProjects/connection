import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { after, beforeEach, test } from 'node:test';
import { createSpendBudget, dailyBudgetMicroUsd, runBudgetedOperation } from './spend-budget.js';

const pg = new PGlite();
await pg.exec(readFileSync(new URL('../../../web/lib/db/migrations/0016_provider_spend_budget.sql', import.meta.url),'utf8'));
function tagged(client) {
  const query = (strings,...values) => client.query(strings.reduce((text,part,index)=>text+(index ? `$${index}` : '')+part,''),values).then(result=>result.rows);
  query.begin = fn => pg.transaction(tx=>fn(tagged(tx)));
  return query;
}
const first=createSpendBudget(tagged(pg));
const second=createSpendBudget(tagged(pg));
const reserve=(store=first, maximumMicroUsd=500_000, limitMicroUsd=1_000_000)=>store.reserve({provider:'fixture',action:'search',customerId:7,maximumMicroUsd,limitMicroUsd});
const day=async()=> (await pg.query('select * from provider_budget_days')).rows[0];
beforeEach(async()=>{ await pg.exec('truncate provider_spend_reservations,provider_budget_days'); });
after(async()=>{ await pg.close(); });

test('concurrent admissions across store instances cannot overspend the same daily budget',async()=>{
  const results=await Promise.allSettled(Array.from({length:12},(_,i)=>reserve(i%2 ? first : second)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,2);
  for(const rejected of results.filter(x=>x.status==='rejected')) assert.equal(rejected.reason.budgetGuard,true);
  assert.equal(Number((await day()).reserved_micro_usd),1_000_000);
});

test('settlement releases only the unused hold and is idempotent under concurrent retries',async()=>{
  const hold=await reserve();
  await Promise.all([first.settle(hold.id,200_000),second.settle(hold.id,200_000)]);
  assert.equal(Number((await day()).spent_micro_usd),200_000);
  assert.equal(Number((await day()).reserved_micro_usd),0);
  await reserve(second,800_000);
  await assert.rejects(()=>reserve(first,1),e=>e.budgetGuard===true);
});

test('unknown, missing, negative and fractional receipts retain the full reservation',async()=>{
  const hold=await reserve(first,1_000_000);
  for(const cost of [null,undefined,NaN,-1,0.5]) await first.settle(hold.id,cost);
  assert.equal(Number((await day()).reserved_micro_usd),1_000_000);
  await assert.rejects(()=>reserve(second,1),e=>e.budgetGuard===true);
});

test('a new process sees holds left by a crash and cannot reset the daily spend',async()=>{
  await reserve(first,1_000_000);
  const restarted=createSpendBudget(tagged(pg));
  await assert.rejects(()=>reserve(restarted,1),e=>e.budgetGuard===true);
});

test('confirmed free provider replay returns its hold without adding spend',async()=>{
  const hold=await reserve(); await first.settle(hold.id,0);
  assert.equal(Number((await day()).spent_micro_usd),0);
  assert.equal(Number((await day()).reserved_micro_usd),0);
  await reserve(first,1_000_000);
});

test('an unexpected provider overcharge is recorded and blocks further admissions',async()=>{
  const hold=await reserve(first,100_000);
  assert.equal((await first.settle(hold.id,100_001)).breached,true);
  assert.equal(Number((await day()).spent_micro_usd),100_001);
  await assert.rejects(()=>reserve(second,1),e=>e.budgetGuard===true);
});

test('previous UTC days do not consume a new day allowance',async()=>{
  await pg.query("insert into provider_budget_days (day,limit_micro_usd,spent_micro_usd) values (current_date-1,1000000,1000000)");
  await reserve(first,1_000_000);
  const rows=(await pg.query('select * from provider_budget_days order by day')).rows;
  assert.equal(rows.length,2); assert.equal(Number(rows[1].reserved_micro_usd),1_000_000);
});

test('an older replica cannot raise the cap established by another replica',async()=>{
  await reserve(first,100_000,200_000);
  await assert.rejects(()=>reserve(second,200_000,1_000_000),e=>e.budgetGuard===true);
});

test('invalid budget configuration and arithmetic inputs fail closed',async()=>{
  const old=process.env.PROVIDER_DAILY_BUDGET_USD;
  try {
    for(const value of ['0','-10','NaN','Infinity','0.00000001']) { process.env.PROVIDER_DAILY_BUDGET_USD=value; assert.throws(()=>dailyBudgetMicroUsd()); }
    process.env.PROVIDER_DAILY_BUDGET_USD='10'; assert.equal(dailyBudgetMicroUsd(),10_000_000);
  } finally { if(old===undefined) delete process.env.PROVIDER_DAILY_BUDGET_USD; else process.env.PROVIDER_DAILY_BUDGET_USD=old; }
  for(const value of [0,-1,0.5,Number.MAX_SAFE_INTEGER+1]) await assert.rejects(()=>reserve(first,value));
});

const details = {provider:'fixture',action:'reveal',maximumMicroUsd:500_000,limitMicroUsd:1_000_000};
test('budget exhaustion and database failure never invoke the provider',async()=>{
  await reserve(first,1_000_000);
  let calls=0;
  const operation=async()=>{calls++;return {value:'result',costMicroUsd:1};};
  await assert.rejects(()=>runBudgetedOperation(first,details,operation));
  await assert.rejects(()=>runBudgetedOperation({reserve:async()=>{throw new Error('database unavailable');}},details,operation));
  assert.equal(calls,0);
});

test('transport failure and a missing receipt keep their full durable holds',async()=>{
  await assert.rejects(()=>runBudgetedOperation(first,details,async()=>{throw new Error('timeout');}));
  assert.equal(await runBudgetedOperation(second,details,async()=>({value:'result'})),'result');
  assert.equal(Number((await day()).reserved_micro_usd),1_000_000);
  await assert.rejects(()=>reserve(first,1));
});

test('failed settlement returns the completed result while preserving its hold',async()=>{
  const failing={reserve:first.reserve,settle:async()=>{throw new Error('database disconnected');}};
  assert.equal(await runBudgetedOperation(failing,details,async()=>({value:'result',costMicroUsd:100})),'result');
  assert.equal(Number((await day()).reserved_micro_usd),500_000);
});
