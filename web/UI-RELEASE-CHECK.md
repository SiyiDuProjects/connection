# HeroUI release check — 2026-09-04

Baseline: `9335de4bdba3350a4744c02933eaae8272c2f45b`.

## Existing functionality

All 19 existing page routes are retained. `/dashboard/profile` and
`/dashboard/preferences` retain their existing redirects. No API, authentication
server action, database, payment, contacts provider, or extension implementation
is changed in this release.

| Area | Retained operations |
| --- | --- |
| Homepage | Pricing, Dashboard, Chrome installation/signup, login, workspace preview, person selection, draft/copy, Open Gmail, privacy and terms |
| Authentication | Email account lookup, signup and password login; invitation, referral, price and redirect parameters preserved across forms and login/signup links |
| Account | Resume import, personal details, school lookup/selection, outreach preferences, search preferences, invite-link copy and plan management |
| Settings | Account update, password update, logout and account deletion |
| Onboarding | Resume import/removal, identity fields, company/school resolution, preferences and submit |
| Workspace | Sidebar collapse, opportunity selection/addition/status, person selection, draft creation/copy/save/close; added saved people, filters and draft persistence |
| Other | Recent outreach, admin user search/credit grant, extension connect/revoke, checkout and billing portal entry points |

The old hardcoded `123456` demonstration step and resend countdown do not send
email. The owner explicitly deferred OTP work; this release uses the existing
email/password server actions and does not claim real OTP delivery.

The audit compared business handler syntax against the baseline. Account,
onboarding, admin, settings, extension connection and billing handlers are
retained; rendering is migrated to HeroUI. Previously omitted homepage links,
Open Gmail, sidebar collapse and opportunity status were restored before release.

## Verification

- Production webpack build and TypeScript check: pass, 36 generated routes.
- Resume parsing: five tests pass (TXT, DOCX, PDF, scanned PDF rejection, file limits).
- Extension source check: pass. No paid contacts requests made.
- Browser: HeroUI fields, buttons, dropdown, radio group, listbox, modal focus trap,
  Escape dismissal, password visibility, required fields, workspace save/draft,
  sidebar collapse, opportunity status and Gmail URL checked.
- Desktop, dark appearance and 390px mobile layouts checked; no horizontal
  overflow on the checked mobile screens.
- A separate Playwright browser confirmed actual hidden form values for
  `redirect`, `priceId`, `inviteId` and `ref` after opening signup from a query URL.
- Existing business handlers and bindings were inspected for authenticated
  operations. Real checkout, paid email reveal, account deletion, password
  changes and production profile writes were not executed in this UI audit.

HeroUI OSS components cover buttons, inputs, labels, cards, avatars, dropdowns,
tabs, radios, listboxes, modals, chips and toasts. Large Pro templates remain
deferred until access is available. The component fixture is available only in
development at the existing `/workspace-preview?view=components` route.
