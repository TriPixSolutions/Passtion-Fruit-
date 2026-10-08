# 15 — Competitive product plan: inbox, agents, automation and commerce

## Product decision

Passion Fruit will be an official WhatsApp-first customer operations platform for sales, support, marketing and commerce. The product should combine four strengths:

1. Zapelite-style operational clarity: one contact, one inbox, ticket stages, routing, CRM, campaigns and commerce in a connected workspace.
2. WATI-style reliability: official WhatsApp onboarding, shared-team operations, templates, broadcasts, no-code chatbots, assignments, permissions and reporting.
3. Jotform-style agent creation: reusable agent templates, knowledge training, tools/actions, forms, channel configuration and safe human handoff.
4. Passion Fruit's own modular architecture: tenant-specific feature grants, guarded AI, durable jobs, provider-independent ports and a low-cost pilot that can move to AWS without rewriting business rules.

The interface may learn from Zapelite's information hierarchy, but it must use an original Passion Fruit visual system and original components. We should reproduce useful interaction patterns, not proprietary screens, wording or assets.

## Research summary

Research was limited to public product pages and official help material available on 8 October 2026. Marketing claims are treated as competitor claims, not independently verified performance guarantees.

### Zapelite

Zapelite presents WhatsApp, Instagram and Messenger in one team inbox. Its public product surface emphasizes ticket stages and SLA policies, round-robin and business-hours routing, contact lifecycle and lead scoring, mentions, quick replies and idle nudges. Its Bot Builder exposes triggers, messages, questions, input collection, branches, memory, actions, scoring, tickets, waits and human handoff. Campaign controls include live segments, exclusions, quiet hours, pacing, template-quality protection and funnel/cost measurements. CRM includes pipelines, lead qualification, deal ageing and Contact 360. Commerce includes Shopify/WooCommerce sync, cart recovery, payment links, invoices, stock alerts and reviews. AI Copilot includes draft replies, summaries, intent classification, lead scoring, document-backed answers and bring-your-own-model credentials. [Zapelite product overview](https://www.zapelite.io/) and [Zapelite industry/product overview](https://www.zapelite.com/)

### WATI

WATI's official material describes a multichannel team inbox for WhatsApp, WhatsApp calls, RCS, Instagram, Facebook Messenger and WebChat, with linked profiles, assignment, chat status, teams, tags, quick replies, notes, filters and restricted views. Its chatbot builder supports messages, questions, conditions, variables, delays, templates, lists/buttons, webhooks, team assignment, fallback, subscriptions, AI-assisted collection and escalation. Its broader platform combines campaigns, templates, Click-to-WhatsApp lead capture, integrations and AI/human handoff. [WATI team inbox](https://support.wati.io/en/articles/11463002-how-to-use-the-multi-channel-team-inbox-in-wati), [WATI chatbot collection](https://support.wati.io/en/collections/13040156-chatbots), [WATI product overview](https://www.wati.io/product-overview/)

### Jotform AI Agents

Jotform focuses on configurable agents that answer questions, collect structured data, fill forms and invoke actions. Its public feature catalogue includes chat, live handoff, phone and voice agents, forms, tools, integrations, multiple channels, enterprise access and templates. Shopify use cases include catalog training, product recommendations, cart updates, order tracking, policies and live-agent escalation. Its template library demonstrates the value of starting from an industry/job template instead of an empty canvas. [Jotform AI Agent features](https://www.jotform.com/ai/agents/features/), [Jotform Shopify agent](https://www.jotform.com/ai/chatbot/shopify/ecommerce-store/), [Jotform agent templates](https://www.jotform.com/agent-templates/all-categories)

## Competitive capability matrix

Legend: **Live** means present and verified in the current Passion Fruit pilot; **Foundation** means schema/API or partial execution exists; **Plan** means this document defines the implementation but it is not yet customer-ready.

| Capability | Zapelite | WATI | Jotform | Passion Fruit state | Target priority |
| --- | --- | --- | --- | --- | --- |
| Official WhatsApp send/receive/status | Yes | Yes | WhatsApp channel | **Live** | Maintain |
| Shared inbox | Strong operations UI | Mature multichannel inbox | Conversation management | **Live basic** | P0 |
| Assignment, teams, notes, mentions | Yes | Yes | Human handoff | Foundation | P0 |
| Ticket stage and SLA | Yes | Chat status/assignment | Support-oriented | Plan | P0 |
| Contacts, tags, custom fields | Contact 360 | Yes | Collected data | Live basic | P0 |
| CRM pipeline and lead scoring | Yes | Integrations/lead workflows | Agent actions | Plan | P1 |
| Template management | Yes | Yes | Agent responses | Foundation | P0 |
| Campaigns and broadcasts | Advanced | Advanced | Secondary | Foundation/execution | P0 |
| No-code workflow/chatbot | Advanced | Advanced | Agent actions/forms | Foundation/execution | P0 |
| AI reply/summary/classification | BYOK copilot | WATI AI/Astra | Core product | Agent records only | P1 |
| Custom agent builder | Configurable roles | Astra configuration | Strong templates/builder | Plan | P1 |
| Knowledge base/RAG | Documents with citations | Own content | URLs/docs/FAQs | Plan | P1 |
| Shopify/WooCommerce | Both | Both/integrations | Shopify-specialized | Plan | P2 |
| Orders/cart/payment links | Yes | Commerce integrations | Yes | Plan | P2 |
| Analytics and attribution | Advanced | Campaign/inbox reports | Conversation data | Live basic | P1 |
| Omnichannel | WA/IG/Messenger | Broad | Broad | WhatsApp only | P3 |
| Voice/phone agent | Mobile/voice roadmap | Voice/calls | Strong | Plan/later | P3 |

## Customer problems and product modules

### 1. Inbox and service desk

Problems solved: missed chats, duplicate replies, slow responses, lost history and unclear ownership.

Required capabilities:

- A three-pane inbox: filters and queues, conversation list, active conversation with customer context.
- Queues: mine, mentions, unassigned, all, bot active, breached SLA, campaign replies and ad leads.
- Status: new, open, waiting on customer, waiting internally, escalated, resolved and spam.
- Assignment to user/team, round-robin, capacity limits, working-hours routes and fallback team.
- Private notes, mentions, collision indicator, typing/presence, unread markers and saved replies.
- Customer context: identity, consent, tags, lifecycle, score, orders, deals, recent campaigns and reminders.
- Media, template and reply-button support according to current official API capabilities.
- Human takeover that pauses bot/workflow output through ownership-generation checks.

### 2. Contacts and lightweight CRM

Problems solved: leads spread across phones and spreadsheets, no follow-up ownership and no revenue context.

Required capabilities:

- Automatic contact creation from provider identity with deduplication and merge review.
- Tags, custom fields, source, campaign/advertisement attribution, consent provenance and suppression.
- Lifecycle: new lead, qualified, opportunity, customer, repeat customer and win-back.
- Configurable lead score using transparent rules; AI may propose a score but cannot silently overwrite it.
- Multiple pipelines with kanban stages, deal value/currency, owner, next action, stale-deal indicator and win/loss reason.
- Contact 360 timeline combining messages, notes, workflow events, campaign events, deals, orders and support cases.
- Tasks, reminders and follow-ups with cancellation on reply, opt-out, resolution or human takeover.

### 3. Campaigns, broadcasts and sequences

Problems solved: unsafe bulk sends, weak segmentation, template-quality damage and no conversion reporting.

Required capabilities:

- Meta template synchronization, preview, variables, locale, category, approval/quality state and failure reasons.
- Saved dynamic segments with live counts plus immutable audience snapshots when a campaign launches.
- Exclusions: opted out, invalid, recently contacted, frequency cap, quiet hours, channel health and allowlist.
- Draft, approval, schedule, launch, pause, resume and cancel lifecycle with maker/checker permission for large sends.
- Per-number pacing, tenant fairness, budget reservation and automatic pause on quality or failure thresholds.
- Recipient-level logical operation with idempotent retries and sent/delivered/read/replied/failed state.
- Drip sequences with waits, goals and exit criteria. A reply or conversion can stop the remaining sequence.
- Funnel: audience → accepted → sent → delivered → read → replied → converted, with cost and revenue attribution.

### 4. Visual automation builder

Problems solved: developers required for every rule and fragile automations that cannot be debugged.

Initial node library:

| Group | Nodes |
| --- | --- |
| Start | Inbound message, keyword, button/list reply, contact created, tag changed, deal changed, cart event, order event, schedule, webhook |
| Conversation | Send text, approved template, media, list, buttons, ask question, collect input |
| Logic | Condition, AND/OR group, switch, business hours, consent check, template-window check |
| Data | Set field, add/remove tag, remember variable, increment score, create/update deal |
| Timing | Delay, wait until, quiet-hours gate, timeout branch |
| Team | Assign user/team, round-robin, add note, open ticket, set status, human handoff |
| Commerce | Find product, send product, create checkout link, get order, update cart, request review |
| Integration | Signed webhook, approved connector action, CRM sync |
| AI | Classify intent, extract fields, knowledge answer, draft reply, summarize, route to agent |
| End | Complete, suppress, unsubscribe, fail safely |

Builder UX:

- Infinite canvas with mini-map, zoom, snap guides and keyboard navigation.
- Left searchable node library, center graph, right configuration/validation panel.
- Draft autosave, version history, publish checklist and immutable published versions.
- Test console with synthetic payloads and zero-send simulation by default.
- Path trace showing each node, input/output, duration and redacted error.
- Reusable subflows and templates only after the first node set is stable.

Runtime requirements:

- Durable checkpoints; wait nodes schedule and exit rather than sleeping.
- Idempotency key per run/node/occurrence.
- Bounded steps, time, AI budget and causation depth.
- Retry/error branch and dead-letter visibility.
- Feature/permission/channel eligibility rechecked before every side effect.
- Replays simulate unless a privileged user explicitly authorizes sending.

### 5. Custom AI agent builder

Problems solved: generic bots hallucinate, cannot act safely and are difficult for a business owner to configure.

Agent creation flow:

1. Choose a goal/template: support, product expert, lead qualifier, booking, order assistant, cart recovery, follow-up or custom.
2. Define identity: name, purpose, tone, supported languages, response length and prohibited topics.
3. Add knowledge: website pages, FAQs, documents, product catalog and structured policies.
4. Add tools: lookup contact/order/product, create lead/deal/task, schedule appointment, generate approved checkout link and hand off.
5. Set guardrails: suggestion/approval/automatic mode, budget, confidence/source coverage, quiet hours, opt-out, escalation and allowed fields.
6. Define triggers and route order among agents.
7. Run an evaluation set, inspect citations/tool calls and publish a version.
8. Monitor conversations, failures, handoffs, tokens, cost and outcome.

Runtime model:

- One deterministic controller selects one agent at a time; agents do not independently compete to message a customer.
- Tools return proposed typed commands. The domain validates and executes them through the existing messaging/integration pipeline.
- Retrieval filters by tenant and permissions before ranking. Answers from knowledge show source references internally.
- Suggestion mode is the default. Auto-send starts only for evaluated low-risk intents.
- Mandatory handoff for refunds, complaints, missing sources, conflicting policies, sensitive requests, tool failures and explicit human requests.
- BYOK can later support OpenAI, Anthropic, Gemini or OpenRouter through one provider port. Provider credentials stay encrypted and never enter prompts/logs.

### 6. Commerce for Shopify, WooCommerce and custom stores

Problems solved: repetitive product/order questions, cart abandonment, fragmented order support and low repeat purchase.

Required use cases:

- Sync products, variants, collections, stock and customer/order IDs using provider cursors and webhooks.
- Product search/recommendation using authoritative catalog fields.
- Order lookup and signed status updates; store remains authoritative for payment/order state.
- Abandoned checkout recovery only with valid messaging eligibility; configurable delay and frequency cap.
- Back-in-stock and price-drop subscriptions with consent evidence.
- Secure checkout/payment link generation; signed payment/order webhook confirms success.
- Return/exchange intake, support ticket creation and human escalation.
- Review request, reorder, cross-sell and win-back flows with stop conditions.
- Revenue attribution to conversation, campaign and workflow without treating clicks as purchases.

Connector order:

1. WooCommerce or Shopify chosen by the first real pilot customer.
2. The other major store platform after the connector framework passes reconciliation tests.
3. Generic signed REST/webhook connector for custom stores.

### 7. Industry solution packs

Solution packs contain defaults and templates, never separate codebases.

| Pack | Core workflows |
| --- | --- |
| Ecommerce/retail | Product discovery, order status, cart recovery, stock alert, return intake, review/reorder |
| Food/restaurant | Menu/order flow, address capture, payment link, kitchen/delivery status, reorder and loyalty |
| Real estate | Ad lead capture, qualification, property matching, viewing booking, document collection and agent handoff |
| Healthcare/wellness | Appointment request/reminder, permitted intake, FAQ and staff handoff; strict data controls |
| Education | Enquiry qualification, admissions checklist, fee reminder, attendance/content notifications |
| Travel/visa | Package enquiry, document checklist, application/status updates and appointment reminders |
| Automotive | Service booking, quote approval, maintenance reminders and delivery update |
| Logistics | Tracking lookup, delivery notification, address correction and failed-delivery resolution |
| Professional services | Lead qualification, consultation booking, proposal follow-up and client reminders |

## Information architecture and Zapelite-inspired UX

Primary navigation:

1. Overview
2. Inbox
3. Contacts
4. CRM
5. Campaigns
6. Automations
7. AI Agents
8. Commerce
9. Templates
10. Analytics
11. Integrations
12. Team & Settings

Super-admin remains a separate platform surface for tenants, packages, feature grants, usage, health, support access and global safety switches.

### Visual direction

- Desktop-first operational workspace with responsive tablet/mobile fallbacks.
- Neutral warm-white canvas, graphite text and one Passion Fruit accent family; semantic colors only for state.
- Compact 13–14px operational text, clear 18–28px page hierarchy, generous outer whitespace and dense inner work areas.
- 10–14px radii, subtle borders, restrained shadows and no decorative gradients in high-frequency screens.
- Persistent slim sidebar; page-level controls in a calm top bar; secondary filters in local panels.
- Tables use sticky headers, saved views, column controls and bulk selection. Cards are reserved for summaries and empty states.
- Inbox uses three resizable panes. Workflow builder uses a full canvas and inspector. CRM uses kanban plus table view.
- Every empty state offers one primary next action and an example/template.
- Destructive or real-send operations show audience/impact preview and confirmation; drafts and simulations remain frictionless.
- WCAG AA contrast, visible focus, keyboard navigation, reduced motion and no color-only state.

### Key screens

- Overview: service health, open queues, SLA risk, campaign funnel, workflow failures, agent budget and revenue summary.
- Inbox: queue navigation, filters, conversation, composer, contact/order/deal context, workflow/agent state.
- Contact 360: profile header and unified event timeline with tabs for conversations, deals, orders and consent.
- Campaign composer: objective → audience → template/content → schedule/pacing → review → launch.
- Automation builder: graph canvas, node library, inspector, test console and execution history.
- Agent builder: template gallery and a guided setup with knowledge, tools, guardrails, tests and publish.
- Commerce: stores, sync health, products, orders, abandoned carts and automation outcomes.
- Analytics: clear metric definitions, filters, drill-down and export rather than decorative charts.

## Architecture additions

Retain the modular monolith and durable jobs. Add modules behind the existing ports instead of embedding provider logic in pages.

### Data groups to add

- Inbox operations: `teams`, `team_members`, `conversation_assignments`, `conversation_notes`, `mentions`, `sla_policies`, `saved_replies`.
- CRM: `contact_tags`, `contact_custom_fields`, `pipelines`, `pipeline_stages`, `deals`, `tasks`, `lead_score_events`.
- Campaign safety: `segments`, `campaign_audience_snapshots`, `campaign_recipients`, `frequency_counters`, `template_snapshots`.
- Workflow runtime: `workflow_step_runs`, `workflow_variables`, `workflow_waits`, `workflow_templates`.
- AI: `knowledge_sources`, `knowledge_chunks`, `agent_versions`, `agent_runs`, `agent_tool_calls`, `ai_usage_ledger`, `evaluation_sets`, `evaluation_runs`.
- Commerce: `store_connections`, `external_customers`, `products`, `variants`, `orders`, `carts`, `commerce_events`, `attribution_events`.
- Integrations: `integration_connections`, `external_id_mappings`, `sync_cursors`, `integration_receipts`.

Every tenant-owned table needs composite tenant foreign keys where applicable, RLS, audit coverage and service-role functions narrower than direct table grants.

### Runtime workloads

- `inbound`, `outbound`, `workflow`, `campaign`, `schedule`, `ai`, `knowledge`, `integration`, `commerce_sync`, `export`.
- One outbox and broker port; workloads may use separate queues for fairness and scaling.
- Hostinger/Supabase pilot processes small bounded batches. AWS migration moves web/worker runtime to containers and SQS while preserving domain commands, idempotency and database state.

## Security and trust requirements

- Official APIs and documented provider capabilities only.
- Tenant isolation, RBAC, per-user feature restrictions and auditable platform-support access.
- Consent provenance, opt-out keywords, suppression list and channel-specific eligibility before send.
- Encrypted provider credentials, rotation support, redacted logs and no credentials in workflow graphs.
- Message/template quality and failure-rate circuit breakers.
- AI prompt-injection isolation: documents/messages are data; they cannot grant tools or permissions.
- AI cost reservation, daily/monthly caps and tenant/platform emergency stop.
- Data retention/export/deletion policy; private media and expiring signed URLs.
- Backup/restore exercise, migration rollback and incident runbooks before wider onboarding.

## Delivery plan and gates

### Phase A — Operational inbox and admin truth

Deliver:

- Replace remaining demo super-admin data with tenant/user/feature/usage APIs.
- Teams, assignments, status, notes, mentions, tags, quick replies and search/filter.
- Contact 360 base, template synchronization screen and channel health.
- Original Passion Fruit dashboard shell following the UX direction above.

Gate: two tenants cannot read each other; two agents cannot silently reply at once; ownership and status survive refresh/restart; every admin change is audited.

### Phase B — Safe campaign and automation product

Deliver:

- Segments, audience snapshots, campaign recipient ledger, quiet hours, pacing, pause/resume/cancel and funnel.
- Full builder node set for conversation, data, timing and handoff.
- Simulation/test console, version history, execution trace and error handling.
- Template approval/quality visibility and campaign safety circuit breakers.

Gate: controlled allowlisted campaign; no duplicate logical sends under retry; workflow resumes after interruption; opt-out/reply/handoff cancels pending actions.

### Phase C — CRM and custom AI agents

Deliver:

- Pipelines, deals, tasks, lifecycle and rules-based lead scoring.
- Knowledge ingestion, retrieval, citations and deletion invalidation.
- Agent template gallery, guided builder, versioning, tools, budgets, suggestion mode and evaluation runner.
- Details/support/qualification/follow-up agent roles through one deterministic controller.

Gate: evaluation set meets agreed quality; unsupported answers hand off; tool permissions and budgets cannot be bypassed; auto-reply limited to approved intents.

### Phase D — Ecommerce pilot

Deliver:

- First chosen Shopify/WooCommerce connector, webhook verification, sync/reconciliation and health UI.
- Product/order tools, cart recovery, checkout link, stock alert, returns and review flows.
- Commerce dashboard and revenue attribution.

Gate: provider events deduplicate; reconciliation repairs missed events; order/payment state comes from signed provider evidence; cart campaigns obey consent and frequency caps.

### Phase E — Industry packs and integrations

Deliver:

- Versioned templates for the industry packs above.
- First chosen CRM connector and generic signed webhook/API connector.
- Import/export, reusable subflows and integration monitoring.

Gate: installing/upgrading a pack never overwrites customer edits without preview; connector loops and stale writes are prevented.

### Phase F — General SaaS and scale

Deliver:

- Customer self-onboarding with Meta Embedded Signup when provider/business eligibility is ready.
- Packages, billing, metering, invoices, trials, support tools, audit/export/deletion and public SDK.
- AWS web/worker/queue migration, autoscaling, observability, recovery and load evidence.
- Additional channels and voice only after separate capability/privacy review.

Gate: production security/recovery review, measured capacity, rollback rehearsal, customer onboarding documentation and support ownership.

## Next implementation sprint

The next sprint must make the current pilot operationally honest before adding AI or commerce:

1. Replace the hard-coded super-admin page with live tenant, membership, feature and usage data.
2. Add team/user tables, conversation assignment/status/notes and audit events.
3. Rebuild the inbox into the three-pane operations layout with real filters and contact context.
4. Add contact tags, lifecycle, custom fields and consent/suppression controls.
5. Add Meta template sync/list/preview and channel health screens.
6. Add campaign audience/recipient tables and immutable launch snapshot.
7. Add campaign pause/resume/cancel, quiet hours, pacing/frequency safety and real metrics.
8. Expand workflow schema/runtime to questions, input, variables, tags, fields, teams, error branches and checkpoints.
9. Build the graph editor, simulation console and run trace using the existing workflow APIs as the starting point.
10. Add Playwright customer journeys plus database/RLS/idempotency tests for the new side effects.

No AI auto-send, cart recovery broadcast or unbounded campaign should be enabled until its phase gate passes.

## Definition of “working”

A feature is customer-ready only when its UI, API, database migration, RLS/permission checks, entitlement, audit event, metering/quota, retry/failure path, operational visibility, documentation and relevant tests are complete. A menu item, mock screen, schema table or successful happy-path request alone is not a completed feature.
