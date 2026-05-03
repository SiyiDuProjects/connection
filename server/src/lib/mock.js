export function searchMockContacts(job) {
  const domain = domainFromCompany(job.companyName);
  return [
    {
      id: "mock-jane",
      provider: "mock",
      name: "Jane Doe",
      title: "Senior Technical Recruiter",
      companyName: job.companyName,
      location: "San Jose, CA",
      education: "UC Berkeley",
      linkedinUrl: "",
      email: `jane.doe@${domain}`,
      emailStatus: "mock"
    },
    {
      id: "mock-john",
      provider: "mock",
      name: "John Smith",
      title: "Finance Hiring Manager",
      companyName: job.companyName,
      location: "San Francisco Bay Area",
      education: "",
      linkedinUrl: "",
      email: `john.smith@${domain}`,
      emailStatus: "mock"
    },
    {
      id: "mock-alex",
      provider: "mock",
      name: "Alex Chen",
      title: "Senior Data Analyst",
      companyName: job.companyName,
      location: "Palo Alto, CA",
      education: "University of California Berkeley",
      linkedinUrl: "",
      email: `alex.chen@${domain}`,
      emailStatus: "mock"
    }
  ];
}

export function revealMockEmail(contact) {
  return contact.email || `${slug(contact.name || "contact")}@${domainFromCompany(contact.companyName)}`;
}

function domainFromCompany(companyName) {
  const slugged = slug(companyName || "example");
  return `${slugged || "example"}.com`;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

