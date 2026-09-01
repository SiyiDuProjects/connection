import { buildPeopleSearchPlan } from "./contact-intelligence.js";
import { fetchWithTimeout } from "./http.js";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";
const revealCache = new Map();
const REVEAL_CACHE_MAX = 5_000;
const REVEAL_SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const REVEAL_MISS_TTL_MS = 24 * 60 * 60 * 1_000;

export async function searchApolloContacts(job) {
  requireApolloKey();

  const payload = { ...buildPeopleSearchPlan(job).apollo };
  if (job.relaxedApolloSearch) {
    delete payload.q_organization_job_titles;
    delete payload.organization_job_locations;
    delete payload.person_locations;
    delete payload.person_seniorities;
    payload.include_similar_titles = true;
  }

  if (job.companyDomain) {
    payload.q_organization_domains_list = [job.companyDomain];
    delete payload.q_keywords;
  } else {
    payload.q_keywords = job.companyName;
  }

  const data = await apolloPost("/mixed_people/api_search", compactPayload(payload));
  const people = data.people || data.contacts || [];
  return people.map((person) => normalizeApolloPerson(person, {
    name: job.companyName,
    domain: job.companyDomain
  }));
}

export async function revealApolloEmail(contact) {
  requireApolloKey();

  if (contact.email) return contact.email;
  if (!contact.apolloId && !contact.linkedinUrl && !contact.name) return "";
  const cacheKey = contact.linkedinUrl || contact.apolloId || `${contact.name}|${contact.companyDomain || contact.companyName}`;
  const cached = getCachedReveal(cacheKey);
  if (cached !== undefined) return cached;

  const data = await apolloPost("/people/match", compactPayload({
    id: contact.apolloId,
    name: contact.name,
    linkedin_url: contact.linkedinUrl,
    organization_name: contact.companyName,
    domain: contact.companyDomain,
    reveal_personal_emails: false,
    reveal_phone_number: false,
    run_waterfall_email: false,
    run_waterfall_phone: false
  }));

  const person = data.person || data.contact || data;
  const status = String(person.email_status || person.emailStatus || "").toLowerCase();
  const email = person.email || "";
  const usableEmail = isUsableWorkEmail(email, status) ? email : "";
  setCachedReveal(cacheKey, usableEmail);
  return usableEmail;
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
  if (revealCache.size >= REVEAL_CACHE_MAX) {
    revealCache.delete(revealCache.keys().next().value);
  }
  revealCache.set(key, {
    email,
    expiresAt: Date.now() + (email ? REVEAL_SUCCESS_TTL_MS : REVEAL_MISS_TTL_MS)
  });
}

async function apolloPost(path, payload) {
  const url = new URL(`${APOLLO_BASE_URL}${path}`);
  appendQueryParams(url.searchParams, payload);

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "accept": "application/json",
      "X-Api-Key": process.env.APOLLO_API_KEY
    }
  }, {
    provider: "apollo",
    timeoutMs: process.env.APOLLO_TIMEOUT_MS || 15_000
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || `Apollo request failed with ${response.status}`);
    error.status = response.status >= 500 ? 502 : response.status;
    error.publicMessage = "Apollo request failed. Check API key, quota, or search parameters.";
    throw error;
  }

  return data;
}

function normalizeApolloPerson(person, organizationFallback = {}) {
  const organization = person.organization || person.account || {};
  const linkedinUrl = firstString(
    person.linkedin_url,
    person.linkedinUrl,
    person.linkedin_profile_url,
    person.person?.linkedin_url,
    person.contact?.linkedin_url
  );

  return {
    id: person.id || linkedinUrl || person.email,
    provider: "apollo",
    apolloId: person.person_id || person.id,
    name: person.name || [person.first_name, person.last_name || person.last_name_obfuscated].filter(Boolean).join(" "),
    title: person.title || "",
    companyName: organization.name || person.organization_name || organizationFallback.name || "",
    companyDomain: organization.primary_domain || organization.website_url || organization.domain || organizationFallback.domain || "",
    location: [person.city, person.state, person.country].filter(Boolean).join(", "),
    education: normalizeEducation(person),
    linkedinUrl,
    email: "",
    emailStatus: person.email_status || person.emailStatus || (person.has_email ? "available" : "")
  };
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function normalizeEducation(person) {
  const schools = person.education || person.educations || [];
  if (!Array.isArray(schools) || !schools.length) return "";
  return schools
    .map((school) => school.school_name || school.organization_name || school.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function appendQueryParams(params, payload) {
  for (const [key, value] of Object.entries(payload || {})) {
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => params.append(`${key}[]`, item));
    } else if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([_key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== "";
    })
  );
}

function isUsableWorkEmail(email, status) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || value === "[email protected]" || value === "[email protected]") return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  if (status === "invalid" || status === "unavailable") return false;
  return true;
}

function requireApolloKey() {
  if (!process.env.APOLLO_API_KEY) {
    const error = new Error("Missing APOLLO_API_KEY.");
    error.status = 500;
    error.publicMessage = "Server is missing APOLLO_API_KEY.";
    throw error;
  }
}
