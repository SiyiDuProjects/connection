import { buildPeopleSearchPlan } from "./contact-intelligence.js";
import { cleanDomain, locationTerms, normalizeCompanyName } from "./contact-taxonomy.js";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

export async function searchApolloContacts(job) {
  requireApolloKey();

  const organization = await findOrganization(job);
  const payload = { ...buildPeopleSearchPlan(job).apollo };

  if (organization?.id) {
    payload.organization_ids = [organization.id];
    delete payload.q_organization_domains_list;
    delete payload.q_keywords;
  } else if (organization?.domain || job.companyDomain) {
    payload.q_organization_domains_list = [organization?.domain || job.companyDomain];
    delete payload.q_keywords;
  } else {
    payload.q_keywords = job.companyName;
  }

  const data = await apolloPost("/mixed_people/api_search", compactPayload(payload));
  const people = data.people || data.contacts || [];
  return people.map((person) => normalizeApolloPerson(person, organization));
}

export async function revealApolloEmail(contact) {
  requireApolloKey();

  if (contact.email) return contact.email;
  if (!contact.apolloId && !contact.linkedinUrl && !contact.name) return "";

  const data = await apolloPost("/people/match", compactPayload({
    id: contact.apolloId,
    name: contact.name,
    linkedin_url: contact.linkedinUrl,
    organization_name: contact.companyName,
    domain: contact.companyDomain,
    reveal_personal_emails: false,
    reveal_phone_number: false
  }));

  return data.person?.email || data.contact?.email || data.email || "";
}

async function findOrganization(job) {
  const data = await apolloPost("/mixed_companies/search", compactPayload({
    q_organization_name: job.companyName,
    q_organization_domains_list: job.companyDomain ? [job.companyDomain] : undefined,
    organization_job_locations: locationTerms(job.jobLocation),
    q_organization_job_titles: job.jobTitle ? [job.jobTitle] : undefined,
    page: 1,
    per_page: 5
  }));

  const organizations = data.organizations || data.companies || data.accounts || [];
  const normalized = organizations.map(normalizeOrganization);
  return pickBestOrganization(normalized, job.companyName, job.companyDomain);
}

async function apolloPost(path, payload) {
  const url = new URL(`${APOLLO_BASE_URL}${path}`);
  appendQueryParams(url.searchParams, payload);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "accept": "application/json",
      "X-Api-Key": process.env.APOLLO_API_KEY
    }
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
    name: person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
    title: person.title || "",
    companyName: organization.name || person.organization_name || organizationFallback.name || "",
    companyDomain: organization.primary_domain || organization.website_url || organization.domain || organizationFallback.domain || "",
    location: [person.city, person.state, person.country].filter(Boolean).join(", "),
    education: normalizeEducation(person),
    linkedinUrl,
    email: "",
    emailStatus: person.email_status || ""
  };
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function normalizeOrganization(organization) {
  return {
    id: organization.organization_id || organization.id,
    name: organization.name || organization.organization_name || "",
    domain: cleanDomain(organization.primary_domain || organization.domain || organization.website_url || organization.organization_website_url || "")
  };
}

function pickBestOrganization(organizations, companyName, companyDomain = "") {
  if (!organizations.length) return null;
  const wantedDomain = cleanDomain(companyDomain);
  if (wantedDomain) {
    const domainMatch = organizations.find((organization) => cleanDomain(organization.domain) === wantedDomain);
    if (domainMatch) return domainMatch;
  }
  const wanted = normalizeCompanyName(companyName);
  return organizations.find((organization) => normalizeCompanyName(organization.name) === wanted) || organizations[0];
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

function requireApolloKey() {
  if (!process.env.APOLLO_API_KEY) {
    const error = new Error("Missing APOLLO_API_KEY.");
    error.status = 500;
    error.publicMessage = "Server is missing APOLLO_API_KEY.";
    throw error;
  }
}
