import assert from 'node:assert/strict';
import { contactPhotoUrl } from './contact-photo.js';
import { normalizeContactForScoring } from './contact-intelligence.js';

const image = 'https://media.licdn.com/dms/image/fixture/photo.jpg?e=123&v=beta&t=fixture';
for (const key of ['photoUrl', 'photo_url', 'avatarUrl', 'profile_picture_url']) {
  assert.equal(contactPhotoUrl({ [key]: image }), image);
  assert.equal(normalizeContactForScoring({ name: 'Example', [key]: image }).photoUrl, image);
}
assert.equal(contactPhotoUrl({ profilePicture: { url: image } }), image);
assert.equal(contactPhotoUrl({ linkedinUrl: 'https://www.linkedin.com/in/example' }), '');
for (const photoUrl of ['javascript:alert(1)', 'data:image/png;base64,abc', 'http://example.com/a.jpg', 'https://user:pass@example.com/a.jpg', 'not a url']) {
  assert.equal(contactPhotoUrl({ photoUrl }), '');
}
assert.equal(contactPhotoUrl({ photoUrl: 'invalid', photo_url: image }), image);
console.log('Contact portraits: URL preservation, aliases, missing images and invalid sources passed.');
