export const FUNCTIONS = Object.freeze({
  RECRUITING: "recruiting",
  ENGINEERING: "engineering",
  PRODUCT: "product",
  DATA: "data",
  DESIGN: "design",
  MARKETING: "marketing",
  SALES: "sales",
  FINANCE: "finance",
  OPS: "ops",
  LEGAL: "legal",
  EXECUTIVE: "executive",
  UNKNOWN: "unknown"
});

export const SENIORITIES = Object.freeze({
  IC: "ic",
  SENIOR_IC: "senior_ic",
  MANAGER: "manager",
  DIRECTOR: "director",
  HEAD: "head",
  VP: "vp",
  C_SUITE: "c_suite",
  FOUNDER: "founder",
  UNKNOWN: "unknown"
});

const FUNCTION_RULES = [
  [FUNCTIONS.RECRUITING, ["recruiter", "recruiting", "talent acquisition", "sourcer", "university recruiter", "people partner", "human resources", " hr "]],
  [FUNCTIONS.DATA, ["data", "analytics", "analyst", "machine learning", "ml ", " ai ", "artificial intelligence", "data science"]],
  [FUNCTIONS.ENGINEERING, ["engineering", "engineer", "software", "developer", "technical", "infrastructure", "platform", "devops", "security"]],
  [FUNCTIONS.PRODUCT, ["product", "product manager", "product management", "product lead", "product director", "director of product", "head of product", "vp product"]],
  [FUNCTIONS.DESIGN, ["design", "designer", "ux", "ui", "user experience"]],
  [FUNCTIONS.MARKETING, ["marketing", "growth", "demand generation", "brand", "content"]],
  [FUNCTIONS.SALES, ["sales", "account executive", "business development", "revenue", "customer success"]],
  [FUNCTIONS.FINANCE, ["finance", "financial", "accounting", "accountant", "controller", "fp&a"]],
  [FUNCTIONS.OPS, ["operations", "business operations", "strategy", "chief of staff", "program manager"]],
  [FUNCTIONS.LEGAL, ["legal", "counsel", "attorney", "compliance"]]
];

const TEAM_RULES = [
  ["technical recruiting", ["technical recruiter", "technical sourcer", "engineering recruiter"]],
  ["university recruiting", ["university recruiter", "campus recruiter", "early talent", "new grad", "intern"]],
  ["platform", ["platform", "developer platform", "internal tools"]],
  ["infrastructure", ["infrastructure", "infra", "devops", "sre", "site reliability", "cloud"]],
  ["security", ["security", "trust and safety", "compliance"]],
  ["ai", [" ai ", "artificial intelligence", "machine learning", " ml ", "deep learning", "llm"]],
  ["analytics", ["analytics", "business intelligence", "bi ", "data analyst"]],
  ["growth", ["growth", "acquisition", "lifecycle", "activation", "retention"]],
  ["product", ["product", "roadmap", "user experience"]],
  ["finance", ["finance", "accounting", "fp&a"]],
  ["sales", ["sales", "revenue", "account executive"]]
];

const APOLLO_TITLE_PACKS = {
  [FUNCTIONS.RECRUITING]: ["Recruiter", "Technical Recruiter", "Talent Acquisition", "University Recruiter", "People Partner", "Hiring Manager"],
  [FUNCTIONS.ENGINEERING]: ["Engineering Manager", "Software Engineering Manager", "Director of Engineering", "Head of Engineering", "VP Engineering", "Technical Recruiter"],
  [FUNCTIONS.PRODUCT]: ["Product Manager", "Group Product Manager", "Director of Product", "Head of Product", "VP Product", "Product Lead"],
  [FUNCTIONS.DATA]: ["Data Science Manager", "Analytics Manager", "Director of Data", "Head of Data", "Machine Learning Manager"],
  [FUNCTIONS.DESIGN]: ["Design Manager", "Product Design Manager", "Director of Design", "Head of Design"],
  [FUNCTIONS.MARKETING]: ["Marketing Manager", "Growth Marketing Manager", "Director of Marketing", "Head of Marketing"],
  [FUNCTIONS.SALES]: ["Sales Manager", "Account Executive", "Business Development", "Director of Sales", "VP Sales"],
  [FUNCTIONS.FINANCE]: ["Finance Manager", "Accounting Manager", "Controller", "Director of Finance"],
  [FUNCTIONS.OPS]: ["Operations Manager", "Program Manager", "Business Operations", "Chief of Staff"],
  [FUNCTIONS.LEGAL]: ["Legal Counsel", "General Counsel", "Compliance Manager"],
  [FUNCTIONS.EXECUTIVE]: ["Founder", "CEO", "President", "Chief Executive Officer"]
};

export function inferFunction(...values) {
  for (const value of values.flat().filter(Boolean)) {
    const direct = inferFunctionFromText(searchableText([value]));
    if (direct !== FUNCTIONS.UNKNOWN) return direct;
  }

  const text = searchableText(values);
  return inferFunctionFromText(text);
}

function inferFunctionFromText(text) {
  if (isFounderText(text) || /\b(ceo|chief executive officer|president)\b/.test(text)) return FUNCTIONS.EXECUTIVE;
  if (/\b(cto|chief technology officer)\b/.test(text)) return FUNCTIONS.ENGINEERING;

  for (const [label, terms] of FUNCTION_RULES) {
    if (containsAny(text, terms)) return label;
  }

  return FUNCTIONS.UNKNOWN;
}

export function inferSeniority(...values) {
  const text = searchableText(values);
  if (isFounderText(text)) return SENIORITIES.FOUNDER;
  if (/\b(ceo|cto|cfo|coo|cmo|cro|chro|chief [a-z ]+ officer|chief executive officer)\b/.test(text)) return SENIORITIES.C_SUITE;
  if (/\b(vp|svp|evp|vice president)\b/.test(text)) return SENIORITIES.VP;
  if (/\b(head of|global head|department head)\b/.test(text)) return SENIORITIES.HEAD;
  if (/\b(director|senior director)\b/.test(text)) return SENIORITIES.DIRECTOR;
  if (/\b(manager|lead|supervisor)\b/.test(text)) return SENIORITIES.MANAGER;
  if (/\b(senior|staff|principal|sr\.?)\b/.test(text)) return SENIORITIES.SENIOR_IC;
  if (text.trim()) return SENIORITIES.IC;
  return SENIORITIES.UNKNOWN;
}

export function inferTeam(...values) {
  const text = searchableText(values);
  for (const [label, terms] of TEAM_RULES) {
    if (containsAny(text, terms)) return label;
  }
  return "";
}

export function titlePackForFunction(functionName, fallbackTitle = "") {
  const titles = APOLLO_TITLE_PACKS[functionName] || APOLLO_TITLE_PACKS[FUNCTIONS.RECRUITING];
  return unique([...(titles || []), fallbackTitle].filter(Boolean));
}

export function apolloSenioritiesForFunction(functionName) {
  if (functionName === FUNCTIONS.EXECUTIVE) return ["owner", "founder", "c_suite"];
  if (functionName === FUNCTIONS.RECRUITING) return ["manager", "senior", "director", "head", "vp"];
  return ["manager", "director", "head", "vp", "senior"];
}

export function isExecutiveOnlyTitle(title) {
  const text = searchableText([title]);
  return isFounderText(text) || /\b(ceo|chief executive officer|president)\b/.test(text);
}

export function isCtoTitle(title) {
  return /\b(cto|chief technology officer)\b/.test(searchableText([title]));
}

export function cleanDomain(value) {
  return String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

export function normalizeCompanyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function locationTerms(value) {
  return unique(String(value || "")
    .replace(/\b\d+\s+applicants\b/gi, "")
    .replace(/\bpromoted by hirer\b/gi, "")
    .replace(/\bactively reviewing applicants\b/gi, "")
    .replace(/\b(remote|hybrid|on-site)\b/gi, "")
    .split(/[|,;路]/)
    .map((part) => part.trim())
    .filter(Boolean))
    .slice(0, 3);
}

export function unique(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isFounderText(text) {
  return /\b(founder|co-founder|cofounder|owner)\b/.test(text);
}

function searchableText(values) {
  return values
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9&+.#\s-]/g, " ")
    .replace(/\s+/g, " ");
}
