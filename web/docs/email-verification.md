# Reachard email verification

New accounts receive a six-digit code via Resend and remain unverified until it is submitted. Signing in to an unverified account returns to verification. Existing verified accounts keep their current status. Referral attribution is still recorded during sign-up; checkout rewards are unchanged.

Changing an account email also requires verification of the new address, clears the current login, and revokes extension tokens. Missing delivery configuration prevents the address change. A provider failure after the update can be retried from the verification page or by signing in with the new address and existing password.

## Configuration

1. Add your sending domain in [Resend Domains](https://resend.com/domains). Publish the exact DNS records Resend provides and wait for `Verified`. Do not replace existing mailbox MX records. A dedicated sending subdomain also works: use that same verified subdomain in `EMAIL_FROM`.
2. Create a sending-only API key restricted to that domain. Enter it directly in the web deployment environment as `RESEND_API_KEY`; never put it in source, browser code, or chat.
3. Set `EMAIL_FROM="Reachard <noreply@reachard.co>"` (or the verified subdomain sender). Replies go to `support@reachard.co`. Keep the existing `AUTH_SECRET` stable; it must contain at least 32 characters. Set `POSTGRES_URL` to the intended web database. Next.js accepts `.env.local` for local runtime; the existing database CLI reads `.env` or shell environment.
4. Before deploying this code, apply `0014_email_verification_codes` through `npm run db:migrate` against the explicitly selected database with a backup. It adds nullable `code_hash`, a defaulted `attempts` counter, and an index; it does not rewrite user verification status. No production migration is performed by tests.
5. Restart/redeploy the web app to load configuration, then register using a mailbox you control. Confirm inbox delivery, code entry, resulting login, and resend. Resend accepting a message is not proof it reached the inbox.

## Behavior

- Codes expire after 10 minutes and can be used once. Only a keyed hash is stored; plaintext codes are never logged.
- Five failed attempts invalidate a challenge. Resend has a 60-second server-enforced cooldown and a maximum of five sends per account per hour. These limits are shared through PostgreSQL, not process memory.
- Resend replaces the previous challenge. A delivery error invalidates the attempted challenge and shows a recoverable error, without issuing a session. Per-account throttling remains active after failed deliveries.
- Requests time out after 10 seconds. Each logical send has an opaque Resend idempotency key. API failures and malformed success responses are treated as delivery failures.
- Legacy verification links remain usable until their original expiry. New mail uses codes only.

## Templates and components

The email template is `lib/email/verification-template.ts`, with HTML and plain text. Email layout uses inline styles and tables for mail-client compatibility; React UI components do not run inside emails. No Resend dashboard template needs manual authoring.

The approved centered registration card already used native HeroUI `Card`, `TextField`, `InputGroup`, and `Button`. It now also uses `Form` and `FieldError` following the official compound-component examples. The verification page uses those same native components and the official [HeroUI InputOTP form example](https://heroui.com/docs/react/components/input-otp). There is no hand-written OTP input widget or legacy `components/ui` control on these pages.

These are native HeroUI components within Reachard's approved account layout, not a claim of an unchanged HeroUI Pro full-page template. The available Pro MCP catalog exposes no dedicated authentication page template; it provides the base HeroUI auth primitives. No additional Pro component is needed for this form.

## Verification

`npm run test:email` runs real server modules against isolated, in-memory PostgreSQL (PGlite), applying the email migrations and replacing HTTP delivery and Next.js session/navigation boundaries. No real mail is sent. It covers sign-up and login gates, delivery failure recovery, expiry, attempts, resend limits, concurrent requests, legacy links, and redirect validation.

Use `npm run preview` for the actual app at `http://127.0.0.1:3012/sign-up` and `/verify-email?email=preview%40example.com`. Without database configuration the preview displays a clear unavailable message on submission; it never simulates successful verification.

API references: [Resend send email](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
