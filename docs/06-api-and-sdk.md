# 06 — API, events and SDK contract

## Contract status

The endpoints and TypeScript interfaces in this kit are design contracts. They are not live endpoints, a generated OpenAPI document or an implemented client. Build and validate OpenAPI 3.1 from runtime schemas during M2, then generate a typed client after API behaviour stabilises. Do not ship an SDK that merely wraps unimplemented routes.

## HTTP conventions

Base namespace `/api/v1`. Tenant endpoints use `/tenants/{tenantId}` and authenticate session or a future scoped API key. URL tenant selection is validated against the authenticated principal. Platform endpoints use `/admin` and platform roles. A browser never sends a server key.

Validate request bodies and output DTOs with shared schemas. Paginate lists using opaque cursors and a stable timestamp/ID tie-breaker; cap page size. IDs are strings. Instants are ISO-8601 UTC; schedules additionally carry an IANA timezone. Return only public DTO fields, not repository objects or token ciphertext.

For create/send/schedule/launch mutations require `Idempotency-Key`. Scope to tenant + operation, store canonical request hash and original result; same key and same payload returns original result, while changed payload returns `409 IDEMPOTENCY_CONFLICT`. Retain financial/message operation keys for their full retry/replay lifetime. Document separate shorter TTL only for harmless mutations. Require `If-Match` / version for concurrency-sensitive workflow, assignment and entitlement updates.

## Endpoint inventory

Prefix `T` below means `/api/v1/tenants/{tenantId}`. `A` means `/api/v1/admin`. All tenant resources are scoped and action-authorised.

| Endpoint | Purpose | Main gate / result |
| --- | --- | --- |
| `GET /api/v1/me` | Memberships and allowed workspace selection | identity; no credentials |
| `POST A/tenants` | Recoverable tenant/owner provisioning | platform admin; 202 provisioning ID |
| `GET A/tenants` / `GET A/tenants/{id}` | Business list / health | platform scope; sensitive fields minimised |
| `PUT A/tenants/{id}/features` | Atomic grant/limit update | platform admin + version + reason |
| `POST A/tenants/{id}/suspend` | Stop customer activity | platform admin + audited reason |
| `POST A/support-sessions` | Expiring scoped support access | configured customer approval policy |
| `POST T/members/invitations` | Invite a team member | owner + seat quota |
| `PATCH T/members/{id}` | Role/status changes | owner; prevent last-owner removal |
| `GET T/features` | Effective module availability | active member |
| `POST T/channels/onboarding-session` | Issue authorised Meta signup configuration/state | channel administration |
| `POST T/channels/onboarding-complete` | Exchange code / validate actual assets server-side | one-time state + owner |
| `GET T/channels` / `POST T/channels/{id}/reconnect` | Connection health/recovery | permitted channel access |
| `GET T/conversations` / `GET T/conversations/{id}/messages` | Shared inbox with cursor | inbox read / assignment scope |
| `PUT T/conversations/{id}/assignment` | Human ownership/handoff | inbox assign + version |
| `POST T/conversations/{id}/notes` | Internal note | inbox write; never external send |
| `POST T/messages` | Queue one text/media/template intent | messages action + policy; 202 |
| `GET T/messages/{id}` | Intent/status/allowed attempt summary | own tenant; no secret payload |
| `POST T/messages/{id}/cancel` | Cancel pending intent | appropriate actor; in-flight conflict explicit |
| `GET/POST T/contacts` / `PATCH T/contacts/{id}` | Contact management | contact permission |
| `POST T/contacts/imports` | Async validated import | quota + private file ref |
| `POST T/contacts/{id}/consent-events` | Provenance or withdrawal | authorised evidence; append-only |
| `POST T/contacts/{id}/suppressions` | Stop future sends | permission; urgent dispatch visibility |
| `GET/POST T/segments` | Saved audiences | segment grant |
| `GET/POST T/templates` / `POST T/templates/sync` | Template management/sync | template permission |
| `POST/GET T/schedules` / `POST T/schedules/{id}/cancel` | Durable scheduled actions | schedule grant |
| `POST/GET T/campaigns` | Draft campaigns | campaign grant |
| `POST T/campaigns/{id}/preview` | Snapshot preview, exclusions, cost estimate | campaign read/create |
| `POST T/campaigns/{id}/launch` | Start approved recipient fanout | campaign launch + quota |
| `POST T/campaigns/{id}/pause` / `resume` / `cancel` | Campaign state transition | version-aware permission |
| `POST/GET T/workflows` / `POST T/workflows/{id}/publish` | Validate and publish immutable graph | workflow grant |
| `GET T/workflow-runs/{id}` | Steps/checkpoints/errors | workflow execution read |
| `POST/GET T/agents` / `POST T/agents/{id}/publish` | Versioned AI configuration | AI grant and evaluated policy |
| `POST T/agents/{id}/evaluate` | Isolated synthetic/test evaluation | metered; no live send |
| `POST/GET T/knowledge/sources` | Sources and indexing jobs | knowledge grant/storage quota |
| `POST T/whatsapp-flows` | Provider Flow creation/publishing | later Meta capability gate |
| `GET/POST T/integrations` | Configure scoped connector | integration permission |
| `GET T/reports/{report}` | Defined aggregates with filters | report feature/read scope |
| `POST T/exports` | Async bounded data export | distinct export permission |
| `POST T/data-deletion-requests` | Request documented business/contact deletion | authorised owner/resource scope |
| `GET /health/live` / `GET /health/ready` | Runtime and dependency readiness | minimal public health info |

Provider ingress is a separate Supabase function URL; it is not protected by a user session. Integration webhook URLs use provider signatures and verified account mapping. Worker endpoints authenticate an internal secret/signature and rate-limit calls; no unauthenticated “run all jobs” route.

## Error contract

```json
{
  "error": {
    "code": "FEATURE_DISABLED",
    "message": "Campaigns are unavailable for this workspace.",
    "requestId": "req_opaque_id",
    "retryable": false,
    "details": { "feature": "campaigns" }
  }
}
```

| HTTP | Codes / meaning |
| --- | --- |
| 400 / 422 | `VALIDATION_ERROR`, `INVALID_SCHEDULE`, `TEMPLATE_VARIABLE_MISMATCH` |
| 401 | `AUTH_REQUIRED`, `SESSION_EXPIRED` |
| 403 | `FEATURE_DISABLED`, `ACTION_DENIED`, `PASSWORD_CHANGE_REQUIRED`, `TENANT_SUSPENDED` |
| 404 | `RESOURCE_NOT_FOUND`; do not reveal another tenant's resource existence |
| 409 | `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `ALREADY_DISPATCHING` |
| 429 | `QUOTA_EXCEEDED`, `RATE_LIMITED`; retry-after when meaningful |
| 503 | `DEPENDENCY_UNAVAILABLE`; request safely retryable only where declared |

An asynchronous send failure appears in message/job status, not as a retroactive HTTP response. Clients show accepted vs delivered correctly. Provider tokens, raw sensitive errors and stack traces never reach response bodies.

## Example send intent

```json
{
  "channelId": "uuid",
  "contactId": "uuid",
  "conversationId": "uuid",
  "content": {
    "type": "template",
    "templateId": "uuid",
    "templateVersion": 3,
    "language": "en",
    "parameters": { "customer_name": "Asha" }
  },
  "expiresAt": "2026-10-08T12:00:00Z"
}
```

Recipient identity and provider asset IDs are resolved server-side from the authorised tenant resources. An API key cannot send to arbitrary provider IDs from another tenant. Validate parameter schema and selected language against the exact approved provider template.

## Event envelope and catalogue

```json
{
  "eventId": "uuid",
  "schemaVersion": 1,
  "tenantId": "uuid",
  "type": "message.inbound.received",
  "aggregateId": "conversation_uuid",
  "occurredAt": "2026-10-07T07:00:00Z",
  "correlationId": "opaque_trace_id",
  "causationId": "provider_event_uuid",
  "payloadRef": "internal_event_payload_uuid"
}
```

Initial events: `tenant.created`, `tenant.suspended`, `entitlement.changed`, `channel.connected`, `channel.reauth_required`, `message.inbound.received`, `message.outbound.requested`, `message.outbound.accepted`, `message.status.changed`, `message.send_unknown`, `contact.opted_out`, `conversation.ownership.changed`, `schedule.due`, `campaign.state.changed`, `workflow.step.ready`, `agent.reply.proposed`, `integration.event.received`, `usage.recorded`.

Add fields compatibly within a schema version; breaking semantics require a new version and consumer migration. Keep replayable event facts distinct from commands that cause external sends. Replay analytics events without triggering messaging actions. Retain causation IDs and chain-depth budgets to prevent trigger loops.

## SDK phases

Internal SDK first: domain ports and runtime DTOs used by web, ingress and worker. Public TypeScript SDK later: typed methods, cursor iteration, bearer/scoped-key auth, idempotency-key support, explicit request timeouts and structured errors. SDK retries must never retry an unsafe mutation without a stable idempotency key. Never embed server-side Meta credentials in a customer SDK. Publish versioned OpenAPI, examples, compatibility policy and changelog once implemented.

`contracts/reference.ts` illustrates the intended shape only. Runtime validation, SQL transactions, cryptography, adapters and tests remain implementation work.
