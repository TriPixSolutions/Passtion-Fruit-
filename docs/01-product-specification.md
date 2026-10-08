# 01 — Product specification

## Intent and boundaries

Build a reliable shared WhatsApp workspace for service, sales and commerce teams, with optional automation and AI. Business-specific behaviour comes from configuration, reusable workflow templates and integrations rather than separate code forks. Meta eligibility and permitted business use remain prerequisites; “all businesses” means a flexible architecture, not universal permission to use WhatsApp.

The first release is an invitation-only pilot. Public self-signup, automatic subscriptions and large campaigns are deferred until onboarding, isolation, metering and support procedures are proven.

## Actors and terminology

| Actor / entity | Meaning |
| --- | --- |
| Platform super-admin | Passion Fruit operator; creates business workspaces and controls entitlements |
| Tenant / workspace | Customer business and the isolation/billing boundary |
| Tenant owner | Customer account administrator; cannot modify platform entitlements |
| Manager | Supervises assigned teams, campaigns and reports within allowed permissions |
| Human agent | Team member replying in the shared inbox |
| Analyst | Read-only permitted reports, with separately granted exports |
| AI agent | Versioned software configuration with purpose, tools, knowledge and limits |
| Contact | Customer's recipient / lead; not a Passion Fruit login account |
| Channel | Business WhatsApp phone number connected to its workspace |
| Workflow | Passion Fruit automation graph |
| WhatsApp Flow | Meta form-like experience delivered inside WhatsApp; a separate feature |
| Campaign / broadcast / bulk send | Audience-based use of the same outbound pipeline |

“AI auto replace” in the brief is interpreted as **AI auto-reply**. If the intended feature is different, revise this requirement before AI implementation.

## Public website: five primary pages

1. **Home:** positioning, benefits, dashboard preview, supported official connection, demo/contact CTA.
2. **About:** company story, support process, operating principles; actual company details supplied by owner.
3. **Features:** inbox, campaigns, AI, workflows, integrations, analytics; distinguish available and planned features.
4. **Workflows / solutions:** lead follow-up, support routing, appointment reminders and order updates, with understandable diagrams.
5. **Demo / contact:** guided product preview and lead form. A sample workspace contains synthetic data and cannot trigger real sends.

Privacy, terms, acceptable use and data deletion pages are additional utility routes, not constrained by the five-page marketing scope. Publish accurate content for the real business before external onboarding. Pricing may be a section initially; add a page once packages and rates are defined. UI follows supplied inspiration after scope is agreed; business logic does not depend on theme choice.

Proposed routes: `/`, `/about`, `/features`, `/workflows`, `/demo`, `/privacy`, `/terms`, `/acceptable-use`, `/data-deletion`, `/login`.

## Super-admin dashboard

Proposed area: `/admin` with server-side platform-role enforcement.

- Business list: status, owners, connected channels, feature bundle, usage and health.
- Business creation: legal/display name, timezone, locale, owner email, trial dates and pilot limits.
- Owner provisioning: invite by email; alternatively create a temporary password, require first-login change, and never store/display recoverable passwords.
- Feature editor: per-feature enable/disable, explicit deny, quotas, expiry and reason; dependency warnings with a before/after preview.
- Account actions: resend invite, initiate password reset, suspend or reactivate, revoke channel, export business data and start documented deletion.
- Operations: failed events, dead-letter jobs, overdue schedules, provider credentials status, kill switches and incident notes.
- Governance: append-only audit history, admin MFA, support-access approval and billing/meters when implemented.

Super-admin access to another business's conversations is not automatically implied by customer creation. Support access requires a scoped, expiring, audited session and the configured customer authorisation policy. No unaudited permanent impersonation button.

## Customer dashboard

| Area | Required behaviour |
| --- | --- |
| Overview `/app` | Inbox backlog, new leads, delivery outcomes, channel health and usage; real measurements |
| Inbox `/app/inbox` | Shared chat, assignment, internal notes, tags, filters, attachments, saved replies and handoff |
| Contacts `/app/contacts` | Auto-save, import, deduplication, segments, custom fields and opt-out evidence |
| Campaigns `/app/campaigns` | Audience selection, template preview, approval, scheduled launch, pause/cancel and per-recipient results |
| Reminders `/app/reminders` | Due actions, appointment or follow-up schedules, cancellation and timezone display |
| Workflows `/app/workflows` | Draft, validation, immutable publish version, executions and recovery |
| AI agents `/app/agents` | Agent purpose, knowledge, allowed tools, confidence policy, costs and human escalation |
| Automation `/app/automation` | Trigger registry, business hours, routing rules, default auto-response and execution logs |
| Templates `/app/templates` | Provider template states, languages, parameters and approved-use preview |
| Commerce `/app/commerce` | Store connection, order context, product references and permitted order/cart notifications |
| Integrations `/app/integrations` | WhatsApp, CRM/store/provider connections and health; scoped credential setup |
| Reports `/app/reports` | Delivery, support and campaign reports with source definitions and export permission |
| Settings `/app/settings` | Team, roles, numbers, privacy, timezone, subscription/usage and notification preferences |

Broadcast / bulk are campaign modes, not independent sending services. Disabled modules may show a simple availability explanation or be hidden, but API authorisation always enforces the grant. Dashboard demos must be labelled; never present seeded metrics as customer analytics.

## Pilot journeys

**Provision:** operator creates tenant → grants core features → invites owner → owner signs in and changes temporary password if used → channel connected through authorised process → test send and receive → workspace marked ready.

**Inbound support:** verified provider event → durable storage → contact upsert → conversation timeline → routing → human agent or one permitted automation reply → outbound pipeline → status projection → dashboard refresh.

**Sales follow-up:** captured lead → permitted workflow → details agent answers from tenant knowledge → follow-up scheduled → reply, opt-out, handoff or closure cancels pending follow-up → approved send at dispatch time.

**Campaign:** eligible segment → unique audience snapshot → template approval check → quota / cost preview → operator confirmation inside application → recipient jobs → dispatch-time revalidation → accepted/delivered/failed report.

## Product acceptance

Owner can create two independent businesses and configure different feature sets. Each owner sees only its own contacts/messages/files. A disabled feature cannot be used through UI, API or background jobs. Both numbers complete an official round trip. A crash after webhook receipt cannot lose an acknowledged event. AI replies can be stopped immediately by human takeover. Scheduling survives app restarts. Reports explain unknown, delayed and failed outcomes. These are release gates, not promises inferred from screenshots.
