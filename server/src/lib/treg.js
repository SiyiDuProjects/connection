import crypto from "node:crypto";

import { cleanDomain, normalizeCompanyName, inferFunction, FUNCTIONS } from "./contact-taxonomy.js";
import { scoreCandidate } from "./contact-intelligence.js";
import { fetchWithTimeout, writeLog } from "./http.js";

const DEFAULT_BASE_URL = "https://treg.to";
const DEFAULT_SEARCH_ENDPOINT = "icypeas.people.search";
const DEFAULT_EMAIL_ENDPOINT = "apollo.people.enrich";
const revealCache = new Map();
const REVEAL_CACHE_MAX = 5_000;
const REVEAL_SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const REVEAL_MISS_TTL_MS = 24 * 60 * 60 * 1_000;

export async function searchTregContacts(job = {}, request = {}) {
  requireTregToken();

  const query = compactObject({
    currentCompanyWebsite: !job.companyName && job.companyDomain
      ? includeFilter(cleanDomain(job.companyDomain))
      : undefined,
    currentCompanyName: includeFilter(job.companyName)
  });

  const pageSize = boundedInteger(process.env.TREG_SEARCH_SIZE, 25, 1, 200);
  const maxPages = boundedInteger(process.env.TREG_SEARCH_MAX_PAGES, 3, 1, 3);
  const targetFunction = inferFunction(job.originalJobTitle, job.jobTitle, job.jobDescription);
  const contacts = new Map();
  const seenTokens = new Set();
  const usage = [];
  const diagnostics = { pages: 0, received: 0, invalid: 0, companyMismatch: 0, duplicates: 0 };
  let pagination = { size: pageSize };
  for (let page = 0; page < maxPages; page += 1) {
    const pageRequest = {};
    let data;
    try {
      data = await tregPost(
        endpointName("TREG_SEARCH_ENDPOINT", DEFAULT_SEARCH_ENDPOINT),
        { query, pagination },
        {
          action: "search",
          customerId: request.customerId,
          idempotencyKey: scopedIdempotencyKey(request.idempotencyKey, page === 0 ? "treg-search" : `treg-search-page-${page + 1}`),
          timeoutMs: process.env.TREG_SEARCH_TIMEOUT_MS || 15_000,
          usageTarget: pageRequest
        }
      );
    } catch (error) {
      if (!contacts.size) throw error;
      // Optional replenishment must not discard a successfully retrieved first page.
      writeLog("warn", "contacts.search_replenishment_failed", { page: page + 1, status: error.status || 503 });
      break;
    }
    diagnostics.pages += 1;
    if (pageRequest.internalCost) usage.push(pageRequest.internalCost);
    if (usage.length) setInternalCost(request, {
      ...usage[0],
      costMicroUsd: usage.every(item => Number.isFinite(item.costMicroUsd)) ? usage.reduce((sum, item) => sum + item.costMicroUsd, 0) : null,
      durationMs: usage.reduce((sum, item) => sum + (item.durationMs || 0), 0),
      calls: usage.length
    });
    const people = extractPeople(data);
    diagnostics.received += people.length;
    for (const raw of people) {
      if (!raw || typeof raw !== "object") { diagnostics.invalid += 1; continue; }
      const person = normalizeTregPerson(raw, job);
      if (!person.name || !person.linkedinUrl) { diagnostics.invalid += 1; continue; }
      if (!matchesTargetCompany(person, job)) { diagnostics.companyMismatch += 1; continue; }
      const key = person.linkedinUrl.toLowerCase();
      if (contacts.has(key)) { diagnostics.duplicates += 1; continue; }
      contacts.set(key, person);
    }
    const next = data?.pagination || data?.data?.pagination;
    const token = firstString(next?.token);
    const relevantCount = targetFunction === FUNCTIONS.UNKNOWN ? contacts.size
      : [...contacts.values()].filter(person => scoreCandidate(person, job).dimensions.roleFit >= 26).length;
    if ((contacts.size >= 10 && relevantCount >= 3) || !people.length || !token || seenTokens.has(token)) break;
    seenTokens.add(token);
    pagination = { size: pageSize, token };
  }
  writeLog("info", "contacts.search_candidates", { ...diagnostics, eligible: contacts.size });
  return [...contacts.values()];
}

export async function revealTregEmail(contact = {}, request = {}) {
  requireTregToken();
  if (isEmail(contact.email)) {
    setInternalCost(request, { provider: "existing", cached: true, costMicroUsd: 0 });
    return String(contact.email).trim().toLowerCase();
  }

  const query = apolloEmailLookupQuery(contact);
  if (!query) return "";

  const cacheKey = revealCacheKey(contact);
  const cached = getCachedReveal(cacheKey);
  if (cached !== undefined) {
    setInternalCost(request, { provider: "cache", cached: true, costMicroUsd: 0 });
    return cached;
  }

  const data = await tregPost(
    endpointName("TREG_EMAIL_ENDPOINT", DEFAULT_EMAIL_ENDPOINT),
    null,
    {
      action: "reveal",
      customerId: request.customerId,
      idempotencyKey: scopedIdempotencyKey(request.idempotencyKey, "treg-reveal"),
      timeoutMs: process.env.TREG_REVEAL_TIMEOUT_MS || 65_000,
      query,
      usageTarget: request
    }
  );

  const person = firstObject(data?.person, data?.data?.person, data?.output?.person, data?.output);
  const email = usableApolloWorkEmail(person) ? String(person.email).trim().toLowerCase() : "";
  setCachedReveal(cacheKey, email);
  return email;
}

async function tregPost(endpoint, body, options) {
  const url = new URL(`${tregBaseUrl()}/call/${endpoint}`);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const startedAt = Date.now();
  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: tregHeaders(options),
    ...(body ? { body: JSON.stringify(body) } : {})
  }, {
    provider: `treg:${endpoint}`,
    timeoutMs: options.timeoutMs
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw tregError(response, data);

  const usage = {
    source: "treg",
    provider: response.headers.get("x-treg-served-by") || data?._treg?.served_by || endpoint,
    endpoint,
    billing: "actual",
    costMicroUsd: numericHeader(response.headers.get("x-treg-cost-micro")) ?? data?._treg?.charged_micro ?? 0,
    durationMs: Date.now() - startedAt,
    callId: response.headers.get("x-treg-call-id") || undefined,
    replayed: response.headers.get("x-treg-idempotent-replay") === "true"
  };
  setInternalCost(options.usageTarget, usage);
  writeLog("info", "treg.call_completed", {
    action: options.action,
    callId: usage.callId,
    servedBy: usage.provider,
    costMicro: usage.costMicroUsd,
    replayed: usage.replayed
  });
  return data;
}

function tregHeaders(options = {}) {
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Idempotency-Key": options.idempotencyKey,
    "X-Treg-Token": process.env.TREG_TOKEN,
    "X-Treg-Meta": tregMeta(options.customerId, options.action)
  };

  return Object.fromEntries(Object.entries(headers).filter(([_key, value]) => value));
}

function normalizeTregPerson(person = {}, job = {}) {
  const currentJob = firstObject(
    person.currentJob,
    person.current_job,
    person.currentPosition,
    person.current_position,
    currentExperience(person)
  );
  const currentCompany = firstObject(
    person.currentCompany,
    person.current_company,
    person.currentEmployer,
    person.current_employer,
    currentJob.company,
    person.company
  );
  const name = firstString(
    person.fullName,
    person.full_name,
    person.name,
    [person.firstName || person.first_name || person.firstname, person.lastName || person.last_name || person.lastname].filter(Boolean).join(" ")
  );
  const companyName = firstString(
    person.currentCompanyName,
    person.current_company_name,
    person.lastCompanyName,
    person.last_company_name,
    currentCompany.name,
    currentJob.companyName,
    currentJob.company_name
  );
  const providerCompanyDomain = cleanDomain(firstString(
    person.currentCompanyWebsite,
    person.current_company_website,
    person.lastCompanyWebsite,
    person.last_company_website,
    currentCompany.website,
    currentCompany.domain,
    currentJob.companyWebsite,
    currentJob.company_website
  ));
  // Preserve provider evidence: never manufacture a matching domain from the job.
  const companyDomain = providerCompanyDomain;
  const preferredSchool = firstString(job.searchPreferences?.school?.label, job.school);
  const education = normalizeEducation(person);
  const linkedinUrl = normalizeLinkedinUrl(firstString(
    person.linkedinUrl,
    person.linkedin_url,
    person.linkedinProfileUrl,
    person.linkedin_profile_url,
    person.profileUrl,
    person.profile_url,
    person.url
  ));

  return {
    id: firstString(person.id, person.personId, person.person_id, linkedinUrl, name),
    provider: "treg",
    providerId: firstString(person.id, person.personId, person.person_id),
    name,
    title: firstString(
      person.currentJobTitle,
      person.current_job_title,
      person.lastJobTitle,
      person.last_job_title,
      person.title,
      currentJob.title,
      person.headline
    ),
    companyName,
    companyDomain,
    location: normalizeLocation(person),
    education,
    linkedinUrl,
    email: "",
    emailStatus: "",
    metadata: {
      companySearchRestricted: Boolean(job.companyDomain || job.companyName),
      alumniMatched: Boolean(preferredSchool && education && schoolMatches(education, preferredSchool))
    }
  };
}

function extractPeople(data) {
  for (const value of [
    data?.leads,
    data?.people,
    data?.results,
    data?.data?.leads,
    data?.data?.people,
    data?.data?.results
  ]) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function matchesTargetCompany(person, job) {
  const wantedName = normalizeCompanyName(job.companyName);
  const actualName = normalizeCompanyName(person.companyName);
  const wantedDomain = cleanDomain(job.companyDomain);
  const actualDomain = cleanDomain(person.companyDomain);
  if (wantedDomain && actualDomain) {
    return actualDomain === wantedDomain || actualDomain.endsWith(`.${wantedDomain}`);
  }
  if (wantedName && actualName) return actualName === wantedName;
  return !wantedName && !wantedDomain;
}

function apolloEmailLookupQuery(contact) {
  const linkedinUrl = normalizeLinkedinUrl(contact.linkedinUrl);
  const privacyFlags = {
    reveal_personal_emails: false,
    reveal_phone_number: false,
    run_waterfall_email: false,
    run_waterfall_phone: false
  };
  if (linkedinUrl) return { linkedin_url: linkedinUrl, ...privacyFlags };

  const name = firstString(contact.name);
  const domain = cleanDomain(contact.companyDomain);
  return name && domain ? { name, domain, ...privacyFlags } : null;
}

function usableApolloWorkEmail(person) {
  if (!isEmail(person?.email)) return false;
  const status = String(person.email_status || person.emailStatus || "").toLowerCase();
  return status === "verified";
}

function setInternalCost(target, value) {
  if (target && typeof target === "object") target.internalCost = compactObject(value);
}

function tregError(response, data) {
  const detail = firstString(data?.detail, data?.message, data?.error?.message, data?.error);
  const error = new Error(detail || `Treg request failed with ${response.status}.`);
  error.status = response.status === 402 ? 402 : response.status === 429 ? 429 : response.status >= 500 ? 502 : response.status;
  error.publicMessage = response.status === 402
    ? "Treg balance is exhausted."
    : response.status === 429
      ? "Treg or its provider is rate-limited. Try again shortly."
      : "Treg lookup failed. Check its token, balance, or request parameters.";
  return error;
}

function tregBaseUrl() {
  const raw = String(process.env.TREG_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("TREG_BASE_URL must use HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

function endpointName(envName, fallback) {
  const value = String(process.env[envName] || fallback).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(`${envName} contains an invalid endpoint id.`);
  }
  return value;
}

function includeFilter(value) {
  const values = Array.isArray(value) ? value : [value];
  const include = [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
  return include.length ? { include } : undefined;
}

function normalizeEducation(person) {
  const values = person.education || person.educations || person.schools || person.school || [];
  if (typeof values === "string") return values.trim();
  if (!Array.isArray(values)) return "";
  return values
    .map((item) => firstString(item?.schoolName, item?.school_name, item?.organizationName, item?.organization_name, item?.name, item))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function normalizeLocation(person) {
  const location = person.location || person.profileLocation || person.profile_location || person.address;
  if (typeof location === "string") return location.trim();
  if (location && typeof location === "object") {
    return firstString(
      location.fullName,
      location.full_name,
      location.name,
      [location.city, location.state || location.region, location.country].filter(Boolean).join(", ")
    );
  }
  return firstString(person.city_region_country, [person.city, person.state || person.region, person.country].filter(Boolean).join(", "));
}

function normalizeLinkedinUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw.replace(/^\/+/, "")}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "linkedin.com" || !url.pathname.toLowerCase().startsWith("/in/")) return "";
    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function currentExperience(person) {
  const values = person.experience || person.experiences || person.positions || [];
  return Array.isArray(values)
    ? values.find((item) => item?.current === true || item?.isCurrent === true || item?.is_current === true)
    : {};
}

function revealCacheKey(contact) {
  return normalizeLinkedinUrl(contact.linkedinUrl)
    || [contact.name, cleanDomain(contact.companyDomain)].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function getCachedReveal(key) {
  if (!key) return undefined;
  const cached = revealCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    revealCache.delete(key);
    return undefined;
  }
  return cached.email;
}

function setCachedReveal(key, email) {
  if (!key) return;
  if (revealCache.size >= REVEAL_CACHE_MAX) revealCache.delete(revealCache.keys().next().value);
  revealCache.set(key, {
    email,
    expiresAt: Date.now() + (email ? REVEAL_SUCCESS_TTL_MS : REVEAL_MISS_TTL_MS)
  });
}

function tregMeta(customerId, action) {
  const parts = [];
  const customer = metaValue(customerId);
  const safeAction = metaValue(action);
  if (customer) parts.push(`customer=${customer}`);
  if (safeAction) parts.push(`action=${safeAction}`);
  return parts.join(",");
}

function metaValue(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._:@-]+/g, "_")
    .slice(0, 96);
}

function scopedIdempotencyKey(value, scope) {
  const seed = String(value || crypto.randomUUID());
  return `${scope}-${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
}

function schoolMatches(actual, wanted) {
  const normalize = (value) => normalizeCompanyName(value).replace(/\b(university|college|school|of|the)\b/g, " ").replace(/\s+/g, " ").trim();
  const left = normalize(actual);
  const right = normalize(wanted);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function numericHeader(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([_key, item]) => item !== undefined));
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function requireTregToken() {
  if (!process.env.TREG_TOKEN) {
    const error = new Error("Missing TREG_TOKEN.");
    error.status = 500;
    error.publicMessage = "Server is missing TREG_TOKEN.";
    throw error;
  }
}
