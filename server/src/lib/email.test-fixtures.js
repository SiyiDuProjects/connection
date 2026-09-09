import assert from "node:assert/strict";

import { createDraft, getDraftInternalCost } from "./email.js";

const originalFetch = globalThis.fetch;
const envNames = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "OPENAI_INPUT_USD_PER_MILLION",
  "OPENAI_CACHED_INPUT_USD_PER_MILLION",
  "OPENAI_OUTPUT_USD_PER_MILLION", "PROVIDER_DAILY_BUDGET_USD"
];
const originalEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));

try {
  delete process.env.PROVIDER_DAILY_BUDGET_USD;
  process.env.OPENAI_API_KEY = "fixture-key-never-send";
  process.env.OPENAI_BASE_URL = "https://api.openai.com";
  process.env.OPENAI_MODEL = "gpt-5.6-luna";
  process.env.OPENAI_INPUT_USD_PER_MILLION = "0.20";
  process.env.OPENAI_CACHED_INPUT_USD_PER_MILLION = "0.02";
  process.env.OPENAI_OUTPUT_USD_PER_MILLION = "1.20";

  let request;
  globalThis.fetch = async (input, init = {}) => {
    request = { url: String(input), init, body: JSON.parse(init.body || "{}") };
    return new Response(JSON.stringify({
      id: "resp_fixture_123",
      output_text: JSON.stringify({
        subject: "A quick question about Example Labs",
        body: "Hi Alex,\n\nI am exploring software engineering opportunities at Example Labs and would appreciate your advice.\n\nThanks,\nJamie",
        personalizationNotes: ["Used the selected contact's role."],
        missingContext: [],
        warnings: []
      }),
      usage: {
        input_tokens: 1000,
        input_tokens_details: { cached_tokens: 200 },
        output_tokens: 300,
        total_tokens: 1300
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const draft = await createDraft({
    name: "Alex Example",
    email: "alex@example.com",
    title: "Software Engineer",
    companyName: "Example Labs"
  }, {
    type: "company_site",
    companyName: "Example Labs",
    jobTitle: "Software Engineer"
  }, {
    senderName: "Jamie Fixture",
    senderProfile: "Software engineering student",
    resumeContext: "Built a distributed systems capstone.",
    emailSignature: "Jamie",
    emailTone: "confident",
    outreachLength: "short",
    outreachGoal: "intro",
    outreachStyleNotes: "Lead with the capstone and avoid buzzwords."
  });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.body.model, "gpt-5.6-luna");
  assert.equal(request.body.store, false);
  assert.equal(request.body.max_output_tokens, 4096);
  const aiInput = JSON.parse(request.body.input);
  assert.equal(aiInput.sender.resumeContext, "Built a distributed systems capstone.");
  assert.equal(aiInput.sender.emailSignature, "Jamie");
  assert.equal(aiInput.sender.emailTone, "confident");
  assert.equal(aiInput.sender.outreachLength, "short");
  assert.equal(aiInput.sender.outreachGoal, "intro");
  assert.equal(aiInput.sender.outreachStyleNotes, "Lead with the capstone and avoid buzzwords.");
  assert.match(request.body.instructions, /70-100 words for short/);
  assert.equal(draft.ai.used, true);
  const internalCost = getDraftInternalCost(draft);
  assert.deepEqual(internalCost, {
    source: "openai",
    provider: "openai",
    model: "gpt-5.6-luna",
    billing: "estimated",
    costMicroUsd: 524,
    inputTokens: 1000,
    cachedInputTokens: 200,
    outputTokens: 300,
    totalTokens: 1300,
    responseId: "resp_fixture_123"
  });
  assert.equal(JSON.stringify(draft).includes("internalCost"), false);
  assert.equal(JSON.stringify(draft).includes("costMicroUsd"), false);

  let extraCalls=0;
  globalThis.fetch=async()=>{extraCalls++;return new Response(JSON.stringify({output_text:JSON.stringify({subject:'Fixture',body:'Fixture'})}));};
  const unknown=await createDraft({name:'Fixture'},{companyName:'Fixture'});
  assert.equal(getDraftInternalCost(unknown).costMicroUsd,null,'missing usage is unknown, not free');
  assert.equal(extraCalls,1);
  const oversized=await createDraft({name:'Fixture'},{companyName:'Fixture'},{senderProfile:'a'.repeat(100_000)});
  assert.equal(oversized.ai.used,false);
  assert.equal(extraCalls,1,'oversized contexts must not reach OpenAI');
  process.env.PROVIDER_DAILY_BUDGET_USD='10';
  process.env.OPENAI_INPUT_USD_PER_MILLION='0.01';
  const underpriced=await createDraft({name:'Fixture'},{companyName:'Fixture'});
  assert.equal(underpriced.ai.used,false);
  assert.equal(extraCalls,1,'underpriced configuration must fail before OpenAI');
  console.log("Email draft fixture tests passed.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
