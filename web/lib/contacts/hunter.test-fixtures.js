import assert from "node:assert/strict";
import { linkedinHandle, revealHunterEmail } from "./hunter.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.HUNTER_API_KEY;
const originalMinimumScore = process.env.HUNTER_MIN_SCORE;

process.env.HUNTER_API_KEY = "fixture-key";
process.env.HUNTER_MIN_SCORE = "70";

try {
  assert.equal(linkedinHandle("https://www.linkedin.com/in/alexisohanian/?trk=public"), "alexisohanian");
  assert.equal(linkedinHandle("https://linkedin.com/company/reddit"), "");

  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = new URL(input);
    assert.equal(url.searchParams.get("linkedin_handle"), "fixture-linkedin");
    assert.equal(url.searchParams.has("api_key"), false, "API key must not be placed in the URL");
    assert.equal(init.headers.Authorization, "Bearer fixture-key");
    return jsonResponse({
      data: {
        email: "person@example.com",
        score: 92,
        verification: { status: "valid" }
      }
    });
  };

  const linkedinContact = {
    name: "Fixture Person",
    companyName: "Example",
    linkedinUrl: "https://www.linkedin.com/in/fixture-linkedin/"
  };
  assert.equal(await revealHunterEmail(linkedinContact), "person@example.com");
  assert.equal(await revealHunterEmail(linkedinContact), "person@example.com");
  assert.equal(calls, 1, "successful duplicate reveals should use the in-process cache");

  const fallbackRequests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    fallbackRequests.push(Object.fromEntries(url.searchParams.entries()));
    if (url.searchParams.has("linkedin_handle")) return jsonResponse({ data: {} });
    return jsonResponse({
      data: {
        email: "fallback@example.com",
        score: 85,
        verification: { status: "accept_all" }
      }
    });
  };

  assert.equal(await revealHunterEmail({
    name: "Fallback Person",
    companyDomain: "https://www.example.com/careers",
    linkedinUrl: "https://www.linkedin.com/in/fixture-fallback/"
  }), "fallback@example.com");
  assert.equal(fallbackRequests.length, 2);
  assert.equal(fallbackRequests[1].first_name, "Fallback");
  assert.equal(fallbackRequests[1].last_name, "Person");
  assert.equal(fallbackRequests[1].domain, "example.com");

  globalThis.fetch = async () => jsonResponse({
    data: {
      email: "uncertain@example.com",
      score: 95,
      verification: { status: "unknown" }
    }
  });
  assert.equal(await revealHunterEmail({
    name: "Uncertain Person",
    companyName: "Example Unknown"
  }), "", "explicitly unknown emails should not be returned");

  console.log("hunter fixture checks passed");
} finally {
  globalThis.fetch = originalFetch;
  restoreEnv("HUNTER_API_KEY", originalKey);
  restoreEnv("HUNTER_MIN_SCORE", originalMinimumScore);
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
