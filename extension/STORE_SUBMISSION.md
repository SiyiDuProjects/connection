# Chrome Web Store submission checklist

Reachard is still a private-beta extension. Do not switch the website CTA to `Add to Chrome` until every item below is verified.

## Package and identity

- Replace the temporary extension/store logo and verify 16, 48, and 128 pixel assets.
- Increment `manifest.json` version for the submitted build.
- Upload a ZIP containing only the extension runtime files.
- Record the Chrome Web Store extension ID, add it to `ALLOWED_EXTENSION_IDS`, and set `ALLOW_ANY_EXTENSION_ID=false` before public launch.
- Set `NEXT_PUBLIC_CHROME_STORE_URL` only after the listing is live.

## Store listing

- Single purpose: identify relevant professional contacts for a job or company page and help the user draft outreach.
- State clearly that Reachard does not guarantee referrals and does not send messages automatically.
- Provide current screenshots for a job page, company page, contact results, reveal, and draft review.
- Provide reviewer instructions for connecting a test account and reaching a non-destructive search flow.
- Add an active support method before submission.

## Privacy and permissions

- Privacy policy URL: `https://reachard.co/privacy` after that route is deployed and verified.
- Terms URL: `https://reachard.co/terms` after that route is deployed and verified.
- Disclose account data, page context, public professional data, work email reveal, local recent-find history, and service providers.
- Explain that broad page matching supports user-facing job and company pages; do not claim access that the extension does not use.
- Confirm authentication tokens and cached account status stay in `chrome.storage.local`.
- Complete the Chrome Web Store Limited Use certification.

## Release verification

- Test install, account connection, sign-out revocation, and extension update with the final store ID.
- Test LinkedIn, Greenhouse, Lever, Ashby, Workday, and a normal company site.
- Confirm the public web domain, contacts API domain, CORS settings, and extension ID allowlist.
- Run provider tests with non-sensitive fixtures and avoid automated messaging.
- Use deferred publishing so the approved build can be tested before public release.
