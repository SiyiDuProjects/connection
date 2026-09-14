# Reachard extension UI

This is the React/HeroUI source for the native browser side panel in `../extension/`.
`sidepanel.html` owns the UI. The page content script reads the current job/company
and provides a small launcher; it does not insert a panel or cover the website.
The browser toolbar icon and page launcher open the same native Side Panel.
The square page launcher shows the Reachard logo and appears automatically on
supported pages. It draws attention briefly, then stays still. Opening the native
panel requires clicking the launcher or toolbar icon; there is no iframe panel.
The panel follows the active tab in its own window and keeps results with their
originating tab/role, including when requests finish after a tab switch.
The three steps share a restrained blue action color, neutral text, and the bundled
background fade. The role remains above the company, View job, search and preferences.
Select, Tooltip, Button, Avatar and TextArea are real HeroUI components. Keep their
keyboard and focus behavior; standard controls do not need decorative wrappers.
Tone/Length menus share the native field-radius token with their triggers.
Personal context directly composes HeroUI TextField and primary TextArea,
matching Tone and Length's field background, border and shadow. Native
field-sizing grows this field with content; do not replace it with a styled div
or use the draft editor's secondary surface for this input.
Rectangular controls share the 12px --ep-control-radius token, including hover
and focus surfaces. Segment insets use 8px to account for the outer padding.
Keep profile avatars round; do not add per-screen corner values.
Job salary and publication dates come from JobPosting metadata or explicit
salary elements. Missing values stay hidden; never imply independent live verification.
People to contact uses a compact list with one person expanded at a time. Each
person has a labeled disclosure button; their LinkedIn link and email action are
separate controls. Company/management seniority alone is not a strong match.
Email editing is laid out directly on the page. The HeroUI subject and body fields
grow with text and panel width, leaving scrolling to the page. Do not reintroduce
an outer card, nested field padding, or an independently scrolling message box.
Preferences save automatically: choices immediately, typing after a short debounce
or blur. Writes are serialized and flushed before draft generation and on closing.
Successful saves stay silent; failures offer a Retry action. There is no sample
email preview or manual Save style button.

Components: HeroUI Button, Select/ListBox, Accordion, TextField/TextArea, Input, Avatar and Chip;
HeroUI Pro Segment and EmptyState. All text and controls are live UI. No external
scripts or fonts are needed. Contact portraits use provider-supplied HTTPS image
URLs or the portrait already present on the active LinkedIn profile. HeroUI
Avatar.Image shows the photo; missing or failed images fall back to initials.
The app does not fabricate image URLs from profile links or run additional paid
profile lookups to decorate the list.

## Build and install

With the existing `web/` dependencies installed, run from the repository root:

```sh
node scripts/build-extension-ui.mjs
node scripts/check-extension.mjs
node scripts/extension-sidepanel.test.mjs
node scripts/extension-autosave.test.mjs
node scripts/extension-job-metadata.test.mjs
```

In Chrome or Edge, open the Extensions page, enable Developer mode, choose
Load unpacked, and select the repository's `extension/` directory. If already
loaded, click Reload on Reachard and refresh the job page. Click the Reachard
toolbar icon or the small page launcher. The browser controls the side, width,
and close button. The current package requires Chrome 141 or later. It uses
`storage`, `sidePanel`, `activeTab` and `scripting`. Supported job sites get the
page reader automatically; other sites grant temporary page access on a toolbar
click. It does not request persistent access to all sites.

The usage footer reads the API's explicit `credits.unlimited` boolean. A plan
name never grants unlimited use: legacy Plus accounts keep their numeric balance.
Null or missing balances are unknown, not zero. Signing out clears both values.

## Local UI verification

```sh
node scripts/preview-extension.mjs
```

Open `http://127.0.0.2:3018/sidepanel.html`. This serves the actual packaged
side-panel page and controller. Chrome tab/account/contact messages are
simulated; it does not verify extension installation, website authentication,
or live provider responses. It makes no paid contact requests.

Optional states: `?state=signed-out`, `?state=empty`, `?state=error`,
`?state=save-error`, `?state=slow-save`, `?state=no-context`, `?state=long-contact`,
`?state=long-company` (10 sample contacts plus salary/date fixtures).
Quota states: `?state=plus`, `?state=legacy-plus`, `?state=trial`, and
`?state=no-credits`. These fixtures do not make paid provider calls.
Fixtures are outside `extension/` and are not shipped.

React Aria's Shadow DOM event flag must remain enabled. Select and tooltip
portals stay in the same shadow root; Select popovers use `isNonModal` to avoid
hiding the extension host from assistive technology.
Controlled open state and React Aria useInteractOutside restore dismissal for
non-modal menus. Trigger mouse presses close an already-open menu; touch and
keyboard retain the library behavior. Do not remove these without testing
trigger re-click, outside click, Escape, switching menus and selecting options.
The build converts component rem declarations to fixed pixel values at a 16px
base because rem follows the visited document's root even inside Shadow DOM.
It also supplies Tailwind translation initial values in the lowest-priority
properties layer: Chromium does not register ShadowRoot @property declarations,
which otherwise drops native checkmark centering when the x value is undefined.
