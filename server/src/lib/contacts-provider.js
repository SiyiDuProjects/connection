import { searchApolloContacts, revealApolloEmail } from "./apollo.js";
import { searchExploriumContacts, revealExploriumEmail } from "./explorium.js";
import { searchMockContacts, revealMockEmail } from "./mock.js";
import { searchRapidApiContacts, revealRapidApiEmail } from "./rapidapi.js";
import { searchTregContacts, revealTregEmail } from "./treg.js";
import { providerBudgetEnabled } from './spend-budget.js';

export function searchContacts(job, request) {
  switch (providerName()) {
    case "mock":
      return searchMockContacts(job);
    case "explorium":
      return searchExploriumContacts(job);
    case "apollo":
      return searchApolloContacts(job);
    case "rapidapi":
      return searchRapidApiContacts(job);
    case "treg":
      return searchTregContacts(job, request);
    default:
      throw providerError();
  }
}

export function revealEmail(contact, request) {
  switch (providerName()) {
    case "mock":
      return revealMockEmail(contact);
    case "explorium":
      return revealExploriumEmail(contact);
    case "apollo":
      return revealApolloEmail(contact);
    case "rapidapi":
      return revealRapidApiEmail(contact);
    case "treg":
      return revealTregEmail(contact, request);
    default:
      throw providerError();
  }
}

function providerName() {
  if (String(process.env.APOLLO_MOCK || "").toLowerCase() === "true") return "mock";
  const name = String(process.env.CONTACT_PROVIDER || "treg").toLowerCase();
  if (providerBudgetEnabled() && !['treg', 'mock'].includes(name)) throw providerError();
  return name;
}

function providerError() {
  const error = new Error(`Unsupported CONTACT_PROVIDER: ${process.env.CONTACT_PROVIDER}`);
  error.status = 500;
  error.publicMessage = "Server contact provider is not configured correctly.";
  return error;
}
