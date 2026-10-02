# Cloud builds

Reachard's current HeroUI Pro distribution comes through the user-provided
CollectUI channel. Its MCP and Skills are already available locally. Do not
confuse this setup with direct heroui.pro account authentication.

Cloud installation uses `hpsetup@4.7.1` with the secret `HEROUI_KEY` in:

- GitHub Actions repository secrets.
- The Vercel connection project's Production and Preview environments.

The CollectUI personal token is for MCP/Skills, not package installation. Never
put either credential in source, documentation, or an install command. The
workflow and `vercel.json` use environment variables without embedded values.

Both builds install the frozen dependency lockfile, run hpsetup in CI mode, then
verify the Pro component entry point, CSS, and exact version. CI mode also keeps
hpsetup from generating local Vercel configuration containing a key. If the
installer selects a newer component version, verification stops the release
until that upgrade is reviewed and tested.

The reviewed dependency set is Pro `1.0.0-beta.9` with HeroUI React/styles
`3.2.5`. The beta.9 release raises those peer minimums and adds React Aria,
React Stately, and interaction peers, which are explicitly declared here for
pnpm's dependency isolation. Reachard does not use the changed HoverCard
content-state API. Keep the exact Pro version guard: a future installer update
must still stop the build for review.

No local environment variables are needed for the existing preview setup.
Do not commit downloaded library files or private template reference copies.

Display branding is generated from `brand/brand.json`. In a full checkout,
web development and build commands synchronize it automatically. A Vercel
upload containing only `web/` uses the included generated `web/lib/brand.ts`;
it does not require changing the project's Root Directory or including the
extension runtime. Repository CI verifies the generated files before release.
When changing the brand, run `node scripts/sync-brand.mjs` from the repository
root and include all generated changes in the release.

Reference: https://docs.collectui.pro/hpsetup/usage
