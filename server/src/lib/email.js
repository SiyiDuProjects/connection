export function createDraft(contact, job, settings = {}) {
  const company = job.companyName || contact.companyName || "your company";
  const subject = process.env.GMAIL_SUBJECT_PREFIX || `Quick question about ${company}`;
  const firstName = String(contact.name || "").split(" ")[0] || "there";
  const titleLine = contact.title ? `I saw your work as ${articleFor(contact.title)} ${contact.title} at ${company}.` : `I came across your profile at ${company}.`;
  const targetRole = settings.target_role || job.jobTitle;
  const jobLine = targetRole ? `I'm interested in the ${targetRole} role` : `I'm interested in opportunities`;
  const senderProfile = settings.sender_profile || "I'm a Berkeley student";
  const toneLine = toneSentence(settings.email_tone);

  const body = [
    `Hi ${firstName},`,
    "",
    `${titleLine} ${jobLine} and wanted to ask if you would be open to a brief conversation or pointing me toward the right recruiting contact.`,
    "",
    `${senderProfile}${toneLine} and would really appreciate any advice on the team, the role, or the application process.`,
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

function toneSentence(tone) {
  const normalized = String(tone || "").toLowerCase();
  if (normalized.includes("concise")) return ", keeping this brief,";
  if (normalized.includes("warm")) return ", and I wanted to reach out personally,";
  if (normalized.includes("formal")) return ", and I would be grateful for your guidance,";
  return "";
}

