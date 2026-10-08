# 12 — Architecture decisions, assumptions and research

Prepared **7 October 2026**, using the owner's Asia/Kolkata date context. Research describes publicly documented behaviour at preparation time, not verification of any account. Links below are primary sources; third-party search results were not used as technical authority.

## Decision register

| ID | Decision | Why | Revisit when |
| --- | --- | --- | --- |
| D01 | Official Meta API only | Required by brief; avoids fragile unofficial sessions | Provider adapter/version updates |
| D02 | Tenant = business; users and AI agents separate | Clear isolation, billing and permissions | Enterprise org hierarchy required |
| D03 | Modular monolith; no initial microservice mesh | Low budget and maintainable module ownership | Measured isolation/scaling needs |
| D04 | Hostinger Node web/API + Supabase processing | Fits existing plan while externalising durable jobs | Actual hPanel check or pilot resource evidence |
| D05 | Postgres queue/outbox first, SQS adapter later | Avoid initial broker infrastructure; preserve correctness | Queue/DB pressure or AWS phase |
| D06 | At-least-once processing with internal dedupe | Resilient retry/crash behaviour | Never promise exactly-once external sends |
| D07 | Unknown provider send is an explicit state | Prevent blind duplicate sends | Provider offers verified idempotent/reconciliation contract |
| D08 | RLS + composite ownership constraints + service checks | Tenant isolation across every data path | Every schema/connector addition |
| D09 | Feature grants enforced in API and dispatch | Customer customisation cannot bypass security | New feature/plan semantics |
| D10 | Invitation default, temporary-password option | Satisfies operator creation without password retention | Owner preference/account policy |
| D11 | One AI controller and shared send pipeline | Avoid competing agents and bypassed policy | Evaluated multi-agent expansion |
| D12 | Workflows immutable and checkpointed | Safe edits/restarts/replay | Workflow engine evolution |
| D13 | Keep the approved minimal UI direction while backend work proceeds | Owner accepted the rebuilt design for the current development phase | Production UI optimisation pass |
| D14 | Supabase can remain during AWS runtime migration | Avoid simultaneous identity/storage/database rewrite | Actual capacity or cost case |
| D15 | Create modules only with an implemented contract, migration, route, adapter or test | Readable developer handoff | Each implemented module |

## Assumptions and unresolved gates

| Gate | Current assumption / unknown | Resolution |
| --- | --- | --- |
| H01 | Cloud Startup Node option available to this account | Actual hPanel smoke deployment; use documented fallback if unavailable |
| H02 | “SDK” means first-stage full development blueprint | This deliverable clearly separates specification from executable SDK |
| H03 | “AI auto replace” means auto-reply | Confirm before M4 if owner intended another action |
| H04 | Two tenants, one phone each, mostly Malayalam/English | Update pilot caps/locales if owner changes target |
| H05 | Owner has no confirmed Meta/provider approval in workspace | Inspect app dashboard; no external-business approval exemption assumed |
| H06 | Exact supported Graph version and signup configuration unknown | Verify and pin during M0/M2 |
| H07 | Meta v4/asset terminology and rollout specifics may evolve | Confirm current first-party docs/dashboard; no hardcoded retirement date |
| H08 | Edge CPU/time and queue polling fit small pilot | Build both runtimes and measure bounded workers/invocation cost |
| H09 | CRM/store/AI provider/budget are not specified | Keep ports and defaults; choose before each connector/model phase |
| H10 | Voice means authorised business voice feature | Explicit owner/person authorisation and provider review in M8 |
| H11 | No performance or recovery measurements yet | Execute quality/load/restore gates before commitments |
| H12 | Legal retention/eligible use depends on actual business | Owner supplies contracts/notices and validates launch obligations |

## Principal risks and mitigations

**Tenant data leak:** RLS tests, composite FKs, private storage, scoped realtime and tenant-filtered AI retrieval; audit privileged operations.

**Duplicate/lost message:** durable receipt/outbox, event/action dedupe, atomic leases, explicit send_unknown and controlled replay. No claim that a broker can make a remote API transactional.

**Host limits / delayed jobs:** independent processing, bounded batches, queue-age alerts, conservative caps, AWS capacity trigger before commitments.

**Provider review or account restriction:** begin verification early, separate test from external customer eligibility, store health/capabilities and pause affected traffic.

**Runaway AI or unsupported answers:** suggestion-first rollout, limited intents, scoped tools, sourced knowledge, evaluated changes, spend caps and human fallback.

**Integration complexity:** one selected connector at a time, official contracts, clear data source ownership, sync cursor/reconciliation and no duplicate inbox engines.

**Scope expansion:** full catalogue is preserved, but only gated modules are enabled. Later voice, commerce and multi-channel features do not delay a provable messaging core.

## Source register and confidence

| Source | What was verified from it | Confidence / limit |
| --- | --- | --- |
| [Hostinger Node deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) | Cloud Startup Node support and GitHub/build deployment route | Official page accessible; owner account unverified |
| [Hostinger Node options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/) | Managed cloud/web Node route distinct from manually managed hosting | Official accessible |
| [Hostinger capabilities](https://www.hostinger.com/support/which-server-capabilities-are-supported-at-hostinger/) | Scheduling/background-control distinction | Official accessible; no daemon guarantee inferred |
| [Hostinger cron guide](https://support.hostinger.com/en/articles/1583465-how-to-set-up-a-cron-job-at-hostinger) | Cloud/web scheduled tasks and UTC basis | Official accessible; hPanel specifics may change |
| [WhatsApp policy](https://whatsappbusiness.com/policy/) | Recipient/content/service-window/escalation/eligibility constraints | Official accessible; last-update shown September 2026 |
| [Official pricing](https://whatsappbusiness.com/products/platform-pricing/) | Delivered-message pricing with market/category variation | Official accessible; no fixed rate quote used |
| [Meta v4 announcement](https://developers.meta.com/resources/videos/unified-onboarding-whatsapp/) | v4 unified onboarding direction | Official accessible; exact migration deadline not verified |
| [Meta Tech Provider sample](https://github.com/fbsamples/business-messaging-sample-tech-provider-app) | Reference lifecycle and external-business review prerequisites | First-party sample; not production tenancy code |
| [Meta-hosted webhook signature reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/) | Challenge/POST signature distinction | Older first-party reference; current payload validation still required |
| [Supabase Queues](https://supabase.com/docs/guides/queues) | Durable Postgres/pgmq queue and visibility-window semantics | Official accessible; not external exactly-once guarantee |
| [Supabase Cron](https://supabase.com/docs/guides/cron) | Persisted scheduling and bounded operation recommendations | Official accessible |
| [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) | pg_cron/pg_net invocation and secret handling pattern | Official accessible |
| [Supabase function limits](https://supabase.com/docs/guides/functions/limits) | Finite CPU/memory/wall clock constraints | Official accessible; inspect selected plan at deployment |
| [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | Policy/security boundaries and privileged bypass | Official accessible; project policies still to implement/test |
| [Supabase backups](https://supabase.com/docs/guides/platform/backups) | Plan-dependent recovery and object backup separation | Official accessible; restore drill pending |
| [AWS SQS at-least-once](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) | Redelivery requires idempotent consumers | Official accessible |
| [AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) | Managed container runtime option | Official accessible; target only, not provisioned |

## First-party pages needing re-verification

- [Meta WhatsApp overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
- [Meta Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)
- [Embedded Signup v4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4)
- [Meta webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)

These pages were unavailable/rate-limited during research. Record verified current payload/permission/version behaviour at M2, and obtain current official Meta Flow/voice/commerce references before their milestones. Do not convert inaccessible pages or third-party summaries into verified platform guarantees.

## Change process

Add a decision entry when an assumption changes. Update affected feature/API/data/deployment/test documents together. Keep platform facts and proposed internal engineering targets distinct. A future implementation must report its own tested evidence; this architecture kit is not that evidence.
