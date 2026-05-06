import {
  FUNCTIONS,
  SENIORITIES,
  apolloSenioritiesForFunction,
  cleanDomain,
  inferFunction,
  inferSeniority,
  inferTeam,
  isCtoTitle,
  isExecutiveOnlyTitle,
  locationTerms,
  normalizeCompanyName,
  titlePackForFunction,
  unique
} from "./contact-taxonomy.js";

const WEIGHTS = Object.freeze({
  roleFit: 35,
  seniorityFit: 20,
  teamFit: 15,
  companyFit: 10,
  evidenceFit: 10,
  dataQuality: 5,
  freshness: 5
});

export function buildPeopleSearchPlan(job = {}) {
  const targetFunction = inferFunction(job.targetRole, job.jobTitle, job.originalJobTitle, job.jobDescription);
  const targetTeam = inferTeam(job.targetRole, job.jobTitle, job.originalJobTitle, job.jobDescription);
  const titles = titlePackForFunction(targetFunction, job.jobTitle || job.targetRole);
  const locations = locationTerms(job.jobLocation);
  const companyDomain = cleanDomain(job.companyDomain);

  return {
    provider: "apollo",
    targetFunction,
    targetTeam,
    excludeBroadExecutives: targetFunction !== FUNCTIONS.EXECUTIVE,
    apollo: compactPayload({
      person_titles: titles,
      include_similar_titles: false,
      contact_email_status: ["verified", "likely to engage", "unverified"],
      person_seniorities: apolloSenioritiesForFunction(targetFunction),
      q_organization_job_titles: job.jobTitle ? [job.jobTitle] : undefined,
      organization_job_locations: locations,
      person_locations: locations,
      q_organization_domains_list: companyDomain ? [companyDomain] : undefined,
      q_keywords: companyDomain ? undefined : job.companyName,
      page: 1,
      per_page: 25
    }),
    titleStrategy: {
      titles,
      seniorities: apolloSenioritiesForFunction(targetFunction),
      includeSimilarTitles: false
    }
  };
}

export function normalizeContactForScoring(contact = {}, job = {}) {
  const organization = contact.organization || contact.account || {};
  const name = firstString(
    contact.name,
    contact.full_name,
    [contact.first_name, contact.last_name].filter(Boolean).join(" ")
  );
  const title = firstString(contact.title, contact.job_title, contact.current_title);
  const companyName = firstString(
    contact.companyName,
    contact.company_name,
    contact.current_company_name,
    contact.organization_name,
    organization.name,
    job.companyName
  );
  const companyDomain = cleanDomain(firstString(
    contact.companyDomain,
    contact.company_domain,
    contact.domain,
    organization.primary_domain,
    organization.website_url,
    organization.domain,
    job.companyDomain
  ));
  const location = firstString(
    contact.location,
    contact.city_region_country,
    [contact.city, contact.state, contact.country].filter(Boolean).join(", ")
  );
  const education = normalizeEducation(contact);
  const linkedinUrl = firstString(
    contact.linkedinUrl,
    contact.linkedin_url,
    contact.linkedin_profile_url,
    contact.linkedin,
    contact.social?.linkedin,
    contact.contacts_information?.linkedin_url,
    contact.contact_details?.linkedin_url
  );
  const providerId = firstString(contact.apolloId, contact.exploriumProspectId, contact.person_id, contact.prospect_id, contact.id);

  return {
    id: providerId || linkedinUrl || name,
    provider: contact.provider || inferProvider(contact),
    providerId,
    name,
    title,
    companyName,
    companyDomain,
    location,
    education,
    linkedinUrl,
    email: firstString(contact.email),
    emailStatus: firstString(contact.emailStatus, contact.email_status, contact.professional_email_status),
    normalizedFunction: inferFunction(title),
    normalizedSeniority: inferSeniority(title),
    inferredTeam: inferTeam(
      title,
      contact.department,
      contact.departments,
      contact.subdepartment,
      contact.subdepartments,
      contact.employment_history?.map((item) => item?.title)
    ),
    raw: contact
  };
}

export function scoreCandidate(contact = {}, job = {}) {
  const normalized = normalizeContactForScoring(contact, job);
  const targetFunction = inferFunction(job.targetRole, job.jobTitle, job.originalJobTitle, job.jobDescription);
  const targetSeniority = inferSeniority(job.targetRole, job.jobTitle, job.originalJobTitle);
  const targetTeam = inferTeam(job.targetRole, job.jobTitle, job.originalJobTitle, job.jobDescription);
  const reasons = [];
  const warnings = [];
  const missingFields = [];

  for (const [field, label] of [
    ["title", "title"],
    ["companyName", "company"],
    ["education", "education"],
    ["location", "location"],
    ["linkedinUrl", "LinkedIn URL"]
  ]) {
    if (!normalized[field]) missingFields.push(label);
  }

  const roleFit = scoreRoleFit(normalized, targetFunction, job, reasons, warnings);
  const seniorityFit = scoreSeniorityFit(normalized, targetSeniority, targetFunction, reasons);
  const teamFit = scoreTeamFit(normalized, targetTeam, reasons, warnings);
  const companyFit = scoreCompanyFit(normalized, job, reasons);
  const evidenceFit = scoreEvidenceFit(normalized, reasons);
  const dataQuality = scoreDataQuality(normalized);
  const freshness = scoreFreshness(normalized, job, reasons);

  const dimensions = { roleFit, seniorityFit, teamFit, companyFit, evidenceFit, dataQuality, freshness };
  const matchScore = clamp(Math.round(Object.entries(dimensions).reduce((total, [key, value]) => {
    return total + (value * WEIGHTS[key]);
  }, 0)), 0, 100);

  if (!normalized.education) warnings.push("Education unavailable");

  return {
    ...normalized,
    matchScore,
    matchLabel: labelForScore(matchScore),
    dimensions: {
      roleFit: Math.round(roleFit * WEIGHTS.roleFit),
      seniorityFit: Math.round(seniorityFit * WEIGHTS.seniorityFit),
      teamFit: Math.round(teamFit * WEIGHTS.teamFit),
      companyFit: Math.round(companyFit * WEIGHTS.companyFit),
      evidenceFit: Math.round(evidenceFit * WEIGHTS.evidenceFit),
      dataQuality: Math.round(dataQuality * WEIGHTS.dataQuality),
      freshness: Math.round(freshness * WEIGHTS.freshness)
    },
    normalizedTarget: {
      function: targetFunction,
      seniority: targetSeniority,
      team: targetTeam
    },
    reasons: unique(reasons).slice(0, 4),
    warnings: unique(warnings),
    missingFields: unique(missingFields)
  };
}

export function rankCandidatesV2(contacts = [], job = {}) {
  return contacts
    .map((contact) => ({ ...contact, intelligence: scoreCandidate(contact, job) }))
    .sort((first, second) => second.intelligence.matchScore - first.intelligence.matchScore);
}

function scoreRoleFit(contact, targetFunction, job, reasons, warnings) {
  if (targetFunction === FUNCTIONS.UNKNOWN) {
    if (contact.normalizedFunction === FUNCTIONS.RECRUITING) {
      reasons.push("Recruiting contact");
      return 0.8;
    }
    return contact.normalizedFunction === FUNCTIONS.UNKNOWN ? 0.25 : 0.55;
  }

  if (isExecutiveOnlyTitle(contact.title) && targetFunction !== FUNCTIONS.EXECUTIVE) {
    warnings.push("Executive title only weakly matches this role");
    return 0.15;
  }

  if (isCtoTitle(contact.title) && !isTechnicalLeadershipTarget(targetFunction, job)) {
    warnings.push("CTO title is not treated as a broad role match");
    return 0.25;
  }

  if (contact.normalizedFunction === targetFunction) {
    reasons.push(`${titleCase(targetFunction)} role match`);
    return 1;
  }

  if (contact.normalizedFunction === FUNCTIONS.RECRUITING) {
    reasons.push("Recruiting contact can route hiring context");
    return targetFunction === FUNCTIONS.EXECUTIVE ? 0.25 : 0.65;
  }

  if (targetFunction === FUNCTIONS.ENGINEERING && contact.normalizedFunction === FUNCTIONS.DATA) return 0.55;
  if (targetFunction === FUNCTIONS.DATA && contact.normalizedFunction === FUNCTIONS.ENGINEERING) return 0.5;
  if (targetFunction === FUNCTIONS.PRODUCT && contact.normalizedFunction === FUNCTIONS.DESIGN) return 0.45;

  return contact.normalizedFunction === FUNCTIONS.UNKNOWN ? 0.2 : 0.1;
}

function scoreSeniorityFit(contact, targetSeniority, targetFunction, reasons) {
  const seniority = contact.normalizedSeniority;
  if (seniority === SENIORITIES.UNKNOWN) return 0.2;
  if (targetFunction === FUNCTIONS.RECRUITING && [SENIORITIES.SENIOR_IC, SENIORITIES.MANAGER, SENIORITIES.DIRECTOR, SENIORITIES.HEAD].includes(seniority)) {
    reasons.push(`${readableSeniority(seniority)} fit`);
    return 1;
  }
  if ([SENIORITIES.MANAGER, SENIORITIES.DIRECTOR, SENIORITIES.HEAD].includes(seniority)) {
    reasons.push(`${readableSeniority(seniority)} fit`);
    return 0.95;
  }
  if (seniority === SENIORITIES.VP) return targetSeniority === SENIORITIES.VP || targetFunction === FUNCTIONS.EXECUTIVE ? 0.9 : 0.65;
  if (seniority === SENIORITIES.C_SUITE || seniority === SENIORITIES.FOUNDER) return targetFunction === FUNCTIONS.EXECUTIVE ? 1 : 0.25;
  if (seniority === SENIORITIES.SENIOR_IC) return 0.7;
  return 0.45;
}

function scoreTeamFit(contact, targetTeam, reasons, warnings) {
  if (!targetTeam) return contact.inferredTeam ? 0.6 : 0.35;
  if (contact.inferredTeam === targetTeam) {
    reasons.push(`Likely ${targetTeam} team`);
    return 1;
  }
  if (contact.inferredTeam) {
    warnings.push("Team inferred from title only");
    return 0.45;
  }
  warnings.push("Team unavailable");
  return 0.2;
}

function scoreCompanyFit(contact, job, reasons) {
  const wantedDomain = cleanDomain(job.companyDomain);
  const wantedCompany = normalizeCompanyName(job.companyName);
  if (wantedDomain && cleanDomain(contact.companyDomain) === wantedDomain) {
    reasons.push("Verified company domain");
    return 1;
  }
  if (wantedCompany && normalizeCompanyName(contact.companyName) === wantedCompany) {
    reasons.push("Company match");
    return 0.85;
  }
  if (contact.companyName || contact.companyDomain) return 0.45;
  return 0.1;
}

function scoreEvidenceFit(contact, reasons) {
  let count = 0;
  if (contact.linkedinUrl) count += 1;
  if (contact.emailStatus) count += 1;
  if (contact.education) count += 1;
  if (contact.location) count += 1;
  if (contact.providerId) count += 1;
  if (count >= 4) reasons.push("Strong profile evidence");
  return Math.min(1, count / 5);
}

function scoreDataQuality(contact) {
  let count = 0;
  if (contact.name) count += 1;
  if (contact.title) count += 1;
  if (contact.companyName || contact.companyDomain) count += 1;
  if (contact.emailStatus && !/invalid|unavailable/i.test(contact.emailStatus)) count += 1;
  if (contact.providerId || contact.linkedinUrl) count += 1;
  return Math.min(1, count / 5);
}

function scoreFreshness(contact, job, reasons) {
  if (!job.jobTitle && !job.jobDescription && !job.companyName && !job.companyDomain) return 0.25;
  if (contact.companyName || contact.companyDomain) {
    reasons.push("Current company context");
    return 0.8;
  }
  return 0.35;
}

function isTechnicalLeadershipTarget(targetFunction, job) {
  const text = [job.targetRole, job.jobTitle, job.jobDescription].filter(Boolean).join(" ").toLowerCase();
  return targetFunction === FUNCTIONS.ENGINEERING && /\b(manager|director|head|vp|leadership|technical buyer|cto)\b/.test(text);
}

function labelForScore(score) {
  if (score >= 85) return "strong";
  if (score >= 70) return "good";
  if (score >= 55) return "possible";
  return "weak";
}

function normalizeEducation(contact) {
  if (typeof contact.education === "string") return contact.education;
  const schools = contact.education || contact.educations || contact.schools || [];
  if (!Array.isArray(schools)) return "";
  return schools
    .map((school) => school.school_name || school.organization_name || school.name || school)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function inferProvider(contact) {
  if (contact.apolloId || contact.person_id) return "apollo";
  if (contact.organization && contact.id) return "apollo";
  if (contact.exploriumProspectId || contact.prospect_id) return "explorium";
  return contact.mockEmail ? "mock" : "";
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([_key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== "";
    })
  );
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readableSeniority(value) {
  return titleCase(value).replace("Ic", "IC").replace("C Suite", "C-suite");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
