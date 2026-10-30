import { searchMockContacts, revealMockEmail } from './mock.js';
import { searchTregContacts, revealTregEmail } from './treg.js';

function providerName() {
  const name = String(process.env.CONTACT_PROVIDER || 'treg').toLowerCase();
  if (!['treg', 'mock'].includes(name)) {
    const error = new Error('Unsupported CONTACT_PROVIDER');
    error.status = 500;
    error.publicMessage = 'Contact provider is not configured correctly.';
    throw error;
  }
  return name;
}
export function searchContacts(job, request) {
  return providerName() === 'mock' ? searchMockContacts(job) : searchTregContacts(job, request);
}
export function revealEmail(contact, request) {
  return providerName() === 'mock' ? revealMockEmail(contact) : revealTregEmail(contact, request);
}
