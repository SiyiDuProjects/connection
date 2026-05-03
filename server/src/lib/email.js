export function createDraft(contact, job) {
  const company = job.companyName || contact.companyName || "your company";
  const subject = process.env.GMAIL_SUBJECT_PREFIX || `Quick question about ${company}`;
  const firstName = String(contact.name || "").split(" ")[0] || "there";
  const titleLine = contact.title ? `I saw your work as ${articleFor(contact.title)} ${contact.title} at ${company}.` : `I came across your profile at ${company}.`;
  const jobLine = job.jobTitle ? `I'm interested in the ${job.jobTitle} role` : `I'm interested in opportunities`;

  const body = [
    `Hi ${firstName},`,
    "",
    `${titleLine} ${jobLine} and wanted to ask if you would be open to a brief conversation or pointing me toward the right recruiting contact.`,
    "",
    "I'm a Berkeley student and would really appreciate any advice on the team, the role, or the application process.",
    "",
    "Thanks,",
    ""
  ].join("\n");

  return { subject, body };
}

export function createGmailUrl(to, draft) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: draft.subject,
    body: draft.body
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function articleFor(title) {
  return /^[aeiou]/i.test(String(title || "")) ? "an" : "a";
}

