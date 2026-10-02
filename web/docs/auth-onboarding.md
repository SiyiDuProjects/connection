# Account entry and first-use flow

Anonymous marketing actions lead to the shared email/password form. Existing
accounts sign in; new accounts must verify their email before a session is set.
Already authenticated visitors see Dashboard in marketing CTAs and are redirected
away from `/sign-in` and `/sign-up`. An authenticated checkout entry preserves its
price and requires an explicit Continue to checkout action; a GET never starts
checkout. Internal extension callbacks remain intact.

`AccountEntry` uses the shared `/api/user` SWR key with a no-store request. While
checking an unknown or cached signed-out state it shows a disabled pending entry;
network errors do not masquerade as a confirmed sign-out. The API is private and
uncacheable. Session cookies remain HTTP-only, same-site lax, root-scoped and valid
for one day with renewal on page GETs. Production cookies require HTTPS. Invalid
cookies resolve to signed-out state and are cleared on the redirect response.

After verification, onboarding asks for name, school/affiliation and either a
short background or a resume. Email is not requested again. Region and outreach
preferences remain available in My profile but are not onboarding requirements.

On Dashboard, a read-only extension bridge status check controls a dismissible
setup prompt. A detected extension suppresses that prompt. Dismissal is per user
and browser in localStorage, with an in-memory fallback. Installation detection
timeouts mean unconfirmed, not proof of absence. A Quick start link remains in
the Dashboard header and leads to `/getting-started`.

The public guide has four visual steps: welcome, pin the extension, account,
and first search. It supports back, skip, replay, and an internal return URL
after authentication. Extension 0.7.2 opens this guide on first installation.
All installation actions use the published listing in `lib/extension-store.ts`.
Opening an email composer is not confirmation of delivery.

`/ui-preview/first-run` is local-only and uses the actual onboarding form with
saving disabled and a manually opened native welcome dialog. It does not create
an account, save a profile, grant credits, or send mail.

Regression checks: `node --test scripts/auth-session.test.mjs
scripts/email-verification.test.mjs scripts/billing.test.mjs
scripts/dashboard.test.mjs`, followed by the UI boundary check and build.
