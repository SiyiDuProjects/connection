import assert from "node:assert/strict";
import { buildPeopleSearchPlan, normalizeContactForScoring, rankCandidatesV2, scoreCandidate } from "./contact-intelligence.js";

const jobs = {
  productGrowth: {
    companyName: "Acme",
    companyDomain: "acme.com",
    jobTitle: "Product Manager, Growth",
    jobLocation: "San Francisco, CA",
    jobDescription: "Own activation, retention, lifecycle experiments, and growth product analytics."
  },
  platformEngineer: {
    companyName: "Acme",
    companyDomain: "acme.com",
    jobTitle: "Software Engineer, Platform",
    jobLocation: "San Francisco, CA",
    jobDescription: "Build internal developer platform, infrastructure, cloud tooling, and services for product teams."
  },
  dataAnalytics: {
    companyName: "Acme",
    companyDomain: "acme.com",
    jobTitle: "Data Scientist, Analytics",
    jobLocation: "New York, NY",
    jobDescription: "Partner with product and growth teams on analytics, experimentation, and machine learning."
  },
  technicalRecruiting: {
    companyName: "Acme",
    companyDomain: "acme.com",
    jobTitle: "Technical Recruiter",
    jobLocation: "Remote",
    jobDescription: "Source engineering candidates and work with hiring managers for platform and AI roles."
  }
};

const apolloSearchResponse = {
  people: [
    apolloPerson("p01", "Avery Product", "Director of Product, Growth", "Product", "Growth", { education: ["UC Berkeley"], linkedin: true, emailStatus: "verified" }),
    apolloPerson("p02", "Blair Growth", "Group Product Manager, Growth", "Product", "Growth", { education: ["Stanford University"], linkedin: true, emailStatus: "verified" }),
    apolloPerson("p03", "Casey Product", "Product Manager, Activation", "Product", "Growth", { linkedin: true, emailStatus: "likely to engage" }),
    apolloPerson("p04", "Devon Product Ops", "Product Operations Manager", "Product", "Operations", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p05", "Emerson CEO", "CEO", "Executive", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p06", "Finley Founder", "Founder", "Executive", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p07", "Gray CTO", "CTO", "Engineering", "Platform", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p08", "Harper Platform", "Engineering Manager, Platform", "Engineering", "Platform", { education: ["MIT"], linkedin: true, emailStatus: "verified" }),
    apolloPerson("p09", "Indigo Infra", "Director of Engineering, Infrastructure", "Engineering", "Infrastructure", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p10", "Jordan Staff", "Staff Software Engineer, Developer Platform", "Engineering", "Platform", { linkedin: true, emailStatus: "likely to engage" }),
    apolloPerson("p11", "Kai Backend", "Senior Backend Engineer", "Engineering", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p12", "Logan Security", "Security Engineering Manager", "Engineering", "Security", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p13", "Morgan Data", "Data Science Manager, Analytics", "Data", "Analytics", { education: ["UC Berkeley"], linkedin: true, emailStatus: "verified", location: "New York, NY" }),
    apolloPerson("p14", "Nico Analytics", "Director of Analytics", "Data", "Analytics", { linkedin: true, emailStatus: "verified", location: "New York, NY" }),
    apolloPerson("p15", "Oak ML", "Machine Learning Manager", "Data", "AI", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p16", "Parker BI", "Business Intelligence Analyst", "Data", "Analytics", { emailStatus: "unverified", location: "New York, NY" }),
    apolloPerson("p17", "Quinn HR", "HR Business Partner", "People", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p18", "Reese Talent", "Talent Acquisition Partner", "People", "Recruiting", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p19", "Sage Tech Recruiter", "Senior Technical Recruiter", "People", "Technical Recruiting", { education: ["UC Berkeley"], linkedin: true, emailStatus: "verified" }),
    apolloPerson("p20", "Tatum Campus", "University Recruiter", "People", "University Recruiting", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p21", "Uma Sourcer", "Technical Sourcer, Engineering", "People", "Technical Recruiting", { linkedin: true, emailStatus: "likely to engage" }),
    apolloPerson("p22", "Vale Sales", "VP Sales", "Sales", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p23", "Wren Marketing", "Growth Marketing Manager", "Marketing", "Growth", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p24", "Xen Finance", "Finance Manager", "Finance", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p25", "Yael Legal", "Legal Counsel", "Legal", "", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p26", "Zion Design", "Product Design Manager", "Design", "Product", { linkedin: true, emailStatus: "verified" }),
    apolloPerson("p27", "Alex Missing", "Product Manager, Growth", "Product", "Growth", { companyDomain: "", companyName: "Acme", emailStatus: "" }),
    apolloPerson("p28", "Bailey Other Co", "Director of Product, Growth", "Product", "Growth", { companyName: "OtherCo", companyDomain: "otherco.com", linkedin: true, emailStatus: "verified" }),
    exploriumProspect("x01", "Chris Explorium Recruiter", "Technical Recruiter", { education: "UC Berkeley", linkedin: true }),
    exploriumProspect("x02", "Drew Explorium Product", "Head of Product, Growth", { education: "", linkedin: true }),
    mockContact("m01", "Ellis Mock Data", "Data Science Manager, Analytics")
  ]
};

function run() {
  assertSearchPlanShape();
  assertProductGrowthRanking();
  assertPlatformEngineeringRanking();
  assertDataRanking();
  assertRecruitingRanking();
  assertBulkNormalization();
  console.log("contact-intelligence large fixtures passed");
}

function assertSearchPlanShape() {
  const plan = buildPeopleSearchPlan(jobs.platformEngineer);
  assert.equal(plan.apollo.include_similar_titles, false);
  assert.ok(plan.apollo.person_titles.includes("Engineering Manager"));
  assert.ok(plan.apollo.person_titles.includes("Technical Recruiter"));
  assert.deepEqual(plan.apollo.q_organization_domains_list, ["acme.com"]);
  assert.equal(plan.excludeBroadExecutives, true);
}

function assertProductGrowthRanking() {
  const ranked = rankedFor(jobs.productGrowth);
  const topFive = ranked.slice(0, 5).map((contact) => contact.intelligence.name);
  assert.ok(topFive.includes("Avery Product"), `expected product leader in top five, got ${topFive.join(", ")}`);
  assert.ok(topFive.includes("Blair Growth"), `expected growth PM in top five, got ${topFive.join(", ")}`);
  assert.ok(topFive.includes("Casey Product"), `expected product manager in top five, got ${topFive.join(", ")}`);
  assertBefore(ranked, "Avery Product", "Emerson CEO");
  assertBefore(ranked, "Blair Growth", "Gray CTO");
  assertBelow(ranked, "Emerson CEO", 70);
}

function assertPlatformEngineeringRanking() {
  const ranked = rankedFor(jobs.platformEngineer);
  const topFour = ranked.slice(0, 4).map((contact) => contact.intelligence.name);
  assert.ok(topFour.includes("Harper Platform"), `expected platform EM in top four, got ${topFour.join(", ")}`);
  assert.ok(topFour.includes("Jordan Staff"), `expected staff platform engineer in top four, got ${topFour.join(", ")}`);
  assertBefore(ranked, "Harper Platform", "Gray CTO");
  assertBefore(ranked, "Jordan Staff", "Emerson CEO");
}

function assertDataRanking() {
  const ranked = rankedFor(jobs.dataAnalytics);
  const topThree = ranked.slice(0, 3).map((contact) => contact.intelligence.name);
  assert.ok(topThree.includes("Morgan Data"), `expected data science manager in top three, got ${topThree.join(", ")}`);
  assert.ok(topThree.includes("Nico Analytics"), `expected analytics director in top three, got ${topThree.join(", ")}`);
  assertBefore(ranked, "Morgan Data", "Quinn HR");
  assertBefore(ranked, "Nico Analytics", "Vale Sales");
}

function assertRecruitingRanking() {
  const ranked = rankedFor(jobs.technicalRecruiting);
  const topThree = ranked.slice(0, 3).map((contact) => contact.intelligence.name);
  assert.ok(topThree.includes("Sage Tech Recruiter"), `expected technical recruiter in top three, got ${topThree.join(", ")}`);
  assert.ok(topThree.includes("Uma Sourcer"), `expected technical sourcer in top three, got ${topThree.join(", ")}`);
  assertBefore(ranked, "Sage Tech Recruiter", "Vale Sales");
  assertBefore(ranked, "Uma Sourcer", "Quinn HR");
}

function assertBulkNormalization() {
  const normalized = apolloSearchResponse.people.map((contact) => normalizeContactForScoring(contact, jobs.productGrowth));
  assert.equal(normalized.find((contact) => contact.id === "p01").provider, "apollo");
  assert.equal(normalized.find((contact) => contact.id === "x01").provider, "explorium");
  assert.equal(normalized.find((contact) => contact.id === "m01").provider, "mock");
  assert.ok(scoreCandidate(apolloSearchResponse.people[26], jobs.productGrowth).missingFields.includes("LinkedIn URL"));
}

function rankedFor(job) {
  return rankCandidatesV2(apolloSearchResponse.people, job);
}

function assertBefore(ranked, firstName, secondName) {
  const firstIndex = ranked.findIndex((contact) => contact.intelligence.name === firstName);
  const secondIndex = ranked.findIndex((contact) => contact.intelligence.name === secondName);
  assert.notEqual(firstIndex, -1, `${firstName} not found`);
  assert.notEqual(secondIndex, -1, `${secondName} not found`);
  assert.ok(firstIndex < secondIndex, `${firstName} should rank before ${secondName}`);
}

function assertBelow(ranked, name, score) {
  const item = ranked.find((contact) => contact.intelligence.name === name);
  assert.ok(item, `${name} not found`);
  assert.ok(item.intelligence.matchScore < score, `${name} should score below ${score}, got ${item.intelligence.matchScore}`);
}

function apolloPerson(id, name, title, department, team, options = {}) {
  const [firstName, ...lastNameParts] = name.split(" ");
  const companyName = options.companyName ?? "Acme";
  const companyDomain = options.companyDomain ?? "acme.com";
  return {
    id,
    first_name: firstName,
    last_name: lastNameParts.join(" "),
    name,
    title,
    city: cityFromLocation(options.location || "San Francisco, CA"),
    state: stateFromLocation(options.location || "San Francisco, CA"),
    country: "United States",
    linkedin_url: options.linkedin ? `https://www.linkedin.com/in/${id}` : "",
    email_status: options.emailStatus ?? "verified",
    departments: department ? [department] : [],
    subdepartments: team ? [team] : [],
    organization: {
      id: "org-acme",
      name: companyName,
      primary_domain: companyDomain,
      website_url: companyDomain ? `https://${companyDomain}` : "",
      industry: "Software",
      estimated_num_employees: 850
    },
    employment_history: [
      { organization_name: companyName, title, current: true }
    ],
    education: (options.education || []).map((school) => ({ school_name: school }))
  };
}

function exploriumProspect(id, name, title, options = {}) {
  return {
    prospect_id: id,
    full_name: name,
    job_title: title,
    company_name: "Acme",
    company_domain: "acme.com",
    location: "San Francisco, CA",
    education: options.education || "",
    linkedin_url: options.linkedin ? `https://www.linkedin.com/in/${id}` : "",
    professional_email_status: "available"
  };
}

function mockContact(id, name, title) {
  return {
    id,
    provider: "mock",
    name,
    title,
    companyName: "Acme",
    companyDomain: "acme.com",
    location: "New York, NY",
    mockEmail: `${id}@acme.com`,
    emailStatus: "mock"
  };
}

function cityFromLocation(location) {
  return String(location).split(",")[0]?.trim() || "";
}

function stateFromLocation(location) {
  return String(location).split(",")[1]?.trim() || "";
}

run();
