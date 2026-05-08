import { revealApolloEmail, searchApolloContacts } from "./apollo.js";
import { buildContactSearchPlan } from "./contact-search-plan.js";

const PEOPLE_HOST = process.env.RAPIDAPI_PEOPLE_HOST || "fresh-linkedin-scraper-api.p.rapidapi.com";
const METADATA_HOST = process.env.RAPIDAPI_METADATA_HOST || "z-real-time-linkedin-scraper-api1.p.rapidapi.com";
const PEOPLE_BASE_URL = `https://${PEOPLE_HOST}`;
const METADATA_BASE_URL = `https://${METADATA_HOST}`;
const companyCache = new Map();

export async function searchRapidApiContacts(job) {
  requireRapidApiKey();

  const schoolId = firstString(
    job.searchPreferences?.school?.linkedinId,
    job.searchPreferences?.school?.linkedinSchoolId,
    job.schoolLinkedinId
  );
  const searchPlan = await buildContactSearchPlan(job);
  const geoId = await resolveJobLocationId(searchPlan.jobLocation || job.jobLocation);

  const companyId = await resolveCompanyId(job);
  if (!companyId) {
    const error = new Error(`Could not resolve LinkedIn company ID for ${job.companyName || job.companyDomain}.`);
    error.status = 404;
    error.publicMessage = "Could not resolve this company's LinkedIn ID.";
    throw error;
  }

  const queries = buildPeopleSearchQueries(searchPlan, job);
  const searches = [];
  for (const query of queries) {
    searches.push({ query, schoolId });
  }

  const people = [];
  for (const search of searches) {
    const results = await searchPeople({
      query: search.query,
      companyId,
      schoolId: search.schoolId,
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
    const broadQueries = buildPeopleSearchQueries(searchPlan, job, { broad: true });
    for (const query of broadQueries) {
      const results = await searchPeople({
        query,
        companyId,
        schoolId: "",
        geoId,
        page: job.page
      });
      broadPeople.push(...results);
    }
    contacts = normalizePeople(dedupePeople([...people, ...broadPeople]), job, {
      companyId,
      schoolId,
      geoId,
      searchPlan,
      schoolRestricted: false
    });
  }

  return mergeApolloEmailAvailableContacts(contacts, job, queries, {
    companyId,
    schoolId,
    geoId,
    searchPlan
  });
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

  const keywords = job.companyDomain || job.companyName;
  if (!keywords) return "";

  const params = new URLSearchParams({
    keywords,
    limit: "10"
  });
  const data = await rapidApiGet(METADATA_BASE_URL, "/api/search/companies", params, METADATA_HOST);
  const companies = Array.isArray(data.data?.data) ? data.data.data : Array.isArray(data.data) ? data.data : [];
  const selected = selectCompany(companies, job);
  const id = firstString(selected?.id, selected?.entityUrn?.split(":").pop());

  if (cacheKey && id) companyCache.set(cacheKey, id);
  return id;
}

async function resolveJobLocationId(location) {
  const query = firstString(location);
  if (!query) return "";

  try {
    const params = new URLSearchParams({
      search: query,
      limit: "5"
    });

    const data = await rapidApiGet(METADATA_BASE_URL, "/api/search/metadata/location", params, METADATA_HOST);
    const locations = Array.isArray(data.data) ? data.data : [];
    const selected = selectLocation(locations, query);
    return firstString(selected?.id);
  } catch {
    return "";
  }
}

function selectLocation(locations, query) {
  if (!locations.length) return null;
  const wanted = normalizeKey(query);
  return locations.find((location) => normalizeKey(location.name) === wanted) || locations[0];
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

function normalizePeople(people, job, metadata) {
  return people.map((person) => normalizeFreshPerson(person, job, metadata));
}

function buildPeopleSearchQueries(searchPlan, job, options = {}) {
  const baseQueries = [
    searchPlan.primaryQuery,
    ...searchPlan.fallbackQueries
  ];
  if (options.broad) {
    baseQueries.push(
      roleHead(searchPlan.primaryQuery),
      roleHead(job.originalJobTitle || job.jobTitle || job.targetRole),
      job.companyName
    );
  }
  return uniqueStrings(baseQueries).slice(0, options.broad ? 5 : 3);
}

async function mergeApolloEmailAvailableContacts(contacts, job, queries, metadata = {}) {
  const maxApolloSearches = Math.max(1, Number(process.env.RAPIDAPI_APOLLO_EMAIL_CHECK_SEARCHES || 2));
  const apolloContacts = [];
  for (const query of queries.slice(0, maxApolloSearches)) {
    const results = await searchApolloContacts({
      ...job,
      jobTitle: query,
      targetRole: query
    }).catch(() => []);
    if (results.length) {
      apolloContacts.push(...results);
      continue;
    }

    const relaxedResults = await searchApolloContacts({
      ...job,
      jobTitle: query,
      targetRole: query,
      relaxedApolloSearch: true
    }).catch(() => []);
    apolloContacts.push(...relaxedResults);
  }

  const available = buildApolloAvailabilityIndex(apolloContacts);
  const output = new Map();
  for (const contact of contacts) {
    const match = findApolloAvailability(contact, available);
    if (!match) continue;
    addMergedContact(output, {
      ...contact,
      apolloId: match.apolloId || contact.apolloId,
      emailStatus: match.emailStatus || "verified"
    });
  }

  for (const contact of apolloContacts) {
    if (!hasAvailableEmail(contact)) continue;
    addMergedContact(output, {
      ...contact,
      provider: "apollo",
      metadata: {
        ...(contact.metadata || {}),
        emailAvailabilitySource: "apollo_search",
        rapidApiSearchPlan: metadata.searchPlan,
        companyLinkedinId: metadata.companyId,
        schoolLinkedinId: metadata.schoolId,
        regionLinkedinGeoId: metadata.geoId
      }
    });
  }

  const merged = [...output.values()];
  logSearchSummary({
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    queries,
    rapidApiCandidates: contacts.length,
    apolloCandidates: apolloContacts.length,
    apolloEmailAvailable: apolloContacts.filter(hasAvailableEmail).length,
    returned: merged.length,
    companyId: metadata.companyId,
    schoolId: metadata.schoolId,
    geoId: metadata.geoId
  });
  return merged;
}

function buildApolloAvailabilityIndex(contacts) {
  const byLinkedin = new Map();
  const byName = new Map();
  for (const contact of contacts) {
    if (!hasAvailableEmail(contact)) continue;
    const value = {
      apolloId: contact.apolloId,
      emailStatus: contact.emailStatus || "verified"
    };
    const linkedinKey = normalizeLinkedinUrl(contact.linkedinUrl);
    const nameKey = normalizeKey(contact.name);
    if (linkedinKey) byLinkedin.set(linkedinKey, value);
    if (nameKey) byName.set(nameKey, value);
  }
  return { byLinkedin, byName };
}

function findApolloAvailability(contact, available) {
  const linkedinKey = normalizeLinkedinUrl(contact.linkedinUrl);
  if (linkedinKey && available.byLinkedin.has(linkedinKey)) return available.byLinkedin.get(linkedinKey);
  const nameKey = normalizeKey(contact.name);
  if (nameKey && available.byName.has(nameKey)) return available.byName.get(nameKey);
  return null;
}

function addMergedContact(output, contact) {
  const key = mergeKey(contact);
  if (!key || output.has(key)) return;
  output.set(key, contact);
}

function mergeKey(contact) {
  return normalizeLinkedinUrl(contact.linkedinUrl)
    || normalizeKey([contact.name, contact.companyName, contact.title].filter(Boolean).join("|"));
}

function hasAvailableEmail(contact) {
  const status = normalizeKey(contact.emailStatus);
  return status === "verified" || status === "guessed" || status === "likely to engage" || status === "available";
}

function logSearchSummary(summary) {
  console.log(JSON.stringify({
    event: "rapidapi.search.summary",
    ...summary
  }));
}

function normalizeLinkedinUrl(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
    .replace(/\/+$/, "");
}

function selectCompany(companies, job) {
  const wantedName = normalizeCompany(job.companyName || job.companyDomain);
  const exact = companies.find((company) => normalizeCompany(company.name) === wantedName);
  if (exact) return exact;
  return [...companies].sort((a, b) => Number(b.followersCount || 0) - Number(a.followersCount || 0))[0];
}

async function rapidApiGet(baseUrl, path, params, host) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of params.entries()) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
      "x-rapidapi-key": process.env.RAPIDAPI_KEY
    }
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
  const linkedinUrl = firstString(person.url, person.linkedin_url);
  const id = firstString(person.id, person.urn, person.public_identifier, linkedinUrl, person.full_name);
  return {
    id,
    provider: "rapidapi",
    rapidApiId: firstString(person.id),
    name: firstString(person.full_name, person.name),
    title: firstString(person.title, person.headline),
    companyName: job.companyName,
    companyDomain: job.companyDomain,
    location: firstString(person.location),
    education: job.searchPreferences?.school?.label || job.school || "",
    linkedinUrl,
    email: "",
    emailStatus: "locked",
    metadata: {
      publicIdentifier: firstString(person.public_identifier),
      verified: Boolean(person.is_verified),
      premium: Boolean(person.is_premium),
      openToWork: Boolean(person.is_open_to_work),
      hiring: Boolean(person.is_hiring),
      companyLinkedinId: ids.companyId,
      schoolLinkedinId: ids.schoolId,
      regionLinkedinGeoId: ids.geoId,
      schoolRestricted: Boolean(ids.schoolRestricted),
      searchPlan: ids.searchPlan
    }
  };
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function roleHead(value) {
  const words = firstString(value).split(/\s+/).filter(Boolean);
  if (words.length < 2) return "";
  const head = words[0].replace(/[^a-z0-9&+-]/gi, "");
  return head.length >= 4 ? head : "";
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
