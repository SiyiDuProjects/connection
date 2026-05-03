const RECRUITER_TERMS = ["recruiter", "talent", "people", "hr", "human resources", "sourcer"];
const SENIORITY_TERMS = ["director", "head", "lead", "manager", "senior", "staff", "principal"];
const SCHOOL_TERMS = ["berkeley", "uc berkeley", "university of california berkeley"];
const BAY_AREA_TERMS = ["san francisco", "bay area", "san jose", "palo alto", "mountain view", "sunnyvale", "menlo park"];

export function rankContacts(contacts, job) {
  return contacts
    .map((contact) => {
      const result = scoreContact(contact, job);
      return { ...contact, score: result.score, reasons: result.reasons };
    })
    .sort((a, b) => b.score - a.score);
}

function scoreContact(contact, job) {
  const reasons = [];
  let score = 0;
  const title = lower(contact.title);
  const education = lower(contact.education);
  const location = lower(contact.location);
  const jobTitle = lower(job.jobTitle);
  const jobLocation = lower(job.jobLocation);

  if (containsAny(title, RECRUITER_TERMS)) {
    score += 45;
    reasons.push("recruiting role");
  }

  if (containsAny(title, SENIORITY_TERMS)) {
    score += 12;
    reasons.push("senior contact");
  }

  if (containsAny(education, SCHOOL_TERMS)) {
    score += 28;
    reasons.push("Berkeley connection");
  }

  if (containsAny(location, BAY_AREA_TERMS) || overlaps(location, jobLocation, BAY_AREA_TERMS)) {
    score += 15;
    reasons.push("near job location");
  }

  const functionalMatch = inferFunctionalMatch(title, jobTitle);
  if (functionalMatch) {
    score += 20;
    reasons.push(`${functionalMatch} relevance`);
  }

  if (contact.email) {
    score += 8;
    reasons.push("email available");
  }

  return { score, reasons: reasons.slice(0, 3) };
}

function inferFunctionalMatch(title, jobTitle) {
  const pairs = [
    ["data", "data"],
    ["engineer", "engineering"],
    ["software", "engineering"],
    ["product", "product"],
    ["design", "design"],
    ["marketing", "marketing"],
    ["sales", "sales"]
  ];

  for (const [term, label] of pairs) {
    if (title.includes(term) && jobTitle.includes(term)) return label;
  }
  return "";
}

function containsAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function overlaps(value, other, terms) {
  return terms.some((term) => value.includes(term) && other.includes(term));
}

function lower(value) {
  return String(value || "").toLowerCase();
}

