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

No local environment variables are needed for the existing preview setup.
Do not commit downloaded library files or private template reference copies.

Reference: https://docs.collectui.pro/hpsetup/usage
