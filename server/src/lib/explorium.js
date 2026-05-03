const EXPLORIUM_BASE_URL = "https://api.explorium.ai/v1";

export async function searchExploriumContacts(job) {
  requireExploriumKey();

  const payload = {
    request_context: null,
    mode: "full",
    size: 25,
    page_size: 25,
    page: 1,
    exclude: null,
    next_cursor: null,
    filters: compactObject({
      company_name: { values: [job.companyName] },
      job_level: {
        values: ["owner", "cxo", "vp", "director", "senior", "manager", "partner", "non-managerial", "founder"]
      },
      has_email: { value: true }
    })
  };

  console.info("Explorium prospects search:", JSON.stringify(safeSearchLog(job, payload)));
  const data = await exploriumPost("/prospects", payload, { retryPayload: fallbackPayload(job) });
  const prospects = data.data || data.prospects || [];
  return prospects.map((prospect) => normalizeProspect(prospect, job));
}

export async function revealExploriumEmail(contact) {
  requireExploriumKey();

  if (contact.email) return contact.email;
  if (!contact.exploriumProspectId) return "";

  const data = await exploriumPost("/prospects/contacts_information/enrich", {
    request_context: {},
    prospect_id: contact.exploriumProspectId,
    parameters: {}
  });

  return extractEmail(data.data || data);
}

async function exploriumPost(path, payload, options = {}) {
  const response = await fetch(`${EXPLORIUM_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api_key": process.env.EXPLORIUM_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 422 && options.retryPayload) {
    console.error("Explorium 422 response:", formatExploriumError(response, data));
    return exploriumPost(path, options.retryPayload);
  }

  if (!response.ok || data.response_context?.request_status === "failed") {
    const error = new Error(data.message || data.error || `Explorium request failed with ${response.status}`);
    error.status = response.status >= 500 ? 502 : response.status;
    error.publicMessage = exploriumPublicMessage(response, data);
    console.error("Explorium error response:", formatExploriumError(response, data));
    throw error;
  }

  return data;
}

function safeSearchLog(job, payload) {
  return {
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    jobLocation: job.jobLocation,
    filters: payload.filters
  };
}

function formatExploriumError(response, data) {
  return JSON.stringify({
    httpStatus: response.status,
    requestStatus: data.response_context?.request_status,
    message: data.message,
    error: data.error,
    errors: data.errors,
    detail: data.detail,
    responseContext: data.response_context
  }).slice(0, 2000);
}

function exploriumPublicMessage(response, data) {
  const message = data.message || data.error || data.detail;
  if (message) return `Explorium request failed (${response.status}): ${message}`;
  return `Explorium request failed (${response.status}). Check API key, credits, or search filters.`;
}

function fallbackPayload(job) {
  return {
    request_context: null,
    mode: "full",
    size: 25,
    page_size: 25,
    page: 1,
    exclude: null,
    next_cursor: null,
    filters: {
      company_name: { values: [job.companyName] },
      has_email: { value: true }
    }
  };
}

function normalizeProspect(prospect, job) {
  const id = prospect.prospect_id || prospect.entity_id || prospect.id;
  const company = prospect.company_name || prospect.business_name || prospect.current_company_name || job.companyName;
  const contactData = prospect.contacts_information || prospect.contact_details || prospect;
  const email = extractEmail(contactData);

  return {
    id: id || prospect.linkedin || prospect.linkedin_url || prospect.full_name,
    provider: "explorium",
    exploriumProspectId: id,
    name: prospect.full_name || prospect.name || [prospect.first_name, prospect.last_name].filter(Boolean).join(" "),
    title: prospect.job_title || prospect.title || prospect.current_title || "",
    companyName: company,
    companyDomain: prospect.company_domain || prospect.domain || "",
    location: prospect.location || prospect.city_region_country || [prospect.city, prospect.region, prospect.country_code].filter(Boolean).join(", "),
    education: prospect.education || "",
    linkedinUrl: prospect.linkedin || prospect.linkedin_url || "",
    email: "",
    emailStatus: email ? "available" : prospect.professional_email_status || prospect.email_status || ""
  };
}

function extractEmail(data) {
  if (!data) return "";
  if (typeof data.professional_email === "string") return data.professional_email;
  if (typeof data.professions_email === "string") return data.professions_email;
  if (typeof data.email === "string") return data.email;
  if (Array.isArray(data.emails)) {
    const email = data.emails.find((item) => {
      if (typeof item === "string") return item.includes("@");
      return item?.email || item?.value || item?.address;
    });
    if (typeof email === "string") return email;
    return email?.email || email?.value || email?.address || "";
  }
  return "";
}

function jobTitlesFor(jobTitle) {
  const titles = [
    "Recruiter",
    "Technical Recruiter",
    "Talent Acquisition",
    "University Recruiter",
    "People Partner",
    "Hiring Manager"
  ];

  const functional = functionalTitle(jobTitle);
  if (functional) titles.push(functional);
  if (jobTitle) titles.push(jobTitle);
  return Array.from(new Set(titles));
}

function departmentsFor(jobTitle) {
  const title = String(jobTitle || "").toLowerCase();
  const departments = ["human resources"];
  if (title.includes("finance") || title.includes("account")) departments.push("finance");
  if (title.includes("data")) departments.push("data");
  if (title.includes("engineer") || title.includes("software")) departments.push("engineering");
  if (title.includes("product")) departments.push("product");
  if (title.includes("design")) departments.push("design");
  if (title.includes("marketing")) departments.push("marketing");
  if (title.includes("sales")) departments.push("sales");
  return Array.from(new Set(departments));
}

function functionalTitle(jobTitle) {
  const title = String(jobTitle || "").toLowerCase();
  if (title.includes("finance")) return "Finance Manager";
  if (title.includes("data")) return "Data Manager";
  if (title.includes("engineer") || title.includes("software")) return "Engineering Manager";
  if (title.includes("product")) return "Product Manager";
  if (title.includes("design")) return "Design Manager";
  if (title.includes("marketing")) return "Marketing Manager";
  return "";
}

function locationFilters(jobLocation) {
  const parsed = parseUsLocation(jobLocation);
  if (!parsed.regionCode && !parsed.cityRegionCountry) return {};

  return compactObject({
    region_country_code: parsed.regionCode ? { values: [parsed.regionCode] } : undefined,
    city_region_country: parsed.cityRegionCountry ? { values: [parsed.cityRegionCountry] } : undefined
  });
}

function parseUsLocation(jobLocation) {
  const value = String(jobLocation || "");
  const stateCode = findUsStateCode(value);
  const city = value.split(",")[0]?.replace(/\b(remote|hybrid|on-site)\b/gi, "").trim();

  return {
    regionCode: stateCode ? `us-${stateCode.toLowerCase()}` : "",
    cityRegionCountry: city && stateCode ? `${city}, ${stateCode}, US` : ""
  };
}

function findUsStateCode(value) {
  const text = String(value || "").toLowerCase();
  const states = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
    connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
    illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
    maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
    mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
    pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
    "west virginia": "WV", wisconsin: "WI", wyoming: "WY"
  };

  const codeMatch = text.match(/\b([a-z]{2})\b/);
  if (codeMatch && Object.values(states).map((code) => code.toLowerCase()).includes(codeMatch[1])) {
    return codeMatch[1].toUpperCase();
  }

  for (const [name, code] of Object.entries(states)) {
    if (text.includes(name)) return code;
  }

  return "";
}

function compactObject(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([_key, value]) => {
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && "values" in value) return Array.isArray(value.values) && value.values.length > 0;
      return true;
    })
  );
}

function requireExploriumKey() {
  if (!process.env.EXPLORIUM_API_KEY) {
    const error = new Error("Missing EXPLORIUM_API_KEY.");
    error.status = 500;
    error.publicMessage = "Server is missing EXPLORIUM_API_KEY.";
    throw error;
  }
}
