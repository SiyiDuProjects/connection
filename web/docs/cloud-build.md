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

Both builds install the frozen dependency lockfile, then run
`node scripts/install-reviewed-pro.mjs`. This invokes the exact-version download
function from the pinned `hpsetup@4.7.1` dependency with `HEROUI_KEY` and its CI
flag. The CLI's automatic upgrade-to-latest path is not invoked. The downloaded
archive must pass the existing exact-version, component and CSS checks in a
temporary directory before it is copied into the application. The wrapper does
not rewrite package.json, the lockfile, or Vercel configuration. Missing keys,
unexpected versions and incomplete archives fail the build; no older-version
fallback is accepted.

The manual GitHub Actions workflow `Verify reviewed Pro distribution` checks
whether the existing CollectUI channel can still deliver exact beta.9. It uses
the versioned download function shipped in `hpsetup@4.7.1` with the repository's
existing `HEROUI_KEY`, checks package metadata and runtime entry files, and
does not deploy or publish the downloaded package. This diagnostic confirmed
beta.9 availability in run `37087626023`; it does not replace full tests and a
build against the reviewed version. Both the probe and production wrapper use
the helper's internal module, so its `4.7.1` dependency pin must only change
after reviewing that interface.

The reviewed dependency set is Pro `1.0.0-beta.9` with HeroUI React/styles
`3.2.5`. The beta.9 release raises those peer minimums and adds React Aria,
React Stately, and interaction peers, which are explicitly declared here for
pnpm's dependency isolation. Reachard does not use the changed HoverCard
content-state API. Keep the exact Pro version guard: a future installer update
must still stop the build for review.

After restoring local dependencies, run `./scripts/check-local-env.sh` from the
repository root, or `node scripts/check-pro-install.mjs` from `web/` for the
specific Pro diagnostic. Check the installed package's own version and entry
points: a pnpm directory named `@heroui-pro+react@1.0.0-beta.9` can still contain
an older licensed runtime copied during migration. Do not change the manifest,
lockfile or version guard to make that older copy pass. Restore the reviewed
licensed runtime through the existing CollectUI channel, then rerun the check
and build. A successful build against another installed version does not verify
the reviewed dependency set.

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
