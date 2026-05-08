import { searchApolloContacts, revealApolloEmail } from "./apollo.js";
import { searchExploriumContacts, revealExploriumEmail } from "./explorium.js";
import { searchMockContacts, revealMockEmail } from "./mock.js";
import { searchRapidApiContacts, revealRapidApiEmail } from "./rapidapi.js";

export function searchContacts(job) {
  switch (providerName()) {
    case "mock":
      return searchMockContacts(job);
    case "explorium":
      return searchExploriumContacts(job);
    case "apollo":
      return searchApolloContacts(job);
    case "rapidapi":
      return searchRapidApiContacts(job);
    default:
      throw providerError();
  }
}

export function revealEmail(contact) {
  if (contact.provider === "mock") return revealMockEmail(contact);
  if (contact.provider === "explorium") return revealExploriumEmail(contact);
  if (contact.provider === "apollo") return revealApolloEmail(contact);
  if (contact.provider === "rapidapi") return revealRapidApiEmail(contact);

  switch (providerName()) {
    case "mock":
      return revealMockEmail(contact);
    case "explorium":
      return revealExploriumEmail(contact);
    case "apollo":
      return revealApolloEmail(contact);
    case "rapidapi":
      return revealRapidApiEmail(contact);
    default:
      throw providerError();
  }
}

function providerName() {
  if (String(process.env.APOLLO_MOCK || "").toLowerCase() === "true") return "mock";
  return String(process.env.CONTACT_PROVIDER || "apollo").toLowerCase();
}

function providerError() {
  const error = new Error(`Unsupported CONTACT_PROVIDER: ${process.env.CONTACT_PROVIDER}`);
  error.status = 500;
  error.publicMessage = "Server contact provider is not configured correctly.";
  return error;
}
