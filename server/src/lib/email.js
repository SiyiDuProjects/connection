const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const draftInternalCosts = new WeakMap();

export function getDraftInternalCost(draft) {
  return draft && typeof draft === "object" ? draftInternalCosts.get(draft) || null : null;
}

export async function createDraft(contact, job, settings = {}) {
  const fallback = createTemplateDraft(contact, job, settings);

  if (!process.env.OPENAI_API_KEY) {
    return {
      ...fallback,
      personalizationNotes: fallbackNotes(contact, job, settings),
      missingContext: missingContext(job, settings),
      warnings: [],
      ai: { used: false, provider: "template" }
    };
  }

  try {
    const result = await createAiDraft(contact, job, settings);
    const draft = {
      ...result.draft,
      ai: {
        used: true,
        provider: "openai",
        model: openAiModel()
      }
    };
    draftInternalCosts.set(draft, openAiInternalCost(result.response));
    return draft;
  } catch (error) {
    console.error("AI draft generation failed:", error.message || error);
    return {
      ...fallback,
      personalizationNotes: fallbackNotes(contact, job, settings),
      missingContext: missingContext(job, settings),
      warnings: ["AI generation was unavailable; review the template before sending."],
      ai: {
        used: false,
        provider: "template",
        model: openAiModel(),
        error: "AI generation was unavailable, so a safe template draft was used."
      }
    };
  }
}

function createTemplateDraft(contact, job, settings = {}) {
  const company = job.companyName || contact.companyName || "your company";
  const subject = process.env.GMAIL_SUBJECT_PREFIX || `Quick question about ${company}`;
  const firstName = String(contact.name || "").split(" ")[0] || "there";
  const titleLine = contact.title ? `I saw your work as ${articleFor(contact.title)} ${contact.title} at ${company}.` : `I came across your profile at ${company}.`;
  const preferences = settings.default_search_preferences || settings.defaultSearchPreferences || {};
  const roleTitle = job.originalJobTitle || job.jobTitle;
  const hasJobPosting = isJobPageContext(job);
  const jobLine = hasJobPosting && roleTitle
    ? `I'm interested in the posted ${roleTitle} role`
    : roleTitle
      ? `I'm exploring ${roleTitle} opportunities at ${company}`
      : `I'm exploring opportunities at ${company}`;
  const senderProfile = settings.sender_profile || settings.senderProfile || introProfile(settings);
  const toneLine = toneSentence(settings.email_tone || settings.emailTone);
  const contactPerspective = contactRoleLabel(preferences.contactRole || preferences.contact_role || preferences.seniority);
  const signature = settings.email_signature || settings.emailSignature || settings.sender_name || settings.senderName || "";
  const goalLine = goalSentence(settings.outreach_goal || settings.outreachGoal);

  const body = [
    `Hi ${firstName},`,
    "",
    `${titleLine} ${jobLine} and wanted to ask ${goalLine}${contactPerspective ? ` from your perspective as ${contactPerspective}` : ""}.`,
    "",
    `${senderProfile}${toneLine} and would really appreciate any advice on the team, the role, or the application process.`,
    "",
    "Thanks,",
    signature
  ].join("\n");

  return { subject, body };
}

export function createMailtoUrl(to, draft) {
  const params = [
    ["subject", draft.subject],
    ["body", draft.body]
  ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || "")}`).join("&");
  return `mailto:${encodeURIComponent(to)}?${params}`;
}

function articleFor(title) {
  return /^[aeiou]/i.test(String(title || "")) ? "an" : "a";
}

function toneSentence(tone) {
  const normalized = String(tone || "").toLowerCase();
  if (normalized.includes("concise")) return ", keeping this brief,";
  if (normalized.includes("confident")) return ", and I thought my background could be relevant,";
  if (normalized.includes("warm")) return ", and I wanted to reach out personally,";
  if (normalized.includes("formal")) return ", and I would be grateful for your guidance,";
  return "";
}

function contactRoleLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "hiring-manager") return "a hiring manager";
  if (normalized === "team-lead") return "a team lead";
  if (normalized === "alumni") return "an alum";
  if (normalized === "executive") return "a company leader";
  if (normalized === "recruiter") return "a recruiter";
  return "";
}

async function createAiDraft(contact, job, settings) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    Number(process.env.AI_DRAFT_TIMEOUT_MS || 20_000)
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
        model: openAiModel(),
        instructions: aiInstructions(),
        input: buildAiInput(contact, job, settings),
        text: {
          format: {
            type: "json_schema",
            name: "personalized_reachout_email",
            strict: true,
            schema: draftSchema()
          }
        },
        store: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const outputText = extractOutputText(data);
    const parsed = JSON.parse(outputText);
    return {
      draft: normalizeAiDraft(parsed, job, settings),
      response: data
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function aiInstructions() {
  return [
    "You write concise, truthful cold outreach emails for job seekers.",
    "Use only the resume/background, job description, and contact details provided.",
    "Do not invent work experience, degrees, referrals, prior conversations, or personal relationships.",
    "Do not claim the contact can refer the sender. Ask for advice, a brief chat, or the right recruiting contact.",
    "Treat saved sender profile data as stable personal context. Treat company, role intent, job description, selected profile, and contact data as page-specific context.",
    "For linkedin_job or external_job context, refer to the specific posted role when present.",
    "For linkedin_company or company_site context, describe the sender as exploring opportunities in the saved target area; never imply that a specific opening exists.",
    "Respect sender.emailTone, sender.outreachLength, sender.outreachGoal, and sender.outreachStyleNotes as style controls only; do not quote style notes verbatim.",
    "For sender.outreachLength, target 70-100 words for short, 100-140 words for concise, and 140-180 words for detailed.",
    "Use sender.emailSignature exactly as the closing signature when it is provided.",
    "If the context is a LinkedIn people profile, write to that one person and do not imply a job posting exists unless one was provided.",
    "If job title or job description is missing, still write a usable email and list the missing fields in missingContext.",
    "Add warnings for weak personalization, missing role context, or anything the sender should verify before sending.",
    "Use a natural human tone, not a sales pitch.",
    "Return only valid JSON matching the schema."
  ].join("\n");
}

function buildAiInput(contact, job, settings) {
  return JSON.stringify({
    sender: {
      name: settings.sender_name || settings.senderName || "",
      region: settings.region || "",
      school: settings.school || "",
      emailSignature: settings.email_signature || settings.emailSignature || "",
      introStyle: settings.intro_style || settings.introStyle || "student",
      emailTone: settings.email_tone || settings.emailTone || "warm",
      outreachLength: settings.outreach_length || settings.outreachLength || "concise",
      outreachGoal: settings.outreach_goal || settings.outreachGoal || "advice",
      outreachStyleNotes: settings.outreach_style_notes || settings.outreachStyleNotes || "",
      shortProfile: settings.sender_profile || settings.senderProfile || "",
      resumeContext: truncate(settings.resume_context || settings.resumeContext, Number(process.env.AI_DRAFT_MAX_RESUME_CHARS || 20_000))
    },
    job: {
      type: job.type || "",
      companyName: job.companyName || contact.companyName || "",
      jobTitle: job.jobTitle || "",
      originalJobTitle: job.originalJobTitle || "",
      hasJobPosting: isJobPageContext(job),
      jobLocation: job.jobLocation || "",
      jobUrl: job.jobUrl || "",
      sourceUrl: job.sourceUrl || job.jobUrl || "",
      jobDescription: truncate(job.jobDescription, Number(process.env.AI_DRAFT_MAX_JD_CHARS || 12_000))
    },
    pageContext: {
      type: job.type || "",
      source: job.source || "",
      pageTitle: job.pageTitle || "",
      personName: job.personName || contact.name || "",
      personTitle: job.personTitle || contact.title || "",
      personLinkedInUrl: job.personLinkedInUrl || contact.linkedinUrl || ""
    },
    contact: {
      name: contact.name || "",
      title: contact.title || "",
      companyName: contact.companyName || job.companyName || "",
      location: contact.location || "",
      education: contact.education || "",
      linkedinUrl: contact.linkedinUrl || "",
      reasons: Array.isArray(contact.reasons) ? contact.reasons.slice(0, 5) : []
    }
  });
}

function draftSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      personalizationNotes: {
        type: "array",
        items: { type: "string" }
      },
      missingContext: {
        type: "array",
        items: { type: "string" }
      },
      warnings: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["subject", "body", "personalizationNotes", "missingContext", "warnings"]
  };
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

function normalizeAiDraft(value, job, settings) {
  const subject = cleanLine(value.subject).slice(0, 140) || `Quick question about ${job.companyName || "the role"}`;
  const body = cleanBody(value.body);
  if (!body) throw new Error("AI response did not include an email body.");

  return {
    subject,
    body,
    personalizationNotes: normalizeStringArray(value.personalizationNotes).slice(0, 5),
    missingContext: Array.from(new Set([
      ...missingContext(job, settings),
      ...normalizeStringArray(value.missingContext)
    ])).slice(0, 5),
    warnings: normalizeStringArray(value.warnings).slice(0, 5)
  };
}

function fallbackNotes(contact, job, settings) {
  const notes = [];
  if (settings.resume_context || settings.sender_profile || settings.resumeContext || settings.senderProfile) notes.push("Used your saved profile context.");
  if (job.type === "linkedin_person") notes.push("Referenced the selected LinkedIn profile.");
  else if (job.jobTitle || job.companyName) notes.push("Referenced the page role and company.");
  if (contact.title || contact.companyName) notes.push("Referenced the selected contact's role.");
  return notes.length ? notes : ["Used available job and contact details."];
}

function missingContext(job, settings) {
  const missing = [];
  if (!settings.resume_context && !settings.sender_profile && !settings.resumeContext && !settings.senderProfile) missing.push("Add your resume or personal background for stronger personalization.");
  if (!job.jobTitle && job.type !== "linkedin_person") missing.push("Job title was not available.");
  if (!job.jobDescription && !["linkedin_person", "linkedin_company", "company_site"].includes(job.type)) missing.push("Job description was not available.");
  return missing;
}

function isJobPageContext(job = {}) {
  return ["linkedin_job", "external_job"].includes(String(job.type || "")) && Boolean(job.originalJobTitle || job.jobTitle);
}

function introProfile(settings = {}) {
  const school = settings.school ? ` at ${settings.school}` : "";
  const style = String(settings.intro_style || settings.introStyle || "student");
  if (style === "experienced") return "I'm an experienced professional";
  if (style === "career-switcher") return "I'm exploring a career transition";
  if (style === "founder") return "I'm a builder";
  return `I'm a student${school}`;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanLine).filter(Boolean);
}

function cleanLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanBody(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n[truncated]`;
}

function openAiModel() {
  return process.env.OPENAI_MODEL || "gpt-5.6-luna";
}

function openAiInternalCost(response = {}) {
  const usage = response.usage || {};
  const inputTokens = nonNegativeInteger(usage.input_tokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    nonNegativeInteger(usage.input_tokens_details?.cached_tokens)
  );
  const outputTokens = nonNegativeInteger(usage.output_tokens);
  const totalTokens = nonNegativeInteger(usage.total_tokens) || inputTokens + outputTokens;
  const rates = openAiPricing(openAiModel(), inputTokens);
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const costUsd = (
    uncachedInputTokens * rates.input
    + cachedInputTokens * rates.cachedInput
    + outputTokens * rates.output
  ) / 1_000_000;

  return {
    source: "openai",
    provider: "openai",
    model: openAiModel(),
    billing: "estimated",
    costMicroUsd: Math.round(costUsd * 1_000_000),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    responseId: cleanLine(response.id).slice(0, 128) || undefined
  };
}

function openAiPricing(model, inputTokens) {
  const isLuna = model === "gpt-5.6-luna";
  const longContext = inputTokens > 272_000;
  const input = nonNegativeNumber(process.env.OPENAI_INPUT_USD_PER_MILLION, isLuna ? 0.20 : 0);
  const cachedInput = nonNegativeNumber(process.env.OPENAI_CACHED_INPUT_USD_PER_MILLION, isLuna ? 0.02 : 0);
  const output = nonNegativeNumber(process.env.OPENAI_OUTPUT_USD_PER_MILLION, isLuna ? 1.20 : 0);
  return {
    input: input * (longContext ? 2 : 1),
    cachedInput: cachedInput * (longContext ? 2 : 1),
    output: output * (longContext ? 1.5 : 1)
  };
}

function nonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function nonNegativeNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function goalSentence(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "referral") return "whether you would be open to sharing advice or pointing me toward the right recruiting path";
  if (normalized === "intro") return "whether there is someone on the team you would recommend I speak with";
  return "if you would be open to a brief conversation";
}

function openAiResponsesUrl() {
  const baseUrl = String(process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/v1/responses`;
}
