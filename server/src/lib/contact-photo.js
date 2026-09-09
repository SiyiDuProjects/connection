// Preserve a provider-supplied portrait; never derive an image URL from a profile URL.
export function contactPhotoUrl(person = {}) {
  const values = [person.photoUrl, person.photo_url, person.avatarUrl, person.avatar_url,
    person.profilePictureUrl, person.profile_picture_url, person.profileImageUrl,
    person.profile_image_url, person.profilePicture, person.profile_picture,
    person.pictureUrl, person.picture_url, person.photo, person.avatar];
  for (const value of values) {
    const source = typeof value === 'string' ? value : value?.url;
    if (!source) continue;
    try {
      const url = new URL(source);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* Missing or malformed provider images use the initials fallback. */ }
  }
  return '';
}
