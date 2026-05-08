const DEFAULT_OPENAI_BASE_URL = "https://reachard.studio";

export async function buildContactSearchPlan(job) {
  const fallback = fallbackPlan(job);
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      Number(process.env.AI_SEARCH_PLAN_TIMEOUT_MS || 12_000)
    );

    try {
      const response = await fetch(openAiResponsesUrl(), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
          instructions: instructions(),
          input: buildInput(job),
          text: {
            format: {
              type: "json_schema",
              name: "contact_search_plan",
              strict: true,
              schema: schema()
            }
          },
          store: false
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || `OpenAI request failed with ${response.status}`);

      const parsed = JSON.parse(extractOutputText(data));
      return normalizePlan(parsed, fallback);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn("AI contact search plan failed:", error.message || error);
    return fallback;
  }
}

function fallbackPlan(job) {
  const title = clean(job.originalJobTitle || job.jobTitle || job.targetRole);
  const functionalTitle = functionalQuery(title);
  const queries = compact([
    functionalTitle,
    shortenTitle(functionalTitle, 3),
    shortenTitle(functionalTitle, 2)
  ]);
  return {
    companyName: clean(job.companyName),
    primaryQuery: queries[0] || clean(job.companyName) || "operations",
    fallbackQueries: queries.slice(1, 3),
    positiveSignals: queries,
    negativeSignals: [],
    jobLocation: clean(job.jobLocation),
    ai: { used: false, provider: "fallback" }
  };
}

function instructions() {
  return [
    "You prepare LinkedIn people-search queries for job networking.",
    "The goal is to find likely hiring managers, team leads, recruiters, or functional leaders at the company, not exact peers with the same job level.",
    "Use only the provided job title and job description. Do not invent adjacent roles or domains.",
    "Do not infer e-commerce, marketing, CRM, clienteling, or analytics unless those words or very close equivalents appear in the input.",
    "The company is searched separately through current_company, so do not include the company name in role queries.",
    "The primaryQuery must be the functional area or team keyword, not the exact job title when the title contains level words.",
    "Remove seniority and level words such as Associate, Assistant, Intern, Junior, Senior, Staff, Principal, Lead, Manager, Director, Head, VP, I, II, III, New Grad, and Entry Level.",
    "Examples: Operations Associate -> Operations; Digital Sales Operations Associate -> Digital Sales Operations; Data Engineer II -> Data Engineering; Product Manager -> Product; Software Engineering Manager -> Software Engineering.",
    "Fallback queries must be broader functional sub-phrases or close abbreviations, such as Digital Sales Operations -> Sales Operations -> Operations.",
    "Each query should usually be 1 to 4 words.",
    "Return only valid JSON matching the schema."
  ].join("\n");
}

function buildInput(job) {
  return JSON.stringify({
    companyName: job.companyName || "",
    companyDomain: job.companyDomain || "",
    jobTitle: job.originalJobTitle || job.jobTitle || job.targetRole || "",
    targetRole: job.targetRole || "",
    jobLocation: job.jobLocation || "",
    jobDescription: truncate(job.jobDescription, Number(process.env.AI_SEARCH_PLAN_MAX_JD_CHARS || 4_000))
  });
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      companyName: { type: "string" },
      primaryQuery: { type: "string" },
      fallbackQueries: {
        type: "array",
        items: { type: "string" }
      },
      positiveSignals: {
        type: "array",
        items: { type: "string" }
      },
      negativeSignals: {
        type: "array",
        items: { type: "string" }
      },
      jobLocation: { type: "string" }
    },
    required: ["companyName", "primaryQuery", "fallbackQueries", "positiveSignals", "negativeSignals", "jobLocation"]
  };
}

function normalizePlan(value, fallback) {
  const primary = functionalQuery(value.primaryQuery) || fallback.primaryQuery;
  const fallbackQueries = normalizeQueries(value.fallbackQueries)
    .map(functionalQuery)
    .filter((query) => normalizeKey(query) !== normalizeKey(primary))
    .slice(0, 2);

  return {
    companyName: clean(value.companyName) || fallback.companyName,
    primaryQuery: primary,
    fallbackQueries,
    positiveSignals: normalizeQueries(value.positiveSignals).map(functionalQuery).slice(0, 8),
    negativeSignals: normalizeQueries(value.negativeSignals).slice(0, 8),
    jobLocation: clean(value.jobLocation) || fallback.jobLocation,
    ai: { used: true, provider: "openai", model: process.env.OPENAI_MODEL || "gpt-5.4-mini" }
  };
}

function normalizeQueries(value) {
  if (!Array.isArray(value)) return [];
  return compact(value.map((item) => clean(item).split(/\s+/).slice(0, 5).join(" ")));
}

function functionalQuery(value) {
  const text = clean(value);
  if (!text) return "";

  const replacements = [
    [/\bdata engineer(?:ing)?\b/gi, "Data Engineering"],
    [/\bsoftware engineer(?:ing)?\b/gi, "Software Engineering"],
    [/\bproduct manager\b/gi, "Product"],
    [/\bprogram manager\b/gi, "Program"],
    [/\bproject manager\b/gi, "Project"],
    [/\bsales ops\b/gi, "Sales Operations"],
    [/\bbizops\b/gi, "Business Operations"]
  ];
  let output = text;
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }

  output = output
    .replace(/\b(?:associate|assistant|internship|intern|junior|jr\.?|senior|sr\.?|staff|principal|lead|manager|director|head|vp|svp|evp|new grad|entry level)\b/gi, " ")
    .replace(/\b(?:i|ii|iii|iv|v|l\d+)\b/gi, " ")
    .replace(/[-/|,;:()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return output || text;
}

function shortenTitle(value, words) {
  return clean(value).split(/\s+/).slice(0, words).join(" ");
}

function compact(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = clean(value);
    const key = normalizeKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return clean(value).toLowerCase();
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n[truncated]`;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  const text = parts.join("\n").trim();
  if (!text) throw new Error("OpenAI response did not include output text.");
  return text;
}

function openAiResponsesUrl() {
  const baseUrl = String(process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/v1/responses`;
}
