# 04 — Core messaging and reliability contract

## Non-negotiable invariants

1. Every business operation has a tenant context resolved from trusted identity or verified provider ownership.
2. A webhook is acknowledged only after durable commit, including its recovery path.
3. Duplicate receipt, duplicate queue delivery and worker restart cannot repeat a completed logical action.
4. External side effects are not assumed to participate in a Postgres transaction.
5. Entitlements, consent/suppression, channel health and message policy are checked at enqueue **and dispatch**.
6. The same pipeline sends manual replies, AI replies, campaigns, reminders and workflows.
7. Humans can take control; automation checks current ownership before final dispatch.
8. Every job can be inspected, cancelled where applicable, retried safely, or quarantined with a reason.

## Webhook ingress

`GET /meta-webhook` handles provider challenge verification; match a private verify token and return the expected challenge as plain text. `POST` verifies the provider's HMAC-SHA256 signature against the **raw body bytes** using the Meta app secret and a timing-safe comparison, before JSON parsing or normalization. The verify token alone does not authenticate POST requests. [Meta-hosted signature reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/)

Meta callbacks do not carry a Passion Fruit user JWT. Configure that Edge Function for provider authentication; internal worker functions require separate private invocation authentication. Disabling gateway JWT checks must never disable application signature verification.

Processing steps:

1. Apply body-size and request timeout limits; retain raw bytes until signature validation.
2. Validate expected provider envelope defensively. Support multiple entries and changes per callback.
3. In a privileged but narrowly scoped transaction, insert an encrypted/minimised raw receipt, stable fingerprint and outbox notification. Only the ingress role/RPC can do this.
4. Commit; then return `200`. A known, already committed duplicate also returns `200`.
5. Invalid signatures return `401/403`. Transient persistence failures return `5xx` so the provider can retry. Authenticated malformed or unknown events are durably quarantined then acknowledged to avoid endless poison-message delivery.
6. Normalizer resolves verified provider asset identifiers to a channel/tenant; never trust a request-supplied tenant ID. Unknown assets go to a private platform quarantine, never to a guessed customer.

Envelope fingerprint dedupe reduces repeated raw storage, but cannot replace per-event dedupe: the provider may rebatch the same message differently. Store normalized events uniquely by provider + account/channel + message ID + event kind + status/timestamp or other stable event identifier. Exact keys depend on the observed provider payload. Record fixtures and verify the key design for every subscribed event type.

Retain only necessary raw content for a short configured period. A receipt covering multiple assets is a platform-only operational object. Tenant users access their own normalized events, not whole mixed callback bodies.

## Durable handoff and transaction outbox

Application transaction writes domain state and an `outbox_events` row together. A relay publishes the outbox ID to pgmq and marks the row published. If direct queue insertion can be performed atomically with the domain transaction through a tested RPC, that is acceptable, but keep the outbox contract for the AWS transition.

Relay crash after publish and before marking can publish twice. Consumer dedupe makes this safe. Relay never marks success before the queue confirms persistence. Poll unpublished outbox rows with atomic claims; bound retry attempts, expose oldest unpublished age, and retain event IDs through replay.

Each job has `tenant_id`, `kind`, `schema_version`, `logical_key`, `payload_reference`, `status`, `available_at`, `attempt_count`, `lease_until`, `claim_token`, `last_error`, `correlation_id`. Unique `(tenant_id, kind, logical_key)` identifies the operation. Queue IDs are transport receipts, not application identity.

Workers claim jobs atomically (`FOR UPDATE SKIP LOCKED` or a tested RPC), with visibility/lease exceeding the bounded execution budget. Use claim-token/version compare-and-set for completion and heartbeats. A stale worker cannot commit after lease loss. Treat external timeouts separately from known failures.

Commit logical job completion before acknowledging/removing the queue delivery. If queue acknowledgement fails after DB completion, redelivery sees the completed logical job and only acknowledges it. Never acknowledge first and then attempt persistence. Reclaimed jobs already marked `dispatching` enter unknown-send reconciliation unless durable evidence proves no request was transmitted; they do not automatically become fresh sends.

## Inbound processing

Single transaction: insert normalized inbound event → upsert contact under `(tenant_id, channel_id, provider_recipient_id)` → append message → advance conversation's inbound timestamp with `max(existing, incoming)` → write routing/workflow outbox events. Repeated events become no-ops. Contact storage does not grant promotional permission.

Contacts may unify verified identifiers within a tenant; a phone-number change or uncertain identity is not an automatic merge. Use provider identifiers plus normalized E.164 where valid, keep display name provenance, and never merge across tenants.

An inbox conversation is a durable contact/channel thread. Customer service eligibility is computed from the relevant inbound event timestamp, not from the conversation's UI open/closed state. Late events cannot move time backwards.

## Outbound command and states

All sends create an immutable intent with sender/channel, contact, content/template version, origin, policy snapshot, expected conversation ownership version, idempotency key and expiry. Media intents reference a tenant-owned asset. Return `202 Accepted` with the internal message ID after persistence; this does not mean WhatsApp delivery.

```text
queued → dispatching → accepted → sent → delivered → read
                 ↘ retry_wait → queued
                 ↘ failed
                 ↘ send_unknown
queued/retry_wait → cancelled or expired or blocked_policy
```

`accepted` means the provider returned a message ID. `sent`, `delivered`, `read` mean observed provider events. Some events can be skipped, delayed or unavailable. Store all raw status facts and compute the projection with a tested precedence rule; do not overwrite `read` with a late `sent`. Keep error facts independently when inconsistent/late events appear. Missing read status is not proof the recipient did not read.

Link early status callbacks to provider IDs even if they arrive before the synchronous send response is stored. Keep an unmatched-status table with TTL and replay linkage. Correlation metadata supported by the selected API version may help, but must be verified rather than assumed.

## The ambiguous-send problem

A unique database key prevents duplicate application intent; it cannot guarantee exactly-once external delivery. Meta may accept a request and then the connection can time out, or a worker can crash before persisting its provider ID.

Before the request, durably create a send-attempt record and mark the intent `dispatching`. After response, persist provider ID/outcome. If the request could have been accepted but there is no conclusive result, mark `send_unknown`, retain attempted time and correlation, and do **not** blindly auto-retry. Reconcile supported callback metadata or provider evidence. If evidence is unavailable, require an audited operator decision; explain possible duplicate delivery before resending.

Do not assume Meta honours a Passion Fruit `Idempotency-Key`. Internal client/API dedupe is a separate guarantee. A DLQ replay must apply the same unknown-send rule.

## Retry policy

| Condition | Default decision |
| --- | --- |
| Explicit transient response / throttling, known not accepted | Bounded retry with jitter; respect provider guidance |
| Invalid destination/content, missing consent or denied feature | Terminal / blocked; expose corrective action |
| Expired/revoked credential | Pause channel jobs; alert owner; reconnect before resume |
| Template unapproved/paused/deleted | Block recipients; refresh state; do not silently switch template |
| Network failure before request was transmitted | Safe bounded retry if transport provides reliable evidence |
| Timeout/reset after transmission or crashed dispatch | `send_unknown`; reconciliation / reviewed resend |
| Poison event or unsupported schema | Quarantine/DLQ; manual repair with preserved logical ID |

Initial retry schedule for safe transient jobs: exponential backoff with full jitter, ceiling five minutes, maximum five attempts, bounded by intent expiry. This is an application default, not Meta's own retry schedule. Provider-specific error classifier tests must establish safe-retry cases.

## Ordering and concurrency

Provider events may arrive out of order. Use stable provider timestamps, dedupe and versioned projections. For conversation automation, serialize updates with short DB transactions and a conversation version. Never hold a SQL lock across network or AI calls.

Reply arbitration uses one active automation run per conversation, generation number and expiry. Human takeover increments the generation; pending AI drafts/jobs from older generations are invalid. Final dispatch obtains a short dispatch lease and rechecks generation. Once a network send has begun, a human takeover cannot recall it; expose that race as “sending” and stop subsequent jobs. Debounce rapid inbound messages and cancel stale drafts before sending.

Urgent service traffic must not sit behind campaigns. Use separate workload queues with shared channel throttling. A Postgres-backed pilot rate limiter atomically reserves per-number and per-tenant capacity. On AWS, distributed limiter implementation may change; policy does not. Enforce recipient pacing, account quality and applicable messaging limits as well as throughput. One tenant cannot exhaust every worker slot.

## Schedules and campaigns

Persist `due_at` in UTC, original IANA timezone, local schedule rule, expiry, recurrence policy, cancellation/version and ownership condition. For DST transitions, require a documented policy: choose first occurrence for ambiguous time; move nonexistent time to next valid time. Preview this in the UI. Asia/Kolkata is the pilot default, not a hardcoded server timezone.

Dispatcher periodically claims due records. Atomically create a unique job for `(schedule_id, occurrence_at, version)` and advance recurrence. Never use browser timers or process memory as the scheduler. On delay, send only within configured lateness tolerance; otherwise expire visibly. Cancel on recipient reply, opt-out, order completion or handoff where the reminder's configured rule requires it.

Campaign launch snapshots unique eligible recipients and template version. Audience import/expansion is chunked with checkpoints. Dispatch still checks live suppression, quotas and feature state. A pause stops new claims; in-flight sends may complete. Resume does not recreate completed recipients. Cancellation prevents pending recipients. Preview errors, excluded counts and estimated cost before launch. Internal bulk jobs are individual official API sends, not WhatsApp Business App broadcast lists.

## Media

Upload to private tenant storage; validate extension, MIME signature, size and selected provider type limits; quarantine untrusted uploads; scan before serving/downstream use. Download provider media promptly through server credentials, never expose tokens. Fetch only allowed provider hosts or validated integration endpoints to prevent SSRF. Do not rely on temporary provider URLs as the permanent inbox archive. Use short-lived signed URLs with RLS/storage policy coverage and delete according to retention.
