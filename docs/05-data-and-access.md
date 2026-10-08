# 05 — Data model, identity and authorisation

## Isolation model

A tenant is the primary ownership boundary. Every tenant-owned table MUST have `tenant_id NOT NULL`. Every tenant-to-tenant-owned foreign key must use `(tenant_id, id)` against a composite unique key, preventing accidental references to another business. Globally unique UUIDs alone do not enforce ownership.

Enable RLS on all browser/API exposed business tables. Policies derive membership from the authenticated identity and current database membership, not an editable client tenant value. Validate workspace switching at the server. Anonymous access to business data is denied. Browser keys are publishable keys; server secret/service-role credentials never reach the client. Supabase documents that privileged service access can bypass RLS, so application-level tenant checks are still mandatory for privileged tasks. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Worker RPCs are not public data APIs. Prefer a dedicated database role and narrowly granted functions. If an initial Supabase server key must be used, wrap it behind repositories with explicit tenant scope and tested invariants; never create a general arbitrary-query endpoint. SQL security-definer functions set a safe `search_path`, fully qualify objects, revoke public execution and validate arguments.

## Table blueprint

This is a logical schema for migration design; fields below are not executable migrations. Core tables are built first; later module tables only at their milestone.

| Group / table | Main fields | Constraints and indexes |
| --- | --- | --- |
| `tenants` | id, name, status, timezone, locale, deletion_state | status enum; timezone validation |
| `memberships` | tenant_id, user_id, role, status, auth_revision | unique tenant/user; active membership lookup |
| `platform_roles` | user_id, role, status | private schema; platform scope separate from tenant roles |
| `provisioning_requests` | request_id, tenant_id, owner_user_id, stage, error | unique request ID; recover incomplete invite |
| `feature_registry` | key, dependencies, schema_version | global curated registry; not user editable |
| `tenant_feature_grants` | tenant_id, feature_key, enabled, limits, validity, revision | unique tenant/key; grant audit |
| `member_feature_overrides` | tenant_id, user_id, feature_key, effect | unique tenant/user/key; deny wins |
| `quota_reservations` | tenant_id, meter, logical_key, quantity, expiry, state | unique logical reservation; atomic balance |
| `usage_ledger` | tenant_id, meter, logical_key, amount, occurred_at, source | append-only; unique meter/logical fact |
| `channels` | tenant_id, id, provider, account_ref, phone_ref, capability_state, health | unique active provider/phone mapping |
| `integration_credentials` | tenant_id, integration_id, ciphertext, nonce, key_id, expires_at | private schema; no browser SELECT |
| `contacts` | tenant_id, id, name, phone_e164, provider_identity, source | unique scoped identity; tenant/tag lookup |
| `contact_identities` | tenant_id, contact_id, provider, channel_id, external_id | unique tenant/provider/channel/external ID |
| `consent_events` | tenant_id, contact_id, purpose, action, source, evidence_ref, time | append-only; provenance; withdrawal supported |
| `suppressions` | tenant_id, contact_id, scope, reason, time | active suppression index; overrides audience |
| `tags`, `contact_tags` | tenant_id, tag/contact IDs | composite FKs; unique relation |
| `custom_field_definitions`, `contact_field_values` | tenant_id, field ID, typed value | bounded validated schema; no unbounded JSON search |
| `conversations` | tenant_id, contact_id, channel_id, assigned_to, mode, generation, last_inbound_at | unique active thread rule; inbox cursor index |
| `conversation_notes` | tenant_id, conversation_id, author_id, body | private/internal timeline; tenant FK |
| `messages` | tenant_id, conversation_id, direction, type, content_ref, status, provider_id, time | provider/channel/message uniqueness; cursor pagination |
| `message_status_events` | tenant_id, message_id, provider_status, timestamp, error | dedupe key; immutable status facts |
| `outbound_intents` | tenant_id, message_id, idempotency_key, request_hash, origin, expiry, policy_version | unique tenant/idempotency key; hash conflict detection |
| `send_attempts` | tenant_id, intent_id, attempt_no, state, provider_id, started/ended_at | unique intent/attempt; unknown evidence retained |
| `webhook_receipts` | receipt_id, fingerprint, encrypted_payload, received_at, state | platform-only; fingerprint index; retention |
| `provider_events` | tenant_id nullable until resolved, receipt_id, event_key, kind, payload_ref | unique provider event; quarantine isolation |
| `unmatched_statuses` | channel_ref, provider_message_id, status fact, expiry | private pending linkage; TTL |
| `outbox_events` | id, tenant_id, kind, version, aggregate_id, state, available_at | unpublished index; replay ID stable |
| `jobs` | tenant_id, kind, logical_key, lease, claim_token, attempts, state, payload_ref | unique logical key; due/lease indexes |
| `scheduled_actions` | tenant_id, id, due_at, timezone, recurrence, expiry, version, state | due index; unique occurrence job |
| `templates` | tenant_id, channel/account ref, provider_id, name, language, state, version | scoped name/language/version uniqueness |
| `campaigns`, `campaign_recipients` | tenant_id, campaign/contact IDs, template_version, state, intent_id | unique campaign/contact; chunk cursor |
| `workflows`, `workflow_versions` | tenant_id, id, version, graph, published_at | immutable published graph; schema validation |
| `workflow_runs`, `workflow_steps` | tenant_id, trigger_id, version, node, state, checkpoint | unique trigger/workflow; step/action dedupe |
| `ai_agents`, `agent_versions`, `agent_runs` | tenant_id, role, knowledge/tool policy, model, budget, outcome | immutable policy versions; generation link |
| `knowledge_sources`, `knowledge_chunks` | tenant_id, source/version, content, vector, permissions | tenant-filtered vector index; source deletion cascade |
| `integrations`, `sync_cursors`, `external_mappings` | tenant_id, provider, status, cursor, external IDs | scoped mapping uniqueness; replay-safe cursor |
| `lead_stages`, `lead_tasks`, `order_snapshots` | tenant_id, contact/order refs, version/status | own authoritative source per connector |
| `audit_events` | actor, tenant, action, target, before/after summary, reason, time | append-only; redacted; platform actions separately scoped |
| `metric_rollups` | tenant_id, metric, interval, dimensions, value, definition_version | rebuildable from ledger; unique interval/dimensions |
| `subscriptions`, `billing_events` | tenant_id, plan, status, external_event_id | later phase; unique payment provider event |

Use UUIDs for internal identity and **strings for Meta IDs**, avoiding JavaScript integer precision loss. Use `timestamptz` for instants and IANA timezone names for local rules. Monetary values use integer minor units with currency, or a tested decimal representation for sub-minor provider estimates. Embedding dimensions follow the evaluated model and explicit migrations, not a fixed arbitrary column dimension.

## Required indexes and lifecycle rules

Hot indexes start with tenant/channel identifiers: inbox `(tenant_id, updated_at, id)`, messages `(tenant_id, conversation_id, occurred_at, id)`, jobs `(state, available_at)` plus tenant-specific views, active schedules `(state, due_at)`, provider identity unique lookup, unpublished outbox. Query plans are checked against realistic pilot data before scaling. Archive raw receipts and old job attempts by retention policy; partition only after size/query evidence.

Soft deletion prevents new activity immediately; scheduled actions, campaigns and AI stop. A durable deletion workflow then removes private objects, knowledge vectors, external credentials, active business data and projections. Required audit/accounting facts are minimised and retained only according to the documented retention policy. Backups are addressed separately with expiry; never promise immediate removal from every historical backup.

## Provisioning and password handling

Auth identity creation and business DB transactions are separate systems. Use a recoverable provisioning saga: reserve request ID → create tenant in `provisioning` → create/invite owner → attach membership → record grants → activate only when mandatory steps succeed. Retry with the same request ID. Orphan identity cleanup must first verify it has no other memberships.

Preferred owner flow is an expiring invitation to set a password. Support the requested admin-created email/password flow with a random temporary password and a database `password_change_required` flag. Every business API denies non-reset activity while the flag is set; clearing it requires a verified successful password change. Supabase does not automatically provide this custom application gate. Never store plaintext passwords, include them in logs, retain copies in admin screens or let operators retrieve customer passwords. Reset by link; do not reveal the original password. Actual delivery of credentials to a customer is a separate authorised operational action.

Use secure cookies/session refresh, CSRF protection for cookie-authenticated mutations, rate limiting, anti-enumeration responses, appropriate email verification and session revocation. Disable public signup initially. Custom SMTP and allowed redirect URLs must be configured before relying on invitations. MFA is mandatory for platform admins and offered/required by plan for tenant owners.

## Effective authorisation algorithm

```text
authenticated principal
  AND active tenant membership
  AND tenant active
  AND role allows action/resource scope
  AND feature grant active at database time
  AND required dependencies active
  AND no platform / tenant / member deny
  AND valid quota reservation for metered mutation
  AND action-specific channel/consent/ownership checks
```

Platform privileges follow a separate route and action policy; they do not masquerade as ordinary tenant membership. For row access, RLS is mandatory defense in addition to the algorithm. Resource IDs supplied by users must belong to the authorised tenant. Assignment-based restrictions apply to agents where configured.

Example: Business A has AI auto-reply, Business B does not. An A manager can enable permitted agent configurations; a B owner cannot activate AI via a hidden API. An A agent denied campaigns cannot start one despite A's tenant grant. An already queued AI job stops after A's feature is revoked.

Cache permission results only with short lifetime and revision invalidation. Critical dispatch checks use current DB state. Membership revocation must take effect across API, jobs, storage and Realtime channels; reconnect/session handling must be tested. Feature UI visibility is never the security boundary.

## Credentials and files

Encrypt tenant integration tokens with authenticated encryption, unique nonce, key ID and tenant/integration binding as associated data. Pilot key lives in restricted runtime secrets, never alongside ciphertext in the DB. Rotation supports previous key IDs while re-encrypting records. AWS uses KMS-backed envelope encryption/Secrets Manager. Audit decrypt use by service/action without recording the token. Credential expiry, revocation and reconnect are first-class channel states.

Private object paths begin with tenant ID and opaque asset ID. Storage upload/read/delete policies verify membership, feature and resource ownership. Signed links expire quickly and are generated only after authorisation; a public bucket is not an inbox storage solution. Realtime subscriptions are private and authorised; event notifications contain minimal identifiers, followed by permission-checked reads.
