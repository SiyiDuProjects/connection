import { revealApolloEmail } from "./apollo.js";
import { buildContactSearchPlan } from "./contact-search-plan.js";
import { fetchWithTimeout } from "./http.js";

const PEOPLE_HOST = process.env.RAPIDAPI_PEOPLE_HOST || "fresh-linkedin-scraper-api.p.rapidapi.com";
const PEOPLE_BASE_URL = `https://${PEOPLE_HOST}`;
const companyCache = new Map();
const locationCache = new Map();

export async function searchRapidApiContacts(job) {
  requireRapidApiKey();

  const schoolId = firstString(
    job.searchPreferences?.school?.linkedinId,
    job.searchPreferences?.school?.linkedinSchoolId,
    job.schoolLinkedinId
  );
  const searchPlan = await buildContactSearchPlan(job);
  const geoId = firstString(
    job.searchPreferences?.region?.linkedinGeoId,
    job.searchPreferences?.region?.geoId
  ) || await resolveJobLocationId(searchPlan.jobLocation || job.jobLocation);

  const companyId = await resolveCompanyId(job);
  if (!companyId) {
    const error = new Error(`Could not resolve LinkedIn company ID for ${job.companyName || job.companyDomain}.`);
    error.status = 404;
    error.publicMessage = "Could not resolve this company's LinkedIn ID.";
    throw error;
  }

  const queries = buildPeopleSearchQueries(searchPlan, job);
  const people = [];
  for (const query of queries) {
    const results = await searchPeople({
      query,
      companyId,
      schoolId,
      geoId,
      page: job.page
    });
    people.push(...results);
  }

  let contacts = normalizePeople(dedupePeople(people), job, {
    companyId,
    schoolId,
    geoId,
    searchPlan,
    schoolRestricted: Boolean(schoolId)
  });

  if (schoolId && contacts.length < 5) {
    const broadPeople = [];
    for (const query of queries) {
      const results = await searchPeople({
        query,
        companyId,
        schoolId: "",
        geoId,
        page: job.page
      });
      broadPeople.push(...results);
    }
    const broadContacts = normalizePeople(dedupePeople(broadPeople), job, {
      companyId,
      schoolId,
      geoId,
      searchPlan,
      schoolRestricted: false
    });
    contacts = dedupeContacts([...contacts, ...broadContacts]);
  }

  logSearchSummary({
    companyName: job.companyName,
    jobTitle: job.originalJobTitle || job.targetRole || job.jobTitle,
    pageType: job.type,
    queries,
    rapidApiCandidates: contacts.length,
    returned: contacts.length,
    companyId,
    schoolId,
    geoId
  });
  return contacts;
}

export function revealRapidApiEmail(contact) {
  return revealApolloEmail({
    ...contact,
    provider: "apollo"
  });
}

async function resolveCompanyId(job) {
  const cacheKey = [
    normalizeKey(job.companyDomain),
    normalizeKey(job.companyName)
  ].filter(Boolean).join("|");

  if (cacheKey && companyCache.has(cacheKey)) return companyCache.get(cacheKey);

  const company = companyLookupTerm(job);
  if (!company) return "";

  const params = new URLSearchParams({
    company
  });
  const data = await rapidApiGet(PEOPLE_BASE_URL, "/api/v1/company/profile", params, PEOPLE_HOST);
  const profile = Array.isArray(data.data) ? selectCompany(data.data, job) : data.data;
  const id = firstString(profile?.id, profile?.company_id, profile?.entityUrn?.split(":").pop());

  if (cacheKey && id) companyCache.set(cacheKey, id);
  return id;
}

async function resolveJobLocationId(location) {
  const query = firstString(location);
  if (!query) return "";
  const cacheKey = normalizeKey(query);
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey);

  try {
    const params = new URLSearchParams({
      keyword: query
    });

    const data = await rapidApiGet(PEOPLE_BASE_URL, "/api/v1/search/location", params, PEOPLE_HOST);
    const locations = Array.isArray(data.data) ? data.data : [];
    const selected = selectLocation(locations, query);
    const id = firstString(selected?.geocode, selected?.id);
    if (id) locationCache.set(cacheKey, id);
    return id;
  } catch {
    return "";
  }
}

function selectLocation(locations, query) {
  if (!locations.length) return null;
  const wanted = normalizeKey(query);
  return locations.find((location) => normalizeKey(location.location || location.name) === wanted) || locations[0];
}

async function searchPeople({ query, companyId, schoolId, geoId, page }) {
  const params = new URLSearchParams({
    name: query || "operations",
    current_company: companyId,
    page: String(Math.max(1, Number(page || 1)))
  });
  if (schoolId) params.set("school", schoolId);
  if (geoId) params.set("geocode_location", geoId);

  const data = await rapidApiGet(PEOPLE_BASE_URL, "/api/v1/search/people", params, PEOPLE_HOST);
  return Array.isArray(data.data) ? data.data : [];
}

function dedupePeople(people) {
  const seen = new Set();
  const output = [];
  for (const person of people) {
    const key = firstString(person.id, person.urn, person.public_identifier, person.url, person.full_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(person);
  }
  return output;
}

function dedupeContacts(contacts) {
  const seen = new Set();
  const output = [];
  for (const contact of contacts) {
    const key = firstString(contact.id, contact.linkedinUrl, `${contact.name}|${contact.title}`);
    const normalized = normalizeKey(key);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(contact);
  }
  return output;
}

function normalizePeople(people, job, metadata) {
  return people.map((person) => normalizeFreshPerson(person, job, metadata));
}

function buildPeopleSearchQueries(searchPlan, job) {
  const role = firstString(job.originalJobTitle, job.targetRole, job.jobTitle, searchPlan.primaryQuery);
  const recruiterQuery = /\b(engineer|engineering|data|product|design|technical|software|security|ai|machine learning)\b/i.test(role)
    ? "Technical Recruiter"
    : "Recruiter";
  const companyContext = ["linkedin_company", "company_site"].includes(job.type);
  const baseQueries = companyContext
    ? [searchPlan.primaryQuery, recruiterQuery, "Talent Acquisition"]
    : [searchPlan.primaryQuery, recruiterQuery, ...searchPlan.fallbackQueries];
  return uniqueStrings(baseQueries).slice(0, 3);
}

function logSearchSummary(summary) {
  console.log(JSON.stringify({
    event: "rapidapi.search.summary",
    ...summary
  }));
}

function selectCompany(companies, job) {
  const wantedName = normalizeCompany(job.companyName || job.companyDomain);
  const exact = companies.find((company) => normalizeCompany(company.name) === wantedName);
  if (exact) return exact;
  return [...companies].sort((a, b) => Number(b.follower_count || b.followersCount || 0) - Number(a.follower_count || a.followersCount || 0))[0];
}

async function rapidApiGet(baseUrl, path, params, host) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of params.entries()) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }

  const response = await fetchWithTimeout(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
      "x-rapidapi-key": process.env.RAPIDAPI_KEY
    }
  }, {
    provider: "rapidapi",
    timeoutMs: process.env.RAPIDAPI_TIMEOUT_MS || 15_000
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false || data.status === "ERROR") {
    const error = new Error(data.message || data.error || `RapidAPI request failed with ${response.status}`);
    error.status = response.status >= 500 ? 502 : response.status || 502;
    error.publicMessage = "Contact search is temporarily unavailable. Try again shortly.";
    throw error;
  }

  return data;
}

function normalizeFreshPerson(person, job, ids) {
  const linkedinUrl = firstString(
    person.url,
    person.linkedin_url,
    person.linkedin,
    person.linkedin_profile_url,
    person.profile_url
  );
  const id = firstString(person.id, person.urn, person.public_identifier, linkedinUrl, person.full_name);
  const organization = person.current_company || person.company || person.organization || {};
  return {
    id,
    provider: "rapidapi",
    rapidApiId: firstString(person.id),
    name: firstString(person.full_name, person.name),
    title: firstString(person.title, person.headline),
    companyName: firstString(
      person.company_name,
      person.current_company_name,
      person.organization_name,
      organization.name
    ),
    companyDomain: firstString(
      person.company_domain,
      person.current_company_domain,
      organization.domain,
      organization.website_url
    ),
    location: firstString(person.location),
    education: ids.schoolRestricted
      ? firstString(job.searchPreferences?.school?.label, job.school, normalizeFreshEducation(person))
      : normalizeFreshEducation(person),
    linkedinUrl,
    email: "",
    emailStatus: "",
    metadata: {
      publicIdentifier: firstString(person.public_identifier),
      verified: Boolean(person.is_verified),
      premium: Boolean(person.is_premium),
      openToWork: Boolean(person.is_open_to_work),
      hiring: Boolean(person.is_hiring),
      companyLinkedinId: ids.companyId,
      companySearchRestricted: Boolean(ids.companyId),
      schoolLinkedinId: ids.schoolId,
      regionLinkedinGeoId: ids.geoId,
      schoolRestricted: Boolean(ids.schoolRestricted),
      alumniMatched: Boolean(ids.schoolRestricted && ids.schoolId),
      searchPlan: ids.searchPlan
    }
  };
}

function normalizeFreshEducation(person) {
  const education = person.education || person.educations || person.schools || person.education_history || [];
  if (typeof education === "string") return education.trim();
  if (!Array.isArray(education)) return "";
  return education
    .map((school) => firstString(school?.school_name, school?.organization_name, school?.name, school))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = firstString(value);
    const key = normalizeKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function normalizeCompany(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(com|ai|co|io|net|org)$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function companyLookupTerm(job) {
  const name = firstString(job.companyName);
  if (name) return name;
  const domain = normalizeCompany(job.companyDomain);
  return domain || firstString(job.companyDomain);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function requireRapidApiKey() {
  if (!process.env.RAPIDAPI_KEY) {
    const error = new Error("Missing RAPIDAPI_KEY.");
    error.status = 500;
    error.publicMessage = "Server is missing RAPIDAPI_KEY.";
    throw error;
  }
}
