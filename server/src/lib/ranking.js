import { scoreCandidate } from "./contact-intelligence.js";

export function rankContacts(contacts, job) {
  return contacts
    .map((contact) => {
      const intelligence = scoreCandidate(contact, job);
      return {
        ...contact,
        score: intelligence.matchScore,
        reasons: intelligence.reasons
      };
    })
    .sort((first, second) => second.score - first.score);
}
