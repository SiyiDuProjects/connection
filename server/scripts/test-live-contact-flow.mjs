import { searchContacts, revealEmail } from "../src/lib/contacts-provider.js";
import { rankContacts } from "../src/lib/ranking.js";
import { createDraft } from "../src/lib/email.js";

const MAX_REVEAL_ATTEMPTS_PER_JOB = Math.max(1, Number(process.env.LIVE_FLOW_MAX_REVEALS || 8));

const jobs = [
  {
    source: "LinkedIn",
    type: "linkedin_job",
    companyName: "Reddit, Inc.",
    companyDomain: "redditinc.com",
    companyLinkedInUrl: "https://www.linkedin.com/company/reddit-com/",
    jobTitle: "Senior Software Engineer, Core Platform",
    originalJobTitle: "Senior Software Engineer, Core Platform",
    jobLocation: "San Francisco, CA",
    sourceUrl: "https://www.linkedin.com/jobs/view/senior-software-engineer-core-platform-at-reddit-inc-4431400939",
    jobDescription: "Build and scale the core API platform behind Reddit posts, comments, media, and listings."
  },
  {
    source: "Greenhouse",
    type: "external_job",
    companyName: "Instead",
    companyDomain: "instead.com",
    jobTitle: "Software Engineer",
    originalJobTitle: "Software Engineer",
    jobLocation: "San Francisco, CA",
    sourceUrl: "https://job-boards.greenhouse.io/instead/jobs/7761474003",
    jobDescription: "Build full-stack tax software, internal platforms, and customer-facing AI workflows."
  },
  {
    source: "Ashby",
    type: "external_job",
    companyName: "Ramp",
    companyDomain: "ramp.com",
    jobTitle: "Software Engineer, Production Engineering",
    originalJobTitle: "Software Engineer, Production Engineering",
    jobLocation: "San Francisco, CA",
    sourceUrl: "https://jobs.ashbyhq.com/ramp/be496b52-cfbf-494e-b862-61fb4a188b24",
    jobDescription: "Build and operate compute, storage, messaging, observability, and developer infrastructure."
  },
  {
    source: "Workday",
    type: "external_job",
    companyName: "Nvidia",
    companyDomain: "nvidia.com",
    jobTitle: "Software Engineer, CUDA Deep Learning Systems",
    originalJobTitle: "Software Engineer, CUDA Deep Learning Systems",
    jobLocation: "Santa Clara, CA",
    sourceUrl: "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/Software-Engineer--CUDA-Deep-Learning-Systems_JR2022831",
    jobDescription: "Prototype and optimize CUDA and distributed deep-learning systems for emerging AI workloads."
  },
  {
    source: "Indeed",
    type: "external_job",
    companyName: "Plaid",
    companyDomain: "plaid.com",
    jobTitle: "Software Engineer",
    originalJobTitle: "Software Engineer",
    jobLocation: "San Francisco, CA",
    sourceUrl: "https://www.indeed.com/viewjob?jk=d9d127c1af4d092d",
    jobDescription: "Design reliable backend or full-stack systems and APIs for financial-data products."
  }
];
const sourceFilter = String(process.argv[2] || "").trim().toLowerCase();
const selectedJobs = sourceFilter
  ? jobs.filter((job) => job.source.toLowerCase() === sourceFilter)
  : jobs;

const draftSettings = {
  sender_name: "Reachard QA",
  sender_profile: "I'm exploring software engineering opportunities and am interested in learning how this team approaches its work.",
  email_tone: "warm",
  outreach_length: "concise",
  outreach_goal: "advice",
  email_signature: "Reachard QA"
};

const usageBefore = await hunterUsage();
const results = [];

for (const job of selectedJobs) {
  const startedAt = Date.now();
  try {
    const contacts = await searchContacts(job);
    const ranked = rankContacts(contacts, job).slice(0, 10);
    const withLinkedIn = ranked.filter((contact) => Boolean(contact.linkedinUrl));
    const revealable = withLinkedIn.slice(0, MAX_REVEAL_ATTEMPTS_PER_JOB);
    let selected = null;
    let email = "";
    let revealAttempts = 0;

    for (const contact of revealable) {
      revealAttempts += 1;
      email = await revealEmail(contact);
      if (email) {
        selected = { ...contact, email };
        break;
      }
    }

    const draft = selected ? await createDraft(selected, job, draftSettings) : null;
    results.push({
      source: job.source,
      company: job.companyName,
      jobTitle: job.jobTitle,
      sourceUrl: job.sourceUrl,
      durationMs: Date.now() - startedAt,
      candidates: ranked.length,
      linkedinProfiles: withLinkedIn.length,
      topMatches: ranked.slice(0, 3).map((contact) => ({
        name: contact.name,
        title: contact.title,
        score: contact.matchScore,
        linkedin: Boolean(contact.linkedinUrl)
      })),
      revealAttempts,
      emailFound: Boolean(email),
      maskedEmail: maskEmail(email),
      selectedContact: selected ? { name: selected.name, title: selected.title } : null,
      draft: draft ? {
        generated: true,
        aiUsed: Boolean(draft.ai?.used),
        provider: draft.ai?.provider || "template",
        subjectLength: draft.subject.length,
        bodyLength: draft.body.length,
        warnings: draft.warnings || []
      } : { generated: false }
    });
  } catch (error) {
    results.push({
      source: job.source,
      company: job.companyName,
      jobTitle: job.jobTitle,
      sourceUrl: job.sourceUrl,
      durationMs: Date.now() - startedAt,
      candidates: 0,
      linkedinProfiles: 0,
      revealAttempts: 0,
      emailFound: false,
      draft: { generated: false },
      error: String(error?.message || error)
    });
  }
}

const usageAfter = await hunterUsage();
const report = {
  ranAt: new Date().toISOString(),
  provider: process.env.CONTACT_PROVIDER || "rapidapi",
  revealProvider: "hunter",
  maxRevealAttemptsPerJob: MAX_REVEAL_ATTEMPTS_PER_JOB,
  hunterCredits: {
    before: usageBefore,
    after: usageAfter,
    consumed: usageBefore && usageAfter ? Math.max(0, usageAfter.used - usageBefore.used) : null
  },
  totals: {
    jobs: results.length,
    searchesWithCandidates: results.filter((result) => result.candidates > 0).length,
    searchesWithLinkedInProfiles: results.filter((result) => result.linkedinProfiles > 0).length,
    emailsFound: results.filter((result) => result.emailFound).length,
    draftsGenerated: results.filter((result) => result.draft.generated).length
  },
  results
};

console.log(`REACHARD_LIVE_FLOW_REPORT=${JSON.stringify(report)}`);

if (report.totals.searchesWithCandidates !== selectedJobs.length) process.exitCode = 1;
if (report.totals.searchesWithLinkedInProfiles !== selectedJobs.length) process.exitCode = 1;

async function hunterUsage() {
  if (!process.env.HUNTER_API_KEY) return null;
  const response = await fetch("https://api.hunter.io/v2/account", {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${process.env.HUNTER_API_KEY}`
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const credits = body.data?.requests?.credits || body.data?.requests?.searches;
  return credits ? { used: Number(credits.used || 0), available: Number(credits.available || 0) } : null;
}

function maskEmail(value) {
  const [local, domain] = String(value || "").split("@");
  if (!local || !domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}
