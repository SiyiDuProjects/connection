const CHROME_EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

export function isValidExtensionId(extensionId: string) {
  return CHROME_EXTENSION_ID_PATTERN.test(extensionId);
}

export function isOpenExtensionIdBeta() {
  const configured = String(process.env.ALLOW_ANY_EXTENSION_ID || '').trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(configured)) return false;
  if (['1', 'true', 'yes', 'on'].includes(configured)) return true;

  // Private-beta default. Set ALLOW_ANY_EXTENSION_ID=false before public launch.
  return true;
}

export function getAllowedExtensionIds() {
  return [
    process.env.ALLOWED_EXTENSION_IDS,
    process.env.CHROME_EXTENSION_ID,
    process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(isValidExtensionId);
}

export function getDefaultExtensionId() {
  return getAllowedExtensionIds()[0] || '';
}
