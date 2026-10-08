# Passion Fruit — Project Development Kit

**Version:** 1.2 · **Updated:** 8 October 2026 · **Stage:** connected Supabase and Meta test pilot; live sending locked off.

Passion Fruit is a multi-tenant WhatsApp automation SaaS using Meta's official business messaging APIs. This kit defines the product, technical boundaries, core reliability rules, development sequence, and migration path from a two-customer Hostinger pilot to AWS.

This repository now contains the development blueprint, the owner-approved responsive UI prototype, Supabase migrations, RLS policies, Auth lifecycle, a typed SDK, authenticated API routes, encrypted Meta channel storage, signed webhook ingestion, the durable outbox/queue worker and the first scheduling/automation data model. The owner Supabase project and Meta test asset are connected. Filled credentials stay in ignored local or hosted secret stores and are never committed. Hostinger deployment and GitHub publication remain pending.

## Owner overview — മലയാളം

Passion Fruit-ൽ മൂന്ന് പ്രധാന ഭാഗങ്ങളുണ്ടാകും: public website, customer creation / feature control ചെയ്യാനുള്ള super-admin dashboard, ഓരോ business-നും സ്വന്തം user dashboard. ഒരു customer എന്നത് ഒരു business workspace (tenant) ആണ്; ആ business-ൽ owner, manager, human agents തുടങ്ങിയ പല users ഉണ്ടാകാം. AI agents വേറെ configuration entities ആണ്.

ആദ്യ test-ൽ 1–2 business workspaces, ഓരോന്നിനും ഒരു WhatsApp number എന്നതാണ് default. Core-ൽ official API connection, secure login, tenant isolation, shared inbox, contact auto-save, approved template sending, durable webhook processing, queue, scheduling, feature permissions എന്നിവ ആദ്യം build ചെയ്യും. അതിനുശേഷം AI auto-reply, lead follow-up agent, product-details agent, no-code workflows, campaigns എന്നിവ ഘട്ടംഘട്ടമായി enable ചെയ്യും. Voice features-ും commerce / CRM integrations-ും തുടർന്നുള്ള phases-ലുണ്ട്.

Hostinger Cloud Startup-ൽ website / app deploy ചെയ്യാം എന്നാണ് നിലവിലെ official documentation പറയുന്നത്. Queue, scheduler, bounded background processing എന്നിവ Supabase-ൽ വയ്ക്കുന്ന pilot design ആണ് ഇവിടെ നൽകിയിരിക്കുന്നത്. നിങ്ങളുടെ actual hPanel-ൽ Node.js option, environment settings, request limits എന്നിവ പരിശോധിച്ചശേഷം deployment configuration final ചെയ്യണം. AWS-ലേക്ക് ആദ്യം app / workers മാത്രം move ചെയ്യാം; database migration ഉടൻ നിർബന്ധമില്ല.

“Bug ഒന്നുമില്ല” എന്ന് architecture കൊണ്ടുമാത്രം ഉറപ്പുനൽകാൻ കഴിയില്ല. അതിന് പകരം ഓരോ core failure case-നും tests, pilot acceptance gates, alerts, recovery runbooks എന്നിവ ഇവിടെ നൽകിയിട്ടുണ്ട്. Duplicate webhook, worker crash, expired token, രണ്ട് customers-ന്റെ data mix ആവുന്നത്, AI / human ഒരേ സമയം reply ചെയ്യുന്നത് തുടങ്ങിയ cases release-നുമുമ്പ് പരിശോധിക്കണം.

## Read in this order

| Document | Purpose |
| --- | --- |
| [Product specification](docs/01-product-specification.md) | Website, admin and customer surfaces; product terminology and requirements |
| [Feature catalogue](docs/02-feature-catalogue.md) | Full requested feature scope, priorities, quotas and rollout dependencies |
| [Architecture](docs/03-architecture.md) | Pilot / AWS diagrams, modular boundaries and runtime choices |
| [Core messaging](docs/04-core-messaging.md) | Webhook durability, queues, ordering, retries, scheduling and ambiguous sends |
| [Data and access](docs/05-data-and-access.md) | Tables, isolation, auth, roles, configurable entitlements and credential handling |
| [API and SDK contracts](docs/06-api-and-sdk.md) | API inventory, errors, events, adapter contracts and SDK evolution |
| [AI and workflows](docs/07-ai-and-workflows.md) | Multiple agents, knowledge, human handoff and durable workflow execution |
| [Meta integration](docs/08-meta-integration.md) | Official onboarding, templates, policy constraints and release verification |
| [Deployment and migration](docs/09-deployment-and-migration.md) | Hostinger / Supabase setup, GitHub pipeline, budgets and staged AWS migration |
| [Quality and operations](docs/10-quality-and-operations.md) | Acceptance tests, measurable targets, incident recovery and backups |
| [Delivery roadmap](docs/11-delivery-roadmap.md) | Concrete implementation milestones, dependencies and owner inputs |
| [Decisions and sources](docs/12-decisions-and-sources.md) | Design decisions, assumptions, risks and evidence confidence |
| [UI direction](docs/13-ui-direction.md) | Owner-approved visual language and implemented local prototype routes |
| [Reference contracts](contracts/reference.ts) | Illustrative TypeScript types; no implemented transport or adapters |
| [Environment template](apps/web/.env.example) | Runtime names and intended scopes; placeholders only |
| [Implementation setup](docs/14-implementation-setup.md) | Apply migrations, bootstrap the operator, connect Meta, deploy and verify the pilot |

## Current implementation milestone

M1 and the connected portion of M2 are implemented: tenancy, membership activation, feature grants, credential encryption, provider verification, signed webhook receipt, inbox persistence, outbound intent creation, queue relay and a bounded worker. All migrations are applied to the owner Supabase project. The Meta test asset is connected and a signed webhook has completed the hosted receipt-to-queue-to-worker path. The next gates are accepting the owner invitation, running the two-tenant denial suite, deploying to Hostinger, onboarding a permitted recipient and completing one owner-approved receive/send/status round trip before enabling live sends.

## Documentation conventions

- **MUST** is a release requirement. **SHOULD** is a recommended default. A **target** is a proposed engineering objective, not measured performance.
- **Pilot** means a controlled two-business trial with restricted volume. It does not imply approval for unrelated production customers.
- Technical decisions are recommendations for this project. Platform capabilities and API versions must be reconfirmed at implementation and release.
- No placeholder packages, empty application folders or pretend integrations are included. The proposed folder tree becomes real only as modules are implemented.
