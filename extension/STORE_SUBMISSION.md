# Reachard Chrome Web Store submission pack

Prepared September 7, 2026. Candidate version: **0.7.1**. The owner previously uploaded 0.7.0 with extension ID `ladoemfclhhepfomibkdblodgnhceefm`; replace it with this reduced-permission package. Production website and API allowlists accept the same ID. This replacement has not been uploaded or submitted by the agent.

The owner has requested early review submission. Complete reviewer access and the submission requirements below, then submit with deferred publishing while the remaining website and paid-launch work continues. Full public billing acceptance is not a prerequisite for this sequence when reviewers can already use every advertised extension feature without making a purchase.

## Output files

All deliverables are in `artifacts/launch-20260907/store/`.

| Item | File |
| --- | --- |
| Upload ZIP | `reachard-0.7.1-chrome-store.zip` |
| Exact contents, validation and SHA-256 | `package-report.json` |
| Production manifest | `production-manifest.json` |
| Paste-ready listing fields and full guide | `listing.json`, `submission-guide.md` |
| Store icon | `store-icon-128.png` |
| Screenshots, suggested order | `01-current-role-1280x800.png`, `02-find-people-1280x800.png`, `03-review-draft-1280x800.png`, `04-work-email-1280x800.png`, `05-personalize-1280x800.png` |
| Small promotional tile | `promo-small-440x280.png` |
| Optional marquee | `promo-marquee-1400x560.png` |
| Screenshot provenance | `screenshot-report.json` |

Screenshots render the actual packaged UI/controller using simulated Chrome APIs and fictional job/contact data. Every screenshot visibly says **Sample data**. They demonstrate the interface, not a live provider search or native installed-extension test. No paid provider, real contact, private resume, or email sending is used. Keep the sample-data labels.

## Rebuild

Run from the repository root after final source/brand edits:

```text
node scripts/build-extension-ui.mjs
node scripts/check-extension.mjs
node scripts/capture-chrome-store.mjs
node scripts/prepare-chrome-store.mjs
```

The UI build synchronizes the display brand first. The capture script uses installed Chrome in a dedicated headless session and localhost port 3027, blocks external requests, and uses an installed `playwright` package or the desktop bundled runtime. On another computer, `PLAYWRIGHT_MODULES` can specify the directory containing that package.

The reproducible ZIP uses a runtime-file allowlist and excludes source maps, fixtures, submission notes, secrets, and retired assets. The output manifest removes development localhost entries. Automatic content scripts are limited to the named hiring sites below. Other websites use temporary `activeTab` access and bundled `scripting` after a toolbar click. There are no all-site matches or optional host permissions.

The packager first checks generated brand files. Real unpacked runtime evidence is in `artifacts/launch-20260907/runtime-check-0.7.1/runtime-report.json`: Chrome reports access to some websites, not all websites. Named-site automatic entry, toolbar-granted temporary access elsewhere, cross-origin revocation, native panel, and signed-out account checks passed with local fixtures. Production store-ID configuration and website reviewer login are separately verified; a signed-in extension workflow using the formal ID remains to be tested.

## Listing — English copy

**Name:** Reachard

Use `brand/brand.json` if the display name changes before submission. The Chrome dashboard listing itself cannot update automatically from a repository file.

**Short description:** Find company contacts from job pages, company sites, and LinkedIn profiles.

**Language:** English

**Category:** Workflow & Planning.

**Detailed description:**

Reachard helps you find the people behind the job you want and prepare a thoughtful first message.

Open a job posting, company website, or public LinkedIn profile. On LinkedIn, Greenhouse, Lever, Ashby and Workday, Reachard's entry point appears automatically. On other websites, click the Reachard icon in Chrome's toolbar to read that page and open the side panel:

- Find professional contacts at the relevant company.
- Review each person's role and the available reasons for the match.
- Look up a verified work email when available and prepare an outreach draft.
- Adjust your message goal, tone, length, and personal context.
- Review and edit the draft, then copy it or open it in your email app.

You decide what to send and when. Reachard does not send outreach automatically and does not guarantee contact availability, replies, referrals, interviews, or employment.

A Reachard account is required. Contact features require an eligible plan and available included usage. Current plans and limits are shown at https://reachard.co/pricing. Search and draft actions do not deduct app credits; a verified work-email reveal uses one credit. A lookup may return no verified email.

Page access lets Reachard recognize job and company context across different websites. Page context is processed locally for recognition and sent to Reachard when you request search, reveal, or drafting. When you choose Sign in from a page, its URL may also be included in the sign-in return link so you can resume where you left off. Our service providers process the data needed for those features, as described in our privacy policy. Screenshots show fictional sample data.

Website: https://reachard.co
Privacy: https://reachard.co/privacy
Support: support@reachard.co

**Homepage URL:** https://reachard.co

**Privacy URL:** https://reachard.co/privacy

**Support page URL:** https://reachard.co/support

**Support email:** support@reachard.co

**Terms:** https://reachard.co/terms

The public support page at https://reachard.co/support is deployed and verified in a production browser. Use that HTTPS URL in Support page URL; use support@reachard.co only in an email field. This verifies the support page, not real billing transactions or the full signed-in extension workflow.

## Privacy practices — source-based answers

**Single purpose:** Help a user identify relevant professional contacts for the job, company, or public professional profile they are viewing and prepare an outreach draft they review and send themselves.

### Permissions

**storage:** Stores the extension authentication token and cached account status in Chrome local storage, plus the page launcher's position. Non-sensitive Reachard service URLs use Chrome sync storage. Message preferences save to the Reachard account. Current contact results and drafts remain in the open panel's memory, not a durable local contacts or sent-mail archive.

**sidePanel:** Displays the user-invoked contact and draft workflow in Chrome's native side panel while the current source page stays visible.

**Reachard HTTPS host permissions:** `https://reachard.co/*`, `https://www.reachard.co/*`, and `https://contacts.reachard.co/*` connect the signed-in account and send authenticated account-status, contact-search, email-lookup, settings, and draft requests to the Reachard website/API.

**activeTab:** Grants temporary access to the current page when the user clicks the Reachard toolbar icon. This supports arbitrary company/job websites without permanent all-site access. Chrome revokes this access on cross-origin navigation.

**scripting:** Injects the packaged `brand.js`, `content.js` and `content.css` into that user-selected tab. No remote executable code is downloaded.

**Named-site content-script access:** `www.linkedin.com`, `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com` and `*.myworkdayjobs.com` provide automatic local recognition and the page entry point. On these sites, relevant text/metadata and the source URL may be read before a click. On other websites, page reading starts only after the toolbar action. The package contains no all-site match; Chrome's measured warning is access to some websites. This does not guarantee review time or approval.

Choosing Sign in can also send the source-page URL to the Reachard account website in the return link. Automatic account/settings checks do not attach the job description.

**External connections:** Only `https://reachard.co/*` and `https://www.reachard.co/*` use the external account/session bridge. The contacts API domain remains a network host but cannot act as an account-control website. The website bridge accepts only account/session and legacy language messages. Development localhost origins are excluded from the store ZIP.

**Remote code: No.** All executable JavaScript is packaged locally, including React/HeroUI. HTTPS APIs return feature data, not executable extension code. Contact avatars, when present, are remote images.

### Data categories

Reconcile these answers with the dashboard's current definitions. Do not select “no data collected.”

| Category | Answer and scope |
| --- | --- |
| Personally identifiable information | Yes: user name/email and saved profile/resume context; professional contact names and available work emails. |
| Authentication information | Yes: extension token and account session. Password entry occurs on the website. |
| Location | Yes: saved region and textual job/contact location. No GPS/device-geolocation access. |
| Web history | Yes, limited to source page URLs attached to requested workflows and user-initiated sign-in return links; no general browsing-history feed. |
| Website content | Yes: job descriptions, company/title, public-profile details and related context. |
| User activity | Yes: feature usage, status and timestamps for limits, reliability and recent activity. |
| Personal communications | Yes: user-provided outreach context and message drafts; no mailbox-reading permission or automatic outreach sending. |
| Financial and payment information | Yes, limited to associated plan/subscription, billing status and usage. Stripe handles card entry on the website; the extension does not read card details. |
| Health information | No health feature or intentional health-data collection. |

The privacy page names Treg/Icypeas/Apollo, RapidAPI suggestions, OpenAI planning/drafting, Stripe, Resend and infrastructure providers. It describes account deletion with limited necessary billing/security retention and includes a Chrome Web Store Limited Use statement. Its deployed wording must match the submission.

The publisher must confirm the Limited Use declarations reflect actual production practices: no data sale, unrelated use/transfer, or creditworthiness/lending use. This preparation does not submit legal declarations on the publisher's behalf.

## Reviewer access and instructions

Dedicated reviewer access is prepared for chrome-review@reachard.co: Base trialing, 20 credits, expiring October 22, 2026 at 00:00 America/Los_Angeles; no payment method and automatic cancellation at expiry. Membership and credits are verified; the signed-in website and full extension workflow have not yet been tested. The password remains in a separate private workspace file and is excluded from public materials. Save credentials only in the dashboard's private Test instructions tab. Do not commit them or put them in public listing text. Restricted features must be accessible without the reviewer paying, using the owner's account, or depending on an expiring verification code. The screenshot fixture is local-only and is not reviewer access or part of the ZIP.

The longer steps below are reference guidance. The current dashboard has separate Username (100 characters), Password (100), and Other instructions (500) fields. Use the 441-character Other instructions in the fill-in pack; copy the password separately from the private workspace file.

1. Use desktop Chrome 141 or later. Install the submitted extension; installation opens the Reachard website.
2. Sign in at https://reachard.co/sign-in with the test credentials in this tab. The account has a completed sample profile and contact usage. Wait for automatic account connection, then return to a public job page.
3. Open one of the publisher-verified public test URLs. Supported types include LinkedIn jobs/company/profiles, Greenhouse, Lever, Ashby, Workday and normal company websites. If a third-party page requires its own login, use a public company/ATS page instead.
4. Click the pinned Reachard toolbar icon (required on websites outside the named automatic list), or its page launcher where available. Confirm the native panel shows the current role/company. On a company website, optionally enter a role or ask.
5. Click “Find people here.” Available company contacts appear. Results vary and a no-results response is possible.
6. Expand a contact and choose “Get email & draft.” When a verified work email is available, one included credit is used and a draft is prepared. Review its “Not sent” status and editable subject/message.
7. Edit the draft or use “Copy.” “Open in email app” opens a compose action; it does not send. Sending is not needed to review the extension.
8. Return to the role and adjust message goal/tone/length or personal context. Preferences save to the account and apply to later drafts.
9. Sign out on the Reachard website and confirm the extension requires sign-in. Sign in to reconnect. Refresh a tab already open before installation/update if it still has a stale content script.

Review support: support@reachard.co.

## Early review submission

- [x] Developer account opened and draft uploaded by the owner; formal ID confirmed as `ladoemfclhhepfomibkdblodgnhceefm`.
- [x] Production website accepts the formal ID through `CHROME_EXTENSION_ID`, merged with the existing `ALLOWED_EXTENSION_IDS`; `ALLOW_ANY_EXTENSION_ID=false`. API preflight permits the formal and existing IDs and rejects an unrelated ID.
- [ ] Owner completes the dashboard's remaining publisher/contact, two-step verification, applicable trader, listing, privacy, and distribution fields. These fields are not verified merely by seeing a draft ID.
- [x] Dedicated reviewer account chrome-review@reachard.co is created with verified Base trialing membership and 20 credits, ending October 22, 2026 at 00:00 America/Los_Angeles. No payment method; it cancels at expiry. Credentials belong only in the private Test instructions fields. Full signed-in workflow verification remains separate below.
- [ ] Install the submitted package using the formal ID and verify login/automatic connection plus the advertised search, reveal, draft, copy, and sign-out workflow against public test pages. Health and signed-out fixture checks do not prove this. Any paid-provider test needs separate authorization.
- [ ] Deployed privacy wording matches the package's actual page recognition, source URL, sign-in return link, and feature data handling; support contact is usable. The latest privacy copy is currently local and must be reconciled before submission.
- [ ] Submit for review and uncheck automatic publication in the confirmation dialog. Record the resulting review status. The owner must operate the store dashboard because the current browser control reports that the extensions gallery cannot be scripted; do not bypass that restriction.

Chrome's Test instructions tab is optional in general, but this extension requires a signed-in eligible account for its advertised features. Providing working review access avoids requiring the reviewer to purchase access. The developer's backend must remain usable throughout review; deferred publishing does not defer the review itself.

## Work that can continue during review

- Complete the remaining website release and password-recovery rollout, provided the submitted extension's reviewer workflow stays compatible and usable.
- Prove public subscription/payment/webhook/usage enforcement and failure handling before paid public launch. A health response or fixture does not establish this.
- Finish broader checks across LinkedIn, Greenhouse, Lever, Ashby, Workday, and company sites, plus install/update and session-recovery cases. Resolve any defect that prevents the advertised workflow before submission; fixture/parser checks are supplementary evidence.
- Complete operational backup/restore, provider budgets, and remaining domain configuration.
- Publish manually after approval and launch acceptance. Chrome allows up to 30 days after approval before a deferred item returns to draft and requires another review. Set `NEXT_PUBLIC_CHROME_STORE_URL` only when the listing is available to intended users.

## Official references checked September 7, 2026

- [Listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) and [images](https://developer.chrome.com/docs/webstore/images): prepared 128px icon, five 1280×800 screenshots, 440×280 tile and optional 1400×560 marquee. Some optional-media wording differs between the pages; check the live dashboard for a video field. No YouTube upload has been made.
- [Privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy): consistent single-purpose, permission, remote-code, data-category and policy disclosures.
- [Test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions): private reviewer credentials for restricted access.
- [Publishing](https://developer.chrome.com/docs/webstore/publish): upload ZIP, complete listing/privacy/distribution, submit; deferred publishing is available and the staged approval has a publication deadline.
- [User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): accurately describe collection, use, sharing and handling.
