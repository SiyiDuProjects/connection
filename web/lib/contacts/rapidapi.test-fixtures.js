import assert from "node:assert/strict";
import { extractLinkedInJobId, resolveCompanyId } from "./rapidapi.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.RAPIDAPI_KEY;

process.env.RAPIDAPI_KEY = "fixture-key";

try {
  assert.equal(
    extractLinkedInJobId("https://www.linkedin.com/jobs/view/software-engineer-at-example-4431400939"),
    "4431400939"
  );
  assert.equal(
    extractLinkedInJobId("https://www.linkedin.com/jobs/search/?currentJobId=4431400939"),
    "4431400939"
  );
  assert.equal(extractLinkedInJobId("https://jobs.example.com/4431400939"), "");

  const linkedInCalls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    linkedInCalls.push(url);
    return jsonResponse({ data: { company: { id: "reddit-fixture-id" } } });
  };

  assert.equal(await resolveCompanyId({
    companyName: "Reddit, Inc.",
    companyDomain: "reddit-fixture.example",
    sourceUrl: "https://www.linkedin.com/jobs/view/example-4431400939"
  }), "reddit-fixture-id");
  assert.equal(linkedInCalls.length, 1);
  assert.equal(linkedInCalls[0].pathname, "/api/v1/job/detail");
  assert.equal(linkedInCalls[0].searchParams.get("job_id"), "4431400939");

  const profileCalls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    profileCalls.push(url);
    if (url.searchParams.get("company") === "Acme Fixture") {
      return jsonResponse({ success: true, data: { id: "acme-fixture-id" } });
    }
    return jsonResponse({ success: false, message: "Company not found" });
  };

  assert.equal(await resolveCompanyId({
    companyName: "Acme Fixture LLC",
    companyDomain: "acme-fixture.example",
    sourceUrl: "https://jobs.example.com/acme"
  }), "acme-fixture-id");
  assert.deepEqual(profileCalls.map((url) => url.searchParams.get("company")), ["Acme Fixture"]);

  const jobSearchCalls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    jobSearchCalls.push(url);
    if (url.pathname === "/api/v1/job/search") {
      return jsonResponse({
        success: true,
        data: [
          { company: { id: "wrong-id", name: "Different Fixture" } },
          { company: { id: "instead-fixture-id", name: "Instead Fixture, Inc." } }
        ]
      });
    }
    return jsonResponse({ success: false, message: "Company not found" });
  };

  assert.equal(await resolveCompanyId({
    companyName: "Instead Fixture",
    companyDomain: "instead-fixture.example",
    originalJobTitle: "Software Engineer",
    sourceUrl: "https://job-boards.greenhouse.io/instead-fixture/jobs/1"
  }), "instead-fixture-id");
  assert.equal(jobSearchCalls.at(-1).pathname, "/api/v1/job/search");
  assert.match(jobSearchCalls.at(-1).searchParams.get("keyword"), /Instead Fixture Software Engineer/);

  console.log("rapidapi fixture checks passed");
} finally {
  globalThis.fetch = originalFetch;
  restoreEnv("RAPIDAPI_KEY", originalKey);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
