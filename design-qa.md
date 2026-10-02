# Reachard Dashboard adaptation QA

## Scope
The user requested replacing the template's demonstration content with Reachard
while keeping its layout and Pro components. Both the authenticated Dashboard and
public workspace preview now share the Reachard implementation.

## Visual evidence
- Reference: artifacts/heroui-dashboard/original-template-desktop.png
- Final: artifacts/heroui-dashboard/reachard-dashboard-desktop.png
- Both images were opened together at 1290 x 910 for comparison.
- Final state is unauthenticated; reference contains demonstration data. Empty
  charts and history in the final image are intentional, not missing widgets.

## Findings and fixes
- P1 fixed: Kate, revenue, orders, and employees removed from the active pages.
- P1 fixed: real Dashboard and preview now share their frame, sidebar, KPI/chart
  composition and activity table. Existing account forms remain connected to their
  server actions; profile and resume editing are available at /dashboard/profile.
- P2 fixed: long filter tab wrapped; shortened to Reveals.
- P2 fixed: preview mobile menu stayed open after selection; navigation now uses
  the Pro AppLayout navigation contract, matching authenticated routes.

## Fidelity surfaces
- Typography: retained template heading/KPI/body hierarchy; filter labels fit.
- Layout: same persistent sidebar, top toolbar, four KPIs, two widget panels and
  activity table area. No new company navigation or unrelated business modules.
- Colors: Default neutral surfaces and Pro's blue chart tokens retained.
- Assets: Reachard's existing logo replaces the template account avatar; no
  template people or employee images appear in the active DOM.
- Content: credits, recent successful reveals/drafts, plan and activity use the
  existing /api/account contract. Unlimited credits are handled explicitly.
  Statistics are labeled as the latest 10 records, matching the API query.

## Checks
- TypeScript noEmit passed.
- Dashboard aggregation and resume extraction tests: 7 passed.
- Desktop navigation: Settings, My profile and Dashboard verified.
- Drafts filter changes the selected tab and empty-result state.
- At 390 x 844: no horizontal overflow; mobile menu opens, selecting Security
  changes the page and closes the dialog. Desktop viewport restored afterward.
- Preview account inputs are disabled; there are no account mutations or account
  fetches from this unauthenticated preview.
- Active DOM check for Kate Moore / All Employees / Revenue / Sales Performance /
  Traffic Source: zero matches.
- Two PDF worker HMR messages appeared while moving the existing profile component;
  full page reload produced no new console errors. PDF extraction tests pass.

## Limits
Authenticated API calls, account saves and populated charts were not browser-tested:
this local environment lacks the account database configuration. Code continues to
use existing authentication guards and server actions. No production deployment
or paid provider requests were made. This pass verifies the adapted UI, routing,
shared data contract and tested aggregation, not live account operation.

final result: passed

# Homepage — Granola-inspired adaptation, 2026-09-04

## Scope and recovery
- Updated the canonical root `web/` homepage only, with a split hero, layered
  imagery and an automatically looping illustrative extension demonstration.
- Saved the previous dirty homepage and shared design files before editing to
  `.archive/home-before-granola-20260904-202829/`; hashes are in `manifest.json`.
- Kept Reachard's blue identity, current shared header, authentication and Pricing.
  No duplicate app, production deployment or paid provider request was made.

## Visual comparison
- Reference: https://www.granola.ai/, inspected live for layout and motion.
- Compared `artifacts/home-granola/reference-1280.png` and
  `artifacts/home-granola/desktop-1280.png` together at 1280 x 720.
- Retained the reference's large serif headline, left/right balance, overlapping
  visual planes and slow motion. Blue texture, coastal image, extension UI and
  job-search copy are intentional Reachard adaptations.
- Additional viewport evidence: `desktop-1440.png`, `mobile-hero.png`,
  `mobile-demo.png`, `steps.png`, `closing.png`, and `dark.png` in that folder.
- Viewport captures are the evidence; the browser's stitched full-page capture
  was malformed and is not used to assess the result.

## Findings and fixes
- P2 fixed: desktop contact list and email actions initially exceeded the plugin
  body. Increased the demonstration panel's available height.
- P2 fixed: narrow mobile contact cards wrapped beyond the body. Tuned mobile
  panel width and height, then rechecked all three scenes.
- P2 fixed: private-beta copy over the landscape needed greater contrast.
  Added a light translucent backing and verified the closing section again.
- No unresolved visual blockers in the checked viewports.

## Verification
- TypeScript `tsc --noEmit` passed after implementation.
- No horizontal overflow at 320, 390, 1024, 1280 and 1440 pixels. Measured scene
  scroll heights equal their available heights after the fixes.
- Observed automatic role, search, people/reason and typed email states, followed
  by the next loop; no manual scene selection is required. Cycle length is 13s
  after the requested pacing adjustment: role 2s, search 1s, people 4s, draft 6s.
  Timed browser observation confirmed successive loop resets 13.0s apart; the
  finished email holds for approximately 4s. TypeScript passed after this change,
  and the verification page recorded no console errors.
- Pause held the displayed scene/text stable; Resume restarted playback.
- How it works, Install extension, Pricing and Get started navigate correctly.
  Installation leads to the private-beta section when no store URL is configured.
- Fresh homepage browser tab: zero console errors and all images loaded.
- Inspected existing dark appearance on mobile and restored light appearance.
- Reduced-motion static presentation and offscreen/background suspension are
  implemented; reduced-motion OS emulation was not performed in this pass.

## Limits
The demonstration adapts the existing extension's current-role, people and draft
screens using sample content. It does not perform live searches, reveal emails or
send messages. This validates the local marketing page, not a completed extension
or authenticated production service. A production build was not run.

final result: passed for local homepage preview

## Follow-up: virtual demo cursor
- Added a decorative cursor synchronized to the same 13s timeline: click Find
  people, expand the first contact, then click Get email & draft. Each click has
  a subtle pressed state. Recommendation details now appear
  after the contact click. The cursor fades away for reading the email.
- Cursor anchors follow rendered control layout through ResizeObserver, rather
  than fixed desktop coordinates. All three cursor tips landed inside their
  intended targets in browser checks on desktop and at 390px; no mobile overflow.
- Pause kept the cursor transform unchanged across observations; Resume restored
  playback. Reduced motion hides the cursor and retains the static recommendation.
- TypeScript noEmit passed; browser console recorded no errors. Restored the
  default viewport, homepage scroll position and automatic playback afterward.

### Mac cursor refinement
- Replaced the custom arrow with the macOS default cursor geometry documented at
  https://mac-cursors.netlify.app/svg/default.svg (David Darnes' mac-cursors).
  Cropped the source's empty canvas, retained its black/white paths and rendered
  it at 18 x 28.5px. Removed blue ripples and target outlines; reduced press scale.
- Browser screenshot confirmed the smaller Mac arrow, zero ripple elements and
  continued autoplay. TypeScript noEmit passed after this refinement.

## Extension sign-in gate — 2026-09-05
- Account verification now starts on panel initialization. Unknown/pending states
  no longer fall through to Find people here; only GET_ACCOUNT_STATUS success
  authenticates the UI. Preferences cannot overwrite authentication state.
- Signed-out CTA is Sign in and uses the worker's connect-extension route with
  source-page return attribution. Failed verification offers Retry connection.
- Search, profile preparation, reveal and draft controller actions require a
  verified account. Auth changes clear cached results across tabs; late responses
  from the prior auth epoch are ignored. Missing tokens are rejected by the worker
  before search/reveal/draft network calls.
- Passed extension-auth, extension-sidepanel, extension-autosave and static checks;
  rebuilt extension/ui.js. Browser fixture using the packaged scripts verified
  disabled Checking sign-in followed by Sign in for the signed-out scenario.
- No paid provider requests or live sign-out were performed. Chrome's internal
  extension manager could not be controlled through the available browser API;
  the installed extension still needs to be reloaded by the user. Existing saved
  extension-token validity in the user's browser was not inspected.
