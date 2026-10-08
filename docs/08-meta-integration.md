# 08 — Official Meta integration and launch constraints

## Official-only integration

Use Meta's hosted WhatsApp business messaging APIs through a versioned server adapter. No WhatsApp Web scraping, browser session automation, unofficial QR bots or personal-account session libraries. Provider tokens stay server-side and encrypted; customers connect assets they are authorised to control.

Meta's first-party Tech Provider sample covers business onboarding, messaging, templates and webhook handling. It is a reference for provider behaviour, not Passion Fruit's tenancy/security design. [Meta sample repository](https://github.com/fbsamples/business-messaging-sample-tech-provider-app)

## Policy constraints — authoritative summary

The current policy requires recipient permission for subsequent contact, respect for opt-out, approved templates for business-initiated contact, and template-only sending outside the 24-hour service window. Automation needs a clear escalation path. Business eligibility and data use restrictions also apply. [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)

Represent these as shared application checks: `RECIPIENT_ELIGIBLE`, `CONTENT_ALLOWED`, `WINDOW_ALLOWED`, `ESCALATION_AVAILABLE`, `BUSINESS_ELIGIBLE`, `DATA_USE_ALLOWED`. Modules refer to these checks rather than maintain different policy interpretations. A contact import, number possession or previous reply does not automatically establish permission for a future marketing campaign. The owner's actual consent notices and collection process require approval before launch.

## Development versus external customer onboarding

1. **Development:** own/test assets and authorised app roles/test recipients, within Meta's actual environment limits. Test-number access does not establish commercial onboarding eligibility.
2. **Controlled pilot:** each real business has authorised assets, valid credentials, permitted messaging and provider-required billing/verification. Two businesses still count as external customers if they are unrelated businesses; low volume is not a review exemption.
3. **General SaaS:** complete the applicable Tech Provider/business verification, app review/access requirements and Live/published configuration. Obtain the permissions needed by the selected flow, commonly `whatsapp_business_messaging` and `whatsapp_business_management`, plus only genuinely necessary scopes. Confirm exact access gates in the current app dashboard.

These onboarding gates are supported by the first-party sample's production checklist, but account-specific approval cannot be verified from this workspace. Do not label the SaaS “Meta approved” before the actual account passes review.

## Embedded Signup

Meta describes **Embedded Signup v4** as its unified onboarding architecture. Plan the new integration around v4; confirm exact current configuration, rollout, asset terminology and migration dates in the developer dashboard before implementing. The v4 page itself could not be retrieved during research; no unverified retirement deadline is made a hard dependency. [Meta v4 announcement](https://developers.meta.com/resources/videos/unified-onboarding-whatsapp/)

Flow design: authenticated owner → server-created expiring single-use onboarding state bound to tenant/user → provider signup → origin/state validation → server-side code exchange → inspect authorised assets/permissions → validate account/number ownership → register/configure where required → subscribe correct assets → encrypt token → test channel → mark connected. Protect against CSRF, replay, attacker-supplied asset IDs and accidental binding to a second tenant.

Do not treat tokens as permanently valid. Store expiry/revocation metadata and reconnect instructions. Account and messaging container terminology is hidden behind provider mappings; avoid making UI/domain naming depend on a rollout-specific Meta term. Supported coexistence with WhatsApp Business App is optional and requires specific eligibility/version testing, not a universal connection promise.

## Webhooks and Graph version

Use HTTPS, challenge verification and raw-body POST signature validation as defined in the core specification. Subscribe to required message/status/template/account health changes based on current supported fields. Test actual asset subscriptions after onboarding, not merely callback verification.

`PF_META_GRAPH_VERSION` is required deployment configuration. Do not copy the version from an old sample or silently use “latest”. Pin an officially supported version, record its sunset date, maintain contract fixtures and run regression tests before upgrades. Invalid or missing version fails deployment readiness.

## Templates and media

Implement template listing/creation/sync, language and parameter validation, state-change ingestion and explicit rejection explanations. Re-check provider state before dispatch and fail clearly when approval changes. Keep provider template identity/version separate from local draft content. Rich interactive messages, catalogue items, audio, documents and Meta Flows are capability-gated per tested account/API version.

WhatsApp Flows are distinct from the Passion Fruit workflow graph. Their later module includes provider JSON schema/version validation, draft/published lifecycle, permitted sending path, encrypted data-exchange endpoint when required, dedicated key lifecycle, replay/state checks, health tests and PII minimisation. Exact cryptographic protocol must be implemented from verified current first-party documentation and official test examples, not reconstructed from memory. Endpoint support is a release blocker until verified.

## Pricing and metering

Meta currently describes pricing per delivered message, with rates varying by market/category and applicable exemptions/tiers. Do not build billing around the older flat conversation model. [Official WhatsApp pricing](https://whatsappbusiness.com/products/platform-pricing/)

Maintain versioned rate cards with effective dates, currency, market, category and source. UI shows estimated provider cost separately from Passion Fruit subscription/add-ons, with unknowns marked. Provider statements are authoritative for final provider charges; estimates are reconciled and never presented as exact invoices. API acceptance, read receipt and delivery each have separate metrics. Do not hardcode sample INR prices into the product.

## Release verification checklist

- Valid legal entity/profile, public site, privacy/terms, support and data-deletion process.
- Appropriate Meta app mode, permissions/access, business/provider verification and configured signup flow.
- Customer authorisation of assets; no duplicate active channel ownership across tenants.
- Encrypted token, rotation/reconnect test and correct callback subscriptions.
- Actual round-trip text/template/media tests with permitted recipients.
- `RECIPIENT_ELIGIBLE` and related policy checks exercised with failing as well as passing cases.
- Verified account limits/quality/capabilities; configured rate limiting and pause on deterioration.
- Review recording/test account demonstrates the implemented user journey where required.

Direct developer documentation was rate-limited/unavailable for several pages during preparation. Related official policy, pricing, Meta announcement and first-party sample were accessible. Exact payload fields, rate ceilings, current app access steps, Meta Flow protocol and Graph lifecycle remain implementation verification gates, explicitly tracked in document 12.
