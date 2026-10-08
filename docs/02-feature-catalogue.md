# 02 — Feature catalogue and entitlements

## Delivery classes

**C** = core foundation (M1–M3). **P** = pilot expansion (M4–M5). **G** = general SaaS expansion (M6–M7). **L** = later capability requiring further evaluation (M8). These are planned milestones, not implemented availability. M0 covers hosting and UI inputs; M9 covers AWS migration.

The registry below is the source for future navigation, permission checks, admin grants and plan bundles. Implement it as typed data after the database foundation exists.

| Key | Capability | Class | Dependencies | Quota / control |
| --- | --- | --- | --- | --- |
| `overview` | Real dashboard and health | C | membership | query/export scope |
| `whatsapp.channels` | Official account/number connection | C | membership | channel count |
| `inbox.shared` | Chat, assignment, notes, saved replies | C | channels | team seats, retention |
| `contacts.manage` | Auto-save, tags, import/export, custom fields | C | channels for auto-save | stored contacts, import size |
| `contacts.segments` | Filtered audiences and saved segments | P | contacts | segment count |
| `templates.manage` | Create/sync/preview approved templates | C | channels | sync API budget |
| `messages.manual` | Text/media/template messaging | C | inbox, channels | usage + per-phone pacing |
| `messages.schedule` | One-off scheduled sends | C | outbound core | pending schedule count |
| `reminders` | Appointment/task/follow-up reminders | P | schedules, contacts | active reminders |
| `campaigns` | Campaign/broadcast/bulk modes | P | templates, contacts, outbound | recipients/run and daily budget |
| `automation.rules` | Business-hours, keyword and routing rules | P | events, inbox | active rules, action budget |
| `workflows.builder` | No-code chatbot / workflow graphs | P | rules, schedules | published workflows, run steps |
| `whatsapp.flows` | Meta interactive forms and submissions | G | channels, templates as applicable | published Flows, endpoint budget |
| `ai.assist` | Suggested reply, summary and classification | P | inbox | token/cost budget |
| `ai.autoreply` | Controlled automatic customer reply | P | assist, routing, knowledge | reply frequency, daily AI cost |
| `ai.multiagent` | Details, support, qualification, follow-up agents | G | autoreply, workflow state | configured agents, tool calls |
| `knowledge.manage` | Tenant documents and structured facts | P | tenant storage | bytes, indexed chunks |
| `crm.basic` | Lead stages, tasks, activity and ownership | P | contacts | custom fields, pipeline count |
| `crm.integrations` | External CRM connection and sync | G | integration framework | connector count, sync volume |
| `commerce.integrations` | Store/order/cart events | G | integration framework, contacts | stores, event quota |
| `commerce.catalog` | Product references / permitted catalogue messaging | G | channels, commerce | provider eligibility |
| `analytics.basic` | Inbox and delivery measurements | C | event ledger | report lookback |
| `analytics.advanced` | Campaign funnels, response/SLA, agent/AI reports | G | campaigns, event ledger | aggregates, report range |
| `exports` | Asynchronous CSV exports | P | relevant read permission | export count and TTL |
| `integrations.webhooks` | Customer inbound/outbound signed hooks | G | outbound jobs, integration auth | requests/day |
| `platform.api` | Scoped API keys and public SDK | G | stable v1 API, metering | key count, request rates |
| `voice.audio` | Recorded audio/media send and playback handling | L | media, outbound | bytes, audio duration |
| `voice.transcribe` | Optional inbound audio transcription | L | audio, AI provider | minutes, consent/privacy controls |
| `voice.synthesize` | Brand voice / consented voice synthesis | L | AI, audio | voice authorisation and spend |
| `billing` | Plans, invoice status and provider webhook reconciliation | G | meters, entitlements | configured commercial policy |
| `team.advanced` | Teams, SLA, round-robin and business hours | G | shared inbox | seats/teams |
| `channels.additional` | Instagram/Messenger/email adapters | L | channel abstraction | separate provider review |

## Defaults and user controls

Tenant-specific values are configuration, not source edits. Start with manual provisioning bundles `pilot-core` and `pilot-ai`. Bundles are templates copied or referenced into effective grants; changing a template must not silently rewrite existing customer contracts.

Per-tenant grant fields: `feature_key`, `enabled`, `limit_value`, `limit_unit`, `valid_from`, `valid_until`, `source`, `reason`, `revision`. Per-user deny/allow overrides can further constrain a valid tenant grant, never create a feature the business does not have. A manager with campaigns enabled may draft a campaign while an agent is restricted to inbox replies. Time-limited customer grants expire even when a session or queued job predates expiry.

Dependencies are a directed acyclic graph. The editor offers a preview of required dependent changes, then persists grants atomically. Explicit deny wins; platform suspension wins over everything. Core safety controls, audit trails and tenant isolation cannot be disabled by customer settings.

The admin UI must support disabling a module and separately tuning quotas. No arbitrary executable expressions, SQL or JavaScript in feature configuration. Use validated schemas and a finite key registry. Publish a registry version and keep historic keys for audits.

## Additional useful scope

Include reusable workflow templates, lead source capture, multilingual replies including Malayalam/English, user timezone settings, business hours, consent provenance, suppression lists, delivery error explanations, token expiry warnings, data export/deletion, billing estimates, audit history and platform-wide emergency send/AI switches. These directly support the requested system's operation.

Do not initially add a marketplace, general-purpose website builder, a proprietary payment gateway, a second inbox engine or a separate broker per module. Add a new component only for a demonstrated product or capacity need.

## Pilot caps — starting proposal

Two tenants; one connected number each; three human seats per tenant; 1,000 stored contacts per tenant; 100 recipients per campaign; 200 outbound attempts per tenant per day; one send/sec per number; two published workflows; two configured AI roles; limited allowlisted test recipients initially. All values are internal starting caps and adjustable after measurement. The final permitted send rate is the minimum of these caps and provider/account restrictions. None describes Meta's guaranteed capacity.

Quotas reserve before dispatch and reconcile actual outcomes. Count outbound attempts separately from provider-delivered billable messages. Failed/retried jobs must not inflate a usage meter keyed by logical operation. AI spend is capped using reservations before a model call and measured token/cost reconciliation afterward. See data and operations specifications for enforcement and test cases.
