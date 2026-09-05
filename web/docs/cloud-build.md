# Cloud builds

Reachard uses licensed `@heroui-pro/react` components. A package-manager install
without an authorized CI token installs the public installer, not the components.
Do not commit the downloaded library or local credentials to this public repo.

Create a CI/CD token in https://heroui.pro/dashboard and configure it as
`HEROUI_AUTH_TOKEN` in both:

- This repository's GitHub Actions secrets (the web job already references it).
- The existing Vercel project's environment variables for Production and Preview.

Use a CI/CD token, not a personal token. Then rerun the failed GitHub workflow and
redeploy the current commit in Vercel without the old dependency cache.

The pnpm workspace permits HeroUI's postinstall script, which uses the token to
download the licensed components. No token belongs in this document or source.

Reference: https://heroui.pro/docs/react/getting-started/installation#cicd
