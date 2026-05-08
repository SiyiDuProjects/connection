import { revealApolloEmail } from "./apollo.js";

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
  const geoId = firstString(
    job.searchPreferences?.region?.linkedinGeoId,
    job.searchPreferences?.region?.geoId,
    job.regionLinkedinGeoId
  );

  if (!schoolId || !geoId) {
    const error = new Error("Missing verified school or region LinkedIn ID.");
    error.status = 428;
    error.publicMessage = "Confirm your school and region in onboarding before searching contacts.";
    throw error;
  }

  const companyId = await resolveCompanyId(job);
  if (!companyId) {
    const error = new Error(`Could not resolve LinkedIn company ID for ${job.companyName || job.companyDomain}.`);
    error.status = 404;
    error.publicMessage = "Could not resolve this company's LinkedIn ID.";
    throw error;
  }

  const params = new URLSearchParams({
    name: job.companyName || job.companyDomain || "company",
    current_company: companyId,
    school: schoolId,
    geocode_location: geoId,
    page: String(Math.max(1, Number(job.page || 1)))
  });

  const data = await rapidApiGet(PEOPLE_BASE_URL, "/api/v1/search/people", params, PEOPLE_HOST);
  const people = Array.isArray(data.data) ? data.data : [];
  return people.map((person) => normalizeFreshPerson(person, job, { companyId, schoolId, geoId }));
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
      regionLinkedinGeoId: ids.geoId
    }
  };
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
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
