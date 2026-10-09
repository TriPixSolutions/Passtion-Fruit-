# 11 — Delivery roadmap and development handoff

## Build sequence

UI work can run alongside the foundation after inspiration arrives; the messaging round trip and isolation gates determine readiness. A polished website alone is not a working SaaS. Milestones below are completion gates, not fixed dates or claims of completed development.

| Milestone | Deliverable | Exit gate |
| --- | --- | --- |
| **M0 — Design / capability validation** | This kit, owner UI references, chosen pilot identities/domain, Hostinger smoke, runtime/version checks | Hosting path verified, initial scope resolved |
| **M1 — Tenant foundation** | Workspace repo/CI, SQL migrations/RLS, Auth, admin business creation, roles, feature editor, invitation/reset | Q01/Q03–Q07 for implemented foundation paths; two isolated tenants with different grants |
| **M2 — Messaging round trip** | Official adapter, signed ingress, event ledger, outbox/queue/worker, messages/statuses, channel setup | Q08–Q18; permitted official receive/send/status proof |
| **M3 — Usable core** | Shared inbox, contacts, private media, template UI, schedules, quotas, basic analytics and operations | Q02/Q05/Q18–Q21/Q28; restart/backup drill; core pilot readiness |
| **M4 — AI / workflow pilot** | Knowledge, suggestion mode, limited auto-reply, two agent roles, no-code graph/run UI, human handoff | Q22–Q26 plus evaluation and spend caps |
| **M5 — Campaign pilot** | Segments, audience snapshot, campaign/broadcast/bulk UI, reminders, pause/resume and reports | Q21/Q27/Q28; low-volume test with approved recipients |
| **M6 — Business integrations** | First selected CRM/store connector, lead tasks, advanced reports, optional Meta Flows | Q29/Q30; verified connector/Flow protocols and permissions |
| **M7 — General SaaS readiness** | Commercial packages/billing, stable v1 API/SDK, support access, export/deletion, audit operations | Provider external onboarding gates; security/recovery review; customer docs |
| **M8 — Advanced voice / additional capabilities** | Recorded audio, evaluated STT/TTS, authorised brand voice, future channels | Separate capability, consent, cost and quality proof |
| **M9 — AWS capacity migration** | Runtime/broker cutover first, optional data-service migration later | Q32, load/recovery evidence and rollback rehearsal |

Public site with its five primary pages, legal utility routes and dashboard UI shells may be built during M1–M3 after owner inspiration. Label previews honestly and wire real data as modules land. Do not add fake functional campaign/AI controls before their engines exist.

Each cross-cutting test is repeated only when a new relevant path appears: Q01 expands to messages in M2; Q02 completes when storage/Realtime exist in M3; Q04/Q05 expand to AI and campaigns in M4/M5. An early foundation pass does not substitute for coverage of later modules.

## First concrete implementation backlog

1. Validate actual Hostinger Node support with minimal app; record build/start/root and secret settings.
2. Choose compatible patched runtime/dependency versions, create npm workspace and locked installs.
3. Set up migrations for tenants, membership, roles, grants, audit and provisioning saga.
4. Implement RLS/composite foreign keys and two-tenant denial fixtures.
5. Configure Auth invitation/reset/MFA and first operator bootstrap.
6. Implement admin create-business and customer-specific grants with API tests.
7. Create messaging/channel/event/outbox/job migrations and narrow worker/ingress RPCs.
8. Deploy signed provider ingress and internal bounded worker; test crashes without real sends.
9. Connect authorised test assets; capture real fixtures and select supported Graph version.
10. Implement outbound intent/attempt/status linking and unknown-send state.
11. Build first functional inbox/contacts/templates pages from supplied design references.
12. Complete pilot core acceptance and backup recovery before AI/campaign expansion.

## Required owner inputs, by the time they are used

| Input | Needed for | Can proceed before it? |
| --- | --- | --- |
| Website, customer dashboard, super-admin UI inspiration | Visual implementation | Core contracts/data design yes |
| Passion Fruit legal/company details and owned domain | Public site, terms/support, Meta review | Local/synthetic build yes |
| Actual hPanel Node app capability | Final deploy profile | Portable domain/core work yes |
| GitHub account/repository owner/name | Remote repository and deploy integration | Local implementation yes |
| Supabase project access/region/plan | Hosted data/functions/Auth | Local migrations/tests yes |
| Meta app/business status and test assets | Official live round trip / customer onboarding | Mock reliability tests yes |
| Pilot customers, permitted test recipients and numbers | Live pilot validation | Synthetic A/B tenants yes |
| Owner preference: invitation vs temporary password | First account delivery workflow | Default invitation; temporary option specified |
| Pilot AI/hosting monthly spend ceiling | Enable paid calls and commercial defaults | AI disabled, contracts/evals can be designed |
| Chosen first CRM/store | Connector implementation | Connector framework yes |
| Actual packages/features/prices | Automated billing and marketing price claims | Manual pilot grants yes |
| Meaning/authorisation for real-person voice | Voice phase | All prior milestones yes |

Credentials must enter provider secret settings or authorised secure tooling, not documentation or public chat. The kit records these dependencies without blocking useful initial work. UI references are expected in the next message, as the owner indicated.

## Pilot customer onboarding checklist

Create isolated business and owner → verify invitation/password/MFA policy → assign feature bundle and limits → connect authorised number → validate recipient permission and approved content → send/receive/status test → teach human takeover/opt-out handling → verify timezone and reminder preview → record support contact and usage budget → enable only proven modules → review pilot evidence daily during controlled trial.

Use synthetic examples for demos and separate allowlisted recipients for actual tests. After both pilot customers pass, increase one limit/module at a time with monitoring. Do not jump from two successful chats to unbounded campaigns.

## Documentation maintenance

Every implementation PR updates changed contracts, relevant test gates, deployment assumptions and decisions. Record implemented status separately from planned scope. New features require feature key, data ownership, API/use case, migration, entitlement, metering, failure/recovery path and relevant tests. Empty folders and unused adapters are not deliverables.

## Current completion status

Completed: development kit, responsive UI, executable domain/adapters/contracts/SDK packages, Supabase migrations and RLS, invitation activation, super-admin tenant/feature APIs, encrypted Meta channel credentials, provider asset verification, signed Edge webhook ingress, durable receipt/outbox/pgmq jobs, inbound normalization, outbound state handling and hosted cron. The authenticated overview, inbox, contacts, schedules, campaign drafts, workflow drafts, agent creation and settings screens now read and write tenant data through the authenticated APIs. Type checks, unit tests and the Hostinger production build pass.

Verified externally: Hostinger deployment, Supabase migrations and two-tenant RLS checks, Meta app/test-number connection, a permanent encrypted system-user credential, application-level live-send activation, approved-recipient outbound status callbacks and inbound reply persistence, plus the scheduled hosted worker. The live shared inbox now provides search and operational queues, expanded ticket status, validated member/team assignment, ownership-safe handoff and tenant-isolated private notes. Published inbound workflows execute the supported condition, delay, message and assignment nodes; scheduled and manually launched campaigns enter the durable recipient/send pipeline. Pending gates include SLA policies, mentions/saved replies, campaign audience snapshots and safety controls, the full visual workflow node/runtime set, backup/restore drill and production telemetry. AI provider calls, CRM/commerce connectors, billing and advanced voice remain later milestone work; their schema or UI presence does not mean they are enabled for customers. The competitive expansion and implementation order are defined in document 15.
