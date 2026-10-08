# 09 — Hostinger pilot deployment, GitHub and AWS migration

## Hosting decision and evidence

Hostinger's current official guide lists Cloud Startup among plans supporting Node.js web applications and GitHub-based deployment. It also lists supported frontend/backend frameworks and managed build settings. This establishes a plausible Node pilot; it does not verify this owner's actual hPanel settings, region, account entitlement or runtime limits. [Hostinger Node deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)

Managed web/cloud hosting is not treated as an unrestricted VPS. Avoid designing around Docker, root access, arbitrary daemon supervision, a local Redis server, local GPU inference or durable local files. Hostinger documents scheduled tasks for web/cloud plans; custom background process control belongs to different hosting capabilities. [Hostinger server capabilities](https://www.hostinger.com/support/which-server-capabilities-are-supported-at-hostinger/)

Use Hostinger for the public website, dashboards and API. Supabase owns the pilot data services, provider callback, queue, scheduling and bounded workers. Therefore a Hostinger app restart does not erase schedules or webhook receipts.

## M0 capability check — before building deployment-dependent code

Owner/developer checks the selected account for:

| Check | Evidence to record | If unavailable |
| --- | --- | --- |
| Node.js app option on actual Cloud Startup | hPanel entry + plan entitlement | Ask hosting support; use fallback below |
| Selected patched Node version and build/start settings | Successful smoke build/deploy | Choose compatible supported version |
| npm workspace root/build output handling | Minimal workspace deployment | Prebuild in CI or adjust deployment root |
| Environment variable isolation | Server reads secret; browser build excludes it | Block credentialed deployment until resolved |
| Outbound HTTPS to Supabase/Meta | Health connection check, no logged tokens | Verify network restrictions/support |
| Request/body/time/resource limits | Account documentation + observed smoke limits | Keep media direct-to-storage and jobs external |
| HTTPS/domain/DNS and routing | Working pages, API and redirects | Fix routing/TLS before onboarding |
| Deploy restarts/rollback behaviour | Smoke redeploy and recovery notes | Establish rollback procedure |

No actual Hostinger account access is available in this kit. Node support is a research finding; the capability check remains outstanding.

If Node is unavailable, preserve the domain architecture: host a static marketing/app shell on Hostinger and move required HTTP API endpoints to Supabase Edge Functions or another approved small Node host. This is an explicit alternative deployment profile, not an automatic assertion that every Next.js server route works in static hosting. Validate Auth/session approach and API portability; otherwise a small VPS/Node runtime is a prerequisite. Keep one domain implementation rather than rewrite the project in a different language purely for hosting.

## Environments

- **Local:** app and Supabase local stack when feasible; synthetic data, mocked Meta adapter by default.
- **Pilot/staging:** dedicated Supabase project and Hostinger preview/test domain, two tenants, allowlisted recipients and conservative caps. Live send switch defaults off.
- **Production:** separate credentials/project and real customer data once gates pass. Do not reuse development app secrets or publish staging credentials.

Start with one hosted pilot project to control cost; production separation becomes mandatory before wider onboarding. Do not install a sites-hosting or other deployment workflow for this repository; the selected target is Hostinger.

## Supabase setup sequence

1. Select suitable region near customers and hosting; record project owner and restricted operator access.
2. Initialise CLI/local migration history. Enable only needed extensions (`pgmq`, `pg_cron`, `pg_net`, later vector as justified).
3. Apply reviewed SQL migrations for core schema, RLS, composite foreign keys, indexes and least-privilege RPC grants.
4. Configure Auth redirect URLs, invitation/password reset, custom SMTP and disabled public signup; bootstrap platform admin securely outside public endpoints, then require MFA.
5. Create private storage buckets and ownership policies; verify upload/download denial across tenants.
6. Deploy provider ingress with raw signature validation. Deploy bounded worker with internal authentication. Put secrets in runtime secret settings, not source/config committed to Git.
7. Configure cron dispatcher/outbox relay/worker wake-ups using Vault-protected invocation secrets. Ensure overlapping runs cannot claim the same logical work.
8. Configure private Realtime subscriptions and reconnection resync.
9. Set budgets, caps, allowlist and global send switch. Establish backup/export and monitoring before adding real data.
10. Seed synthetic A/B tenants, run isolation and crash tests, then provision real pilot tenants using admin UI.

Queue visibility initially 60 seconds for 20-second batches; short external request deadlines prevent budget overruns. Heartbeat/renew for longer work only when runtime allows it. Use one small dispatcher cadence (initial target 10 seconds where supported/affordable), low-concurrency worker triggers and per-invocation bounds. Observe invocation/DB cost before shortening cadence. Guaranteed subsecond scheduled delivery is outside pilot scope.

## Hostinger and domain setup sequence

1. Create the implemented web application's build/start scripts and lockfile; verify production build locally/CI.
2. Configure Hostinger Node app from the GitHub repository and actual supported build-root settings.
3. Put public URLs/publishable key and server-only variables in the correct runtime settings; inspect built browser assets for secrets.
4. Connect example future domains `www.<owned-domain>` and `app.<owned-domain>` as appropriate; no domain is assumed purchased. The callback may stay on the Supabase function HTTPS URL during pilot.
5. Verify marketing routes, login/reset callbacks, authenticated API, private uploads, realtime reconnection and health endpoints.
6. Configure Meta callback/signups using exact deployed HTTPS URLs and validated domain allowlists.
7. Perform smoke tests after deploy and after restart. Enable live sends only after core release gates pass.

Do not depend on a persistent Hostinger filesystem for uploads, job state or logs. Structured logs go to configured logging; private media goes to object storage. Any cron backup on Hostinger is operational fallback, not the authoritative schedule ledger. Hostinger documents UTC cron schedules; always translate app business schedules independently. [Hostinger cron](https://support.hostinger.com/en/articles/1583465-how-to-set-up-a-cron-job-at-hostinger)

## GitHub repository and CI/CD

The current selected folder contains the development kit. No GitHub repository has been created/pushed. At implementation, create a private repository under the owner's chosen account and connect it to Hostinger. Account, repository name and access remain owner inputs.

Pipeline: install pinned dependencies → typecheck/lint → core unit and DB isolation tests → contract tests → production web/Edge builds → targeted browser smoke tests → review migration → staging deployment → pilot smoke → production promotion after release gate.

Use protected branches/reviews for deployable code. If Hostinger automatically deploys each push to its connected branch, connect a release/deploy branch that advances only after CI passes; automatic GitHub integration must not race ahead of required checks. No credentials in Actions logs, PR previews or public sample environment files.

Database changes use expand → deploy compatible code → backfill → contract in a later release. Apply migrations through a controlled job/tooling step; do not run destructive migrations from every app startup. Runtime rollback is safe only while schema remains compatible. Document deployed commit SHA and migration version.

## Cost model and pilot budget controls

The existing Hostinger subscription is sunk pilot hosting spend, not proof every other component is free. Managed Supabase free tier can be useful for synthetic/controlled tests, but quotas, pausing, backup and service guarantees must be inspected before real customer reliance. Production may require a paid plan.

Monthly model:

```text
Hostinger allocation
  + Supabase plan, DB/storage/egress/function/realtime overage
  + Meta delivered-message charges per current rate rules
  + AI input/output tokens, embeddings, transcription or synthesis
  + SMTP, domain, logs/monitoring
  + connector/provider fees
  + later AWS compute, database, queues, storage, networking and observability
```

A configured budget worksheet should track tenant volume, recipients by market/category, attachment bytes, knowledge size, AI token usage, invocation count, retention and human seats. Exact costs are not estimated without these inputs and current selected plan quotes. Never advertise unlimited messages or unlimited AI on the basis of shared hosting capacity.

Suggested pilot spending controls: tenant daily attempt caps, 100-recipient campaign cap, AI hard budget in configured currency, storage retention, function execution caps, resource alerts and kill switches. Product UI shows consumption and actionable limits; hitting a cap queues/blocks visibly rather than failing silently.

## AWS migration phases

**A — App/worker migration, retain Supabase:** containerise Node web/API and worker; deploy ECS Fargate behind TLS/load balancer; configure logs and secrets; move ingress after signature regression tests. Keep DB/Auth/Realtime/storage to avoid unnecessary simultaneous migrations.

**B — Broker migration:** implement SQS adapter and adapter contract tests. Pause outbox relay briefly at a recorded event watermark; drain or transfer old queued job references; switch relay to SQS; resume with unchanged logical job IDs. Only one sending consumer profile owns dispatch at a time. Old queue references are either completed or invalidated visibly; do not run two independent send pipelines. Schedule source stays in Postgres; EventBridge wakes the dispatcher.

**C — Optional storage migration:** copy verified objects to S3, retain dual-read fallback temporarily, verify checksums/access/retention, switch writes, then expire old signed links and remove old data according to policy. Never blindly copy public ACLs.

**D — Optional database migration:** assess Supabase capacity first. If justified, migrate compatible schema/data/extensions and preserve tenant keys. Take a tested backup; rehearse restore; compare counts/checksums; use a controlled write freeze or explicitly tested change capture; cut over connection/identity integrations; verify policies and user journeys; resume workers from durable checkpoints. Auth, Storage and Realtime replacement are separate projects if moving off Supabase entirely.

## Migration triggers and rollback

Move before capacity is exhausted: sustained queue age above SLO, recurring function-budget failures, DB/resource pressure, high import/indexing/voice workloads, inability to support required runtime, or product commitments requiring stronger availability. Customer count alone is not the scaling signal.

Rehearse rollback in staging. Freeze dispatch during cutover validation. Restore previous app/broker profile and resume from the known watermark if migration fails before new incompatible writes. If new DB writes have occurred, reconcile them before rollback; restoring an old backup can discard accepted messages and is not an automatic safe option. Preserve unknown-send state throughout migration.
