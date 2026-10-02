# Chrome Web Store Listing — Reachard

Last updated: 2026-09-20. Local candidate: 0.7.6. Not uploaded or published by this repair.

## Listing

Name: Reachard. Short description: Find company contacts from job pages, company sites, and LinkedIn profiles.

Language: English. Category: Workflow & Planning (confirm the dashboard category when submitting). Single purpose: Find relevant company contacts and prepare outreach from the page the user chooses.

Detailed listing copy, historical graphics and reviewer instructions: [STORE_SUBMISSION.md](extension/STORE_SUBMISSION.md). Preserve its sample-data labels; do not treat historical reviewer access or deployment claims as verified for this candidate.

## Permissions and privacy

| Permission or host | User-facing reason |
| --- | --- |
| storage | Remember the account connection and safely recover interrupted requests. |
| sidePanel | Show contacts and editable drafts beside the selected page. |
| activeTab / scripting | Read another website only after the user invokes the toolbar action. |
| reachard.co / www.reachard.co | Connect the signed-in account and save outreach preferences. |
| contacts.reachard.co | Search contacts, reveal verified work email and prepare requested drafts. |

Automatic recognition stays limited to LinkedIn, Greenhouse, Lever, Ashby and Workday. The production package excludes development localhost hosts. It contains no remote executable code.

The existing account, profile, selected page context, contact and draft data flows remain described in the [privacy source](web/app/(dashboard)/privacy/page.tsx). This version additionally retains local hashed operation references, random retry IDs and timestamps until confirmation, across background/browser restarts. No raw request bodies or contact details are stored in those retry records. Unknown outcomes older than the replay safety window require support rather than risking another charge. Records are not synced; uninstall removes local storage.

Policy URL: https://reachard.co/privacy. Support: support@reachard.co / https://reachard.co/support. Homepage: https://reachard.co. No new data recipient, permission or automated email sending is introduced. Data is not sold, used for unrelated purposes or used for lending decisions.

## Assets and distribution

Manifest PNG icons exist at 16, 32, 48 and 128 pixels. Existing sample screenshots are catalogued in the historical submission pack; unchanged normal screens do not require new marketing imagery for these fixes. Verify screenshots against the final package before submission.

Publisher identity, visibility, regions, current reviewer account validity and live privacy publication must be confirmed in the existing developer dashboard. This task does not change them.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| 0.7.6 | 2026-09-20 | Keeps account preferences isolated during account switching; protects a new login from old responses; safely retries interrupted requests. | Local candidate |

## Verification

See `artifacts/audit-20260920/REMEDIATION.md` for current test, build, dependency and isolated-browser results. This is not evidence of store submission, production payment acceptance or live provider testing.
