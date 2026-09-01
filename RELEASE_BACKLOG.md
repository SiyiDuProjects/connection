# Reachard release backlog

This file records product decisions that are intentionally deferred or require the owner to finish an external account step.

## Owner actions

1. Create and monitor `support@reachard.co`. The address is currently used as the public policy and future store-listing contact.
2. Finish Stripe business-profile, bank/payout, legal-identity, and tax-registration details. The unused Earth Auction account is now named Reachard; its legal and payout identity was not changed. Test products exist in account `acct_1TSwqZ0nhgFoMCt9`: Base uses `price_1UAGjD0nhgFoMCt9bTxYOnQP` and Plus uses `price_1UAGjZ0nhgFoMCt9rWCiNq9u`. After signing in to Vercel, verify the Stripe secret/webhook belong to this same account and set `STRIPE_BASE_PRICE_ID` and `STRIPE_PLUS_PRICE_ID` there. Never commit the secret or webhook value.
3. The current unpacked test extension ID is `eknnfebemfipbflkninbpjddljhhomif`; the production contacts API currently allows that ID. Add it to the web deployment's `ALLOWED_EXTENSION_IDS` before deploying the connection changes. After the private/unlisted Chrome Web Store package is uploaded, add or replace it with the final store extension ID in the web deployment and contacts server allowlists.
4. Replace the temporary extension/store logo and provide final store screenshots before public submission.
5. Confirm the customer-facing business name, support phone/address if Stripe requests them, statement descriptor, and refund policy before live payments are enabled.

## Deferred product decisions

1. Email ownership verification remains disabled until an email-delivery provider and sender domain are configured. New accounts must not be described as email-verified in public claims until this is implemented.
2. Onboarding simplification is acknowledged but deferred. The current required background, school, role, and name flow remains in place.
3. A free first Contact Kit is not being added now.
4. Top-three result diversity is not being added now. Ranking correctness and false-match prevention come first.
5. Web and extension visual redesign, including the logo, remain owner-led.
6. Provider selection remains Fresh LinkedIn Scraper for people search and Apollo for on-demand work-email reveal until the planned provider benchmark is run.

## Before public Chrome Web Store release

1. Re-run the cross-site browser matrix in `extension/STORE_SUBMISSION.md` against the final packaged extension.
2. Verify `https://reachard.co/privacy`, `https://reachard.co/terms`, and `support@reachard.co` are live.
3. Confirm the extension origin allowlist is strict and contains only the released extension ID(s).
4. Complete Chrome Web Store data-use disclosures and obtain legal review for third-party site and contact-data usage.
