# UI ownership

HeroUI v3 and HeroUI Pro own control styles, semantic colors, radius, shadows,
focus, validation, and disabled states. `app/globals.css` imports their styles
and configures only the Reachard action accent and font family at the root.
Do not add a second `.default` theme around business pages or portaled overlays.

`app/auth.css` owns the approved centered account-card layout. Marketing CSS
owns the shared brand/header/footer and pricing composition. `home.css` owns
the approved homepage imagery and illustrative extension animation. These
files must not redefine HeroUI's label/input/button classes or radius tokens.

Settings use the supplied template's grouped `SettingsRow` composition, with
native HeroUI controls and Pro DropZone. The admin uses Pro KPI/DataGrid.
`Appearance` restores the user's root-level light/dark preference.

Local-only routes `/workspace-preview` and `/ui-preview` use the same production
components without account mutations. The latter supplies fixture data and
overlay/validation states. The optional `/template-preview/*` viewer and private
upstream reference files stay in the local workspace, outside production releases.

Run `node scripts/check-ui-boundaries.mjs` for architecture checks; CI runs this
alongside the existing business tests and production build. Before publishing
UI changes, check overlays, keyboard validation, 390px layout, and light/dark
appearance in the browser. Test data must remain clearly labeled.
