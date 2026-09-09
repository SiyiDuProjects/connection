import assert from "node:assert/strict";

import { revealTregEmail, searchTregContacts } from "./treg.js";

const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(
  [
    "TREG_TOKEN",
    "TREG_BASE_URL",
    "TREG_SEARCH_ENDPOINT",
    "TREG_SEARCH_SIZE",
    "TREG_EMAIL_ENDPOINT", "PROVIDER_DAILY_BUDGET_USD"
  ].map((key) => [key, process.env[key]])
);

const calls = [];
let responseQueue = [];

try {
  delete process.env.PROVIDER_DAILY_BUDGET_USD;
  process.env.TREG_TOKEN = "fixture-token-never-send";
  process.env.TREG_BASE_URL = "https://treg.to";
  process.env.TREG_SEARCH_SIZE = "12";

  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init, body: JSON.parse(init.body || "{}") });
    const next = responseQueue.shift();
    assert.ok(next, "fixture response queue should not be empty");
    return new Response(JSON.stringify(next.body), {
      status: next.status || 200,
      headers: {
        "Content-Type": "application/json",
        "X-Treg-Call-Id": next.callId || "fixture-call",
        ...(next.headers || {})
      }
    });
  };

  responseQueue.push({
    body: {
      leads: [{
        id: "person_fixture_1",
        firstname: "Alex",
        lastname: "Example",
        photo_url: "https://media.licdn.com/dms/image/fixture/photo.jpg",
        lastJobTitle: "Technical Recruiter",
        lastCompanyName: "Example Labs",
        lastCompanyWebsite: "https://www.example.com/about",
        address: "San Francisco Bay Area",
        education: [{ schoolName: "UC Berkeley" }],
        profileUrl: "https://linkedin.com/in/alex-example?trk=fixture"
      }, {
        id: "person_fixture_2",
        firstname: "Casey",
        lastname: "Colleague",
        lastJobTitle: "Finance Associate",
        lastCompanyName: "Example Labs",
        lastCompanyWebsite: "https://www.example.com/about",
        address: "Toronto, Ontario",
        profileUrl: "https://linkedin.com/in/casey-colleague"
      }, {
        id: "person_fixture_3",
        firstname: "Unknown",
        lastname: "Employer",
        lastJobTitle: "Recruiter",
        profileUrl: "https://linkedin.com/in/unknown-employer"
      }],
      pagination: { total: 3 }
    }
  });

  const contacts = await searchTregContacts({
    companyName: "Example Labs",
    companyDomain: "example.com",
    jobTitle: "Software Engineer",
    originalJobTitle: "Software Engineer",
    jobLocation: "San Francisco Bay Area",
    searchPreferences: { school: { label: "UC Berkeley" } }
  }, {
    customerId: "user_fixture_42",
    idempotencyKey: "request-fixture-search"
  });

  assert.equal(contacts.length, 1, "only current-company colleagues in the job country remain eligible");
  assert.equal(contacts.some((contact) => contact.name === "Unknown Employer"), false, "missing current company must not be inferred from the search target");
  assert.deepEqual(contacts[0], {
    id: "person_fixture_1",
    provider: "treg",
    providerId: "person_fixture_1",
    name: "Alex Example",
    photoUrl: "https://media.licdn.com/dms/image/fixture/photo.jpg",
    title: "Technical Recruiter",
    companyName: "Example Labs",
    companyDomain: "example.com",
    location: "San Francisco Bay Area",
    education: "UC Berkeley",
    linkedinUrl: "https://www.linkedin.com/in/alex-example",
    email: "",
    emailStatus: "",
    metadata: {
      companySearchRestricted: true,
      alumniMatched: true
    }
  });
  assert.equal(contacts.some(contact => contact.name === "Casey Colleague"), false, "Canadian contact is excluded for a US job");

  const searchCall = calls[0];
  assert.equal(searchCall.url, "https://treg.to/call/icypeas.people.search");
  assert.equal(searchCall.init.headers["X-Treg-Token"], "fixture-token-never-send");
  assert.equal(searchCall.init.headers.Authorization, undefined);
  assert.match(searchCall.init.headers["Idempotency-Key"], /^treg-search-[a-f0-9]{32}$/);
  assert.equal(searchCall.init.headers["X-Treg-Meta"], "customer=user_fixture_42,action=search");
  assert.equal(searchCall.body.pagination.size, 12);
  assert.deepEqual(searchCall.body.query.currentCompanyName, { include: ["Example Labs"] });
  assert.equal(searchCall.body.query.currentCompanyWebsite, undefined);
  assert.equal(searchCall.body.query.school, undefined, "school is a ranking signal, not a provider filter");
  assert.equal(searchCall.body.query.currentJobTitle, undefined, "title is a ranking signal, not a provider filter");
  assert.equal(searchCall.body.query.location, undefined, "workplace-or-profile location must not replace profile country");
  assert.deepEqual(searchCall.body.query.profileLocation, { include: ['US'] });
  assert.equal(JSON.stringify(searchCall.body).includes(process.env.TREG_TOKEN), false);

  responseQueue.push({
    body: {
      person: {
        email: "alex@example.com",
        email_status: "verified"
      }
    },
    headers: {
      "X-Treg-Served-By": "apollo.people.enrich",
      "X-Treg-Cost-Micro": "26000"
    }
  });

  const revealRequest = {
    customerId: "user_fixture_42",
    idempotencyKey: "request-fixture-reveal"
  };
  const email = await revealTregEmail(contacts[0], revealRequest);
  assert.equal(email, "alex@example.com");

  const revealCall = calls[1];
  const revealUrl = new URL(revealCall.url);
  assert.equal(`${revealUrl.origin}${revealUrl.pathname}`, "https://treg.to/call/apollo.people.enrich");
  assert.equal(revealUrl.searchParams.get("linkedin_url"), "https://www.linkedin.com/in/alex-example");
  assert.equal(revealUrl.searchParams.get("reveal_personal_emails"), "false");
  assert.equal(revealUrl.searchParams.get("reveal_phone_number"), "false");
  assert.equal(revealUrl.searchParams.get("run_waterfall_email"), "false");
  assert.equal(revealUrl.searchParams.get("run_waterfall_phone"), "false");
  assert.deepEqual(revealCall.body, {});
  assert.equal(revealCall.init.headers["X-Treg-Route-Max-Cost"], '0.05');
  assert.equal(revealCall.init.headers["X-Treg-Meta"], "customer=user_fixture_42,action=reveal");
  assert.equal(revealRequest.internalCost.provider, "apollo.people.enrich");
  assert.equal(revealRequest.internalCost.costMicroUsd, 26000);
  assert.equal(revealRequest.internalCost.billing, "actual");

  const cachedEmail = await revealTregEmail(contacts[0], {
    customerId: "user_fixture_42",
    idempotencyKey: "a-new-request-key"
  });
  assert.equal(cachedEmail, "alex@example.com");
  assert.equal(calls.length, 2, "successful reveals should be cached");

  responseQueue.push({ body: { person: { email: null, email_status: "unavailable" } }, headers: { "X-Treg-Cost-Micro": "26000" } });
  const missRequest = {
    customerId: "user_fixture_99",
    idempotencyKey: "request-fixture-miss"
  };
  const miss = await revealTregEmail({ name: "Jamie Fixture", companyDomain: "fixture.test" }, missRequest);
  assert.equal(miss, "");
  const missUrl = new URL(calls[2].url);
  assert.equal(missUrl.searchParams.get("name"), "Jamie Fixture");
  assert.equal(missUrl.searchParams.get("domain"), "fixture.test");
  assert.equal(missRequest.internalCost.costMicroUsd, 26000, "Apollo can charge even when no verified email is returned");

  responseQueue.push({body:{person:{email:'replay@example.com',email_status:'verified'}},headers:{'X-Treg-Cost-Micro':'26000','X-Treg-Idempotent-Replay':'true'}});
  const replayRequest={};
  await revealTregEmail({name:'Replay Fixture',companyDomain:'fixture.test'},replayRequest);
  assert.equal(replayRequest.internalCost.costMicroUsd,0,'replay original cost is not an incremental charge');
  responseQueue.push({body:{person:{email:null}}});
  const unknownRequest={};
  await revealTregEmail({name:'Unknown Fixture',companyDomain:'fixture.test'},unknownRequest);
  assert.equal(unknownRequest.internalCost.billing,'unknown');
  assert.equal(unknownRequest.internalCost.costMicroUsd,undefined);
  const count=calls.length;
  process.env.PROVIDER_DAILY_BUDGET_USD='10';
  process.env.TREG_EMAIL_ENDPOINT='unknown.unpriced.endpoint';
  await assert.rejects(()=>revealTregEmail({name:'Blocked Fixture',companyDomain:'fixture.test'},{}));
  assert.equal(calls.length,count,'unpriced endpoints must not call upstream');
  console.log("Treg fixture tests passed.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
