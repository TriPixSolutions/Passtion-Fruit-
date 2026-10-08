# 14 — Implemented backend foundation and setup

## What is implemented

The repository now contains an executable tenant and messaging foundation rather than only reference contracts. The database migrations create tenant membership, feature grants, audit history, encrypted integration credential records, Meta channels, contacts, conversations, messages, attempts, status events, signed webhook receipts, durable jobs, a transactional outbox, Supabase Queue relay functions, schedules, campaigns, workflow versions/runs, AI-agent configuration and usage records.

The Next.js runtime exposes health, platform tenant provisioning, tenant feature updates, inbox reads, outbound intent creation, Meta channel connection and a private bounded worker endpoint. Server modules verify Supabase users, preserve RLS, encrypt per-channel tokens with AES-256-GCM and call Meta through one adapter. The public Meta webhook is a Supabase Edge Function because Hostinger restarts must not affect webhook durability.

Live sending is off by default. Setting `PF_LIVE_SENDS_ENABLED=true` is an operational release step only after an authorised Meta test number, recipient and current supported Graph version are verified.

## Local configuration

1. Copy `apps/web/.env.example` to `apps/web/.env.local`.
2. Create a Supabase project, then copy its project URL, publishable key and server secret key into the local file. The server key must never use the `NEXT_PUBLIC_` prefix.
3. Generate the credential encryption key with `openssl rand -base64 32` and the worker secret with `openssl rand -base64 48`.
4. Install the Supabase CLI through its supported installer, link the project, and apply migrations with `supabase db push`.
5. Create the first operator through Supabase Auth, then run `select public.bootstrap_platform_admin('OWNER_EMAIL');` with a service-role database connection.
6. Deploy `supabase/functions/meta-webhook` with JWT verification disabled for that function only. Set `PF_META_APP_SECRET`, `PF_META_WEBHOOK_VERIFY_TOKEN`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Edge Function secrets.
7. Configure the Meta webhook callback as `https://PROJECT.supabase.co/functions/v1/meta-webhook` and subscribe the authorised WhatsApp Business Account fields required by the pilot.
8. Deploy the Next.js app to Hostinger and set the same application environment variables in hPanel. Use `npm run build` as the build command and `npm run start --workspace @passion-fruit/web` as the start command.
9. Apply `202610080001_worker_trigger.sql`, run `supabase/snippets/configure_worker_cron.sql` once, then confirm the worker invocation and queue age before enabling schedules. The cron token is generated inside Postgres and retained only as an encrypted Vault secret plus a SHA-256 digest.

## Hosted pilot status — 8 October 2026

The Supabase pilot project `pfrgborqqtjgejfeowrg` is connected in the Mumbai region. All four migrations in `supabase/migrations` have been applied through the Supabase SQL editor. Verification found the 12 expected core tables and confirmed both the durable queue claim function and the authentication membership activation function.

The web app has the project URL and publishable key in its ignored local environment file. The authentication Site URL is `https://lavender-pheasant-832363.hostingersite.com`; its production callback is allowed, with the localhost callback retained for development. The first Auth user, `tripixsolutions@gmail.com`, has been invited and verified as a platform administrator. The landing page also forwards Supabase invite tokens to the password setup screen.

The server secret and generated pilot security keys are configured in the ignored local environment file. The `meta-webhook` Edge Function is deployed at `https://pfrgborqqtjgejfeowrg.supabase.co/functions/v1/meta-webhook`, its verification token is stored as an encrypted Function Secret, and legacy JWT verification is disabled because Meta cannot provide a Supabase JWT. A live GET challenge test returned the expected value with status 200; the function still enforces the private verification token for setup and the Meta HMAC signature for event delivery.

The connected Meta app is `PASSION FROUT AUTO` (`28935872952719615`). Its WhatsApp pilot assets are test Phone Number ID `1343260565532810` and test WABA ID `1637279114649156`. Graph API is pinned to the app's generated testing version, `v25.0`. The App Secret is configured both in the server runtime and as a Supabase Function Secret. Meta accepted the Supabase callback and the `messages` webhook subscription is active.

A temporary Meta test token is stored only in the ignored local environment and as an AES-256-GCM encrypted tenant credential in Supabase. A direct Graph inspection authenticated the test phone asset, returned the expected test number and verified name, and reported a green quality rating. The token is temporary and must be replaced by the production system-user or Embedded Signup credential flow before any real customer release.

The hosted database now contains the `Passion Fruit Pilot` tenant with all current feature grants, an active owner membership for `tripixsolutions@gmail.com`, and the test WhatsApp channel. A signed webhook test was accepted, routed to that tenant, persisted, queued and completed by the private worker. A bad signature was rejected with HTTP 401.

The Hostinger deployment is live at `https://lavender-pheasant-832363.hostingersite.com`. Its production `/api/health` endpoint reports the database and Meta configuration ready while `liveSends` remains `false`. Supabase `pg_cron` invokes the private worker every minute through `pg_net`; the bearer credential is generated in Postgres, stored encrypted in Vault and represented in the application table only by a SHA-256 digest. The first hosted invocation completed with cron status `succeeded`, HTTP 200 and no failed jobs. Production phone onboarding remains pending.

The owner email and password are confirmed, the forced-password flag is cleared, and membership activation completed at authentication revision 2. The authenticated dashboard now reads the workspace name, role, feature grants, connected channel, inbox, agents and contacts from Supabase. Demo records were removed from these connected surfaces, so an empty hosted inbox and agent list are shown truthfully until pilot data arrives.

A hosted two-tenant RLS verification created isolated synthetic tenants, proved that each user could read only its own tenant and contact, proved both cross-tenant reads returned zero rows, and removed all temporary records afterwards. The repeatable check is available as `npm run verify:hosted-rls` and requires the ignored local Supabase credentials.

## Required external verification

The code cannot select a Meta Graph version, create a Meta app, approve a business, create a Supabase project or inspect a Hostinger plan without the owner accounts. Choose the Graph version currently offered in the owner’s Meta app and test with Meta-approved assets. Record the selected version and its removal date before enabling live sends.

## Pilot checks

- `/api/health` reports database and Meta configuration without exposing secret values.
- A platform admin can invite an owner and provision a tenant atomically; the invitation callback activates membership.
- Two users from different tenants cannot read each other’s contacts, conversations, messages, features, campaigns, schedules, workflows or usage.
- Repeating one webhook produces one receipt; repeating a queue delivery does not create a second provider send after a known acceptance.
- Invalid webhook signatures never reach storage. Unknown phone-number IDs enter platform quarantine without being assigned to a tenant.
- A network failure after dispatch becomes `unknown`; an operator must reconcile it rather than trigger an automatic duplicate.
- Opted-out contacts and expired scheduled messages are blocked before dispatch.
- Keep `PF_LIVE_SENDS_ENABLED=false` until these checks pass against the official test asset.
