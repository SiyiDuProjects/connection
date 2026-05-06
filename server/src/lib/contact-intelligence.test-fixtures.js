import assert from "node:assert/strict";
import { buildPeopleSearchPlan, normalizeContactForScoring, rankCandidatesV2, scoreCandidate } from "./contact-intelligence.js";

const productJob = {
  companyName: "Acme",
  companyDomain: "acme.com",
  jobTitle: "Product Manager, Growth",
  jobLocation: "San Francisco, CA",
  jobDescription: "Own activation and retention for the growth product team."
};

const engineeringJob = {
  companyName: "Acme",
  companyDomain: "acme.com",
  jobTitle: "Software Engineer, Platform",
  jobLocation: "San Francisco, CA",
  jobDescription: "Build internal platform and infrastructure."
};

const dataJob = {
  companyName: "Acme",
  companyDomain: "acme.com",
  jobTitle: "Data Scientist, Analytics",
  jobDescription: "Work on analytics and machine learning."
};

const recruitingJob = {
  companyName: "Acme",
  companyDomain: "acme.com",
  jobTitle: "Technical Recruiter",
  jobDescription: "Own sourcing for engineering hiring."
};

function run() {
  const productDirector = scoreCandidate({
    provider: "apollo",
    apolloId: "p1",
    name: "Pat Product",
    title: "Director of Product, Growth",
    companyName: "Acme",
    companyDomain: "acme.com",
    location: "San Francisco, CA",
    education: "UC Berkeley",
    linkedinUrl: "https://linkedin.com/in/pat",
    emailStatus: "verified"
  }, productJob);

  const ceo = scoreCandidate({
    provider: "apollo",
    apolloId: "p2",
    name: "Casey CEO",
    title: "CEO",
    companyName: "Acme",
    companyDomain: "acme.com",
    linkedinUrl: "https://linkedin.com/in/casey",
    emailStatus: "verified"
  }, productJob);

  assert.ok(productDirector.matchScore >= 85, `product director should be strong, got ${productDirector.matchScore}`);
  assert.ok(ceo.matchScore < productDirector.matchScore, "CEO should not outrank product director for product role");
  assert.ok(ceo.warnings.includes("Executive title only weakly matches this role"));

  const engineeringManager = scoreCandidate({
    provider: "explorium",
    exploriumProspectId: "e1",
    name: "Eli Eng",
    title: "Engineering Manager, Platform",
    companyName: "Acme",
    companyDomain: "acme.com",
    location: "San Francisco, CA",
    linkedinUrl: "https://linkedin.com/in/eli",
    emailStatus: "available"
  }, engineeringJob);

  const cto = scoreCandidate({
    provider: "apollo",
    apolloId: "e2",
    name: "Taylor CTO",
    title: "CTO",
    companyName: "Acme",
    companyDomain: "acme.com",
    linkedinUrl: "https://linkedin.com/in/taylor",
    emailStatus: "verified"
  }, engineeringJob);

  assert.ok(engineeringManager.matchScore >= 70, `engineering manager should be good, got ${engineeringManager.matchScore}`);
  assert.ok(cto.matchScore < engineeringManager.matchScore, "CTO should not automatically outrank direct engineering manager");

  const dataManager = scoreCandidate({
    name: "Dana Data",
    title: "Data Science Manager, Analytics",
    companyName: "Acme",
    companyDomain: "acme.com",
    linkedinUrl: "https://linkedin.com/in/dana",
    emailStatus: "verified"
  }, dataJob);

  const genericHr = scoreCandidate({
    name: "Harper HR",
    title: "HR Business Partner",
    companyName: "Acme",
    companyDomain: "acme.com",
    linkedinUrl: "https://linkedin.com/in/harper",
    emailStatus: "verified"
  }, dataJob);

  assert.ok(dataManager.matchScore > genericHr.matchScore, "data manager should outrank generic HR for data role");

  const rankedRecruiting = rankCandidatesV2([
    { name: "Sam Sales", title: "VP Sales", companyName: "Acme", companyDomain: "acme.com" },
    { name: "Riley Recruiter", title: "Technical Recruiter", companyName: "Acme", companyDomain: "acme.com" }
  ], recruitingJob);

  assert.equal(rankedRecruiting[0].title, "Technical Recruiter");

  const missingEducation = scoreCandidate({
    name: "No School",
    title: "Technical Recruiter",
    companyName: "Acme",
    companyDomain: "acme.com"
  }, recruitingJob);

  assert.ok(missingEducation.missingFields.includes("education"));
  assert.notEqual(missingEducation.matchLabel, "weak");

  const normalizedApollo = normalizeContactForScoring({
    person_id: "apollo-1",
    name: "Apollo Person",
    title: "Product Manager",
    organization: { name: "Acme", primary_domain: "acme.com" }
  }, productJob);
  const normalizedExplorium = normalizeContactForScoring({
    prospect_id: "explorium-1",
    full_name: "Explorium Person",
    job_title: "Technical Recruiter",
    company_name: "Acme"
  }, recruitingJob);

  assert.equal(normalizedApollo.provider, "apollo");
  assert.equal(normalizedExplorium.provider, "explorium");

  const searchPlan = buildPeopleSearchPlan(productJob);
  assert.equal(searchPlan.excludeBroadExecutives, true);
  assert.ok(searchPlan.apollo.person_titles.includes("Director of Product"));
  assert.deepEqual(searchPlan.apollo.q_organization_domains_list, ["acme.com"]);

  console.log("contact-intelligence fixtures passed");
}

run();
