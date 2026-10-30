export function normalizeContext(input, settings = {}) {
  const jobTitle = clean(input?.jobTitle);
  const sourceUrl = clean(input?.sourceUrl || input?.jobUrl);
  const type = clean(input?.type || "linkedin_job");
  const searchPreferences = normalizeSearchPreferences(settings);
  const companyContext = ["linkedin_company", "company_site"].includes(type);
  return {
    type,
    source: clean(input?.source),
    companyName: clean(input?.companyName),
    companyDomain: cleanDomain(input?.companyDomain),
    companyLinkedInUrl: clean(input?.companyLinkedInUrl),
    jobTitle,
    originalJobTitle: jobTitle,
    searchPreferences,
    jobLocation: clean(input?.jobLocation) || (companyContext ? searchPreferences.region.label : ""),
    jobUrl: sourceUrl,
    sourceUrl,
    jobDescription: cleanMultiline(input?.jobDescription),
    personName: clean(input?.personName),
    personTitle: clean(input?.personTitle),
    personLinkedInUrl: clean(input?.personLinkedInUrl),
    pageTitle: clean(input?.pageTitle)
  };
}

export function normalizeRevealContact(input) {
  if (!input || typeof input !== "object") return null;
  const contact = {
    id: clean(input.id),
    apolloId: clean(input.apolloId),
    name: clean(input.name),
    title: clean(input.title),
    companyName: clean(input.companyName),
    companyDomain: cleanDomain(input.companyDomain),
    linkedinUrl: normalizeLinkedinProfileUrl(input.linkedinUrl)
  };
  if (!contact.linkedinUrl && !contact.name && !contact.apolloId) return null;
  return contact;
}

function normalizeLinkedinProfileUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "linkedin.com" || !url.pathname.startsWith("/in/")) return "";
    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeSearchPreferences(settings = {}) {
  const preferences = settings.default_search_preferences || settings.defaultSearchPreferences || {};
  return {
    school: normalizePreference(preferences.school),
    region: normalizePreference(preferences.region)
  };
}

function normalizePreference(value) {
  if (!value || typeof value !== "object") return {};
  return {
    label: clean(value.label),
    linkedinId: clean(value.linkedinId),
    linkedinSchoolId: clean(value.linkedinSchoolId),
    linkedinGeoId: clean(value.linkedinGeoId),
    geoId: clean(value.geoId)
  };
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function cleanDomain(value) {
  return String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}
