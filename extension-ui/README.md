# Reachard extension UI

This is the React/HeroUI source for the native browser side panel in `../extension/`.
`sidepanel.html` owns the UI. The page content script reads the current job/company
and provides a small launcher; it does not insert a panel or cover the website.
The browser toolbar icon and page launcher open the same native Side Panel.
The panel follows the active tab in its own window and keeps results with their
originating tab/role, including when requests finish after a tab switch.
Preserve the approved portrait layout, bundled background image and fade,
page typography, spacing, icons and copy. The current role remains above the
company, a separate View job action, the fixed Find people here action, and message
preferences. Component fixes must stay within the affected control; do not
rewrite the page, remove its theme or move its content to obtain library defaults.
Select, Tooltip, Button and Card are real HeroUI components. Select triggers,
back-button padding and the Card surface use library styles within this design.
Tone/Length menus share the native field-radius token with their triggers.
Job salary and publication dates come from JobPosting metadata or explicit
salary elements. Missing values stay hidden; never imply independent live verification.
People to contact uses compact cards with one useful reason and expandable
additional reasons. Company/management seniority alone is not a strong match.
Preferences save automatically: choices immediately, typing after a short debounce
or blur. Writes are serialized and flushed before draft generation and on closing.
Successful saves stay silent; failures offer a Retry action. There is no sample
email preview or manual Save style button.

Components: HeroUI Button, Select/ListBox, TextArea, Input, Card, Avatar and Chip;
HeroUI Pro Segment and EmptyState. All text and controls are live UI. No external
scripts, fonts, or image requests are needed.

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
and close button. The update adds only the `sidePanel` permission (Chrome 120+).

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
