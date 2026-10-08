# 10 — Quality, acceptance and operating runbooks

## Verification philosophy

No architecture or developer can promise zero bugs. Release confidence comes from tested invariants, observable failure states, limited rollout and recovery practice. The tests below are **required future tests**; none has run against a Passion Fruit application, because implementation has not started.

## Core test matrix

| ID | Scenario | Expected evidence | Gate |
| --- | --- | --- | --- |
| Q01 | User A requests tenant B contacts/messages/API IDs | Denied without data or existence leak | M1 |
| Q02 | A uses B file path/signed-link generation/Realtime channel | No cross-tenant file or events | M1/M3 |
| Q03 | Cross-tenant foreign key inserted by privileged test role | Database rejects incompatible ownership | M1 |
| Q04 | Campaign/AI disabled while UI hidden or API called directly | API denied and background job blocked | M1/M4 |
| Q05 | Membership/tenant suspended during an existing session | Protected reads/writes and pending sends stop | M1/M3 |
| Q06 | Auth identity created but provisioning transaction fails | Same request recovers; no duplicate owner/tenant | M1 |
| Q07 | Temporary password owner attempts normal API | Denied until verified password change | M1 |
| Q08 | Invalid webhook signature/body mutated after signing | Rejected before business mutation | M2 |
| Q09 | Database unavailable before receipt commit | No 200; provider retry can recover | M2 |
| Q10 | Same event delivered repeatedly/rebatched | One logical inbound message/action | M2 |
| Q11 | Receipt commit succeeds then ingress process dies | Persisted event eventually appears in inbox | M2 |
| Q12 | Relay publishes then crashes before DB marker | Duplicate delivery creates no repeated logical work | M2 |
| Q13 | Worker claim expires and old worker resumes | Stale token cannot overwrite current completion | M2 |
| Q14 | Provider accepts but response lost / dispatch process dies | `send_unknown`, no automatic duplicate send | M2 |
| Q15 | `read` arrives before `sent`, statuses repeat | Status ledger retains facts; projection does not regress | M2 |
| Q16 | Status arrives before provider ID persisted | Deferred status links to correct tenant/message later | M2 |
| Q17 | Two messages/campaign jobs share idempotency key | Same payload returns original; changed payload conflicts | M2 |
| Q18 | Token expires, rate limit or template state changes | Correct pause/retry/block classification; actionable error | M2/M3 |
| Q19 | Schedule claimed by concurrent dispatchers or after restart | One occurrence intent; version-aware cancellation | M3 |
| Q20 | Timezone boundary, delayed due job, DST fixtures | Documented preview/expiry/occurrence behaviour | M3 |
| Q21 | Recipient withdraws permission after launch/enqueue | Pending outbound blocked at dispatch | M3/M5 |
| Q22 | AI uses another tenant's knowledge/order ID | No retrieval/tool access; audit denial | M4 |
| Q23 | Prompt injection requests secrets/arbitrary action | No secret exposure or unauthorised tool execution | M4 |
| Q24 | Human takeover while AI draft/queued reply exists | Stale reply blocked; in-flight race surfaced honestly | M4 |
| Q25 | Workflow worker crashes after successful send step | Step resume does not duplicate intent/send | M4 |
| Q26 | AI spend cap/repeated provider timeouts | Budget enforced; human fallback; no infinite retries | M4 |
| Q27 | Audience duplicates, campaign pause/resume/restart | Unique recipient result; completed jobs not restarted | M5 |
| Q28 | Concurrent quota reservations / retries | No overspend; logical meters not double counted | M3/M5 |
| Q29 | Store/CRM webhook repeats or sync loop occurs | Idempotent update; explicit source conflict handling | M6 |
| Q30 | Export/deletion across tenant/storage/vector index | Correct scope, expiry and cleanup evidence | M6/M7 |
| Q31 | Backup restored to clean project | Usable schema/data, documented credential reconfiguration | pilot launch |
| Q32 | Queue adapter/cutover replays old references | No lost jobs/duplicate known sends; unknowns retained | M9 |

Tests must use real Postgres/RLS for isolation and transaction behaviour; mocks are insufficient. Mock/sandbox Meta is used for deterministic fault injection; actual official test/live permitted recipients validate integration separately. Hostinger smoke redeploy and Supabase worker expiry tests cover runtime assumptions.

## AI evaluation

Before auto-send: create a reviewed tenant-specific evaluation set, including Malayalam/English/code-switching, product facts, missing facts, price ambiguity, opt-out/human requests, prompt injection and adversarial tool arguments. Starting pilot gate: at least 50 representative cases, zero observed cross-tenant disclosures, zero unauthorised side effects and zero unsupported high-impact commitments. Owner reviews FAQ answer suitability. A small evaluation sample cannot prove absence of all errors; keep limited automatic intents and run regression evaluation on configuration/model changes.

## Pilot engineering targets — measure before committing

| Signal | Proposed target / alert | Scope |
| --- | --- | --- |
| Durable webhook acknowledgement | p95 < 1 second; p99 < 2 seconds under agreed synthetic load | excludes provider/network outside ingress |
| Inbox processing lag | p95 < 15 seconds on pilot; warning oldest > 30 sec, critical > 120 sec | low-concurrency bounded worker profile |
| Ordinary API read latency | p95 < 800 ms from app runtime under pilot fixture | provider/AI calls excluded |
| Schedule due-to-intent lag | p95 < 30 seconds, explicit late expiry | no exact-time guarantee |
| Cross-tenant access | all defined denial cases pass | mandatory release gate |
| Known-send duplicates | zero in deterministic replay/crash suite | ambiguous external sends separately tracked |
| Queue recovery | no acknowledged event lost in crash suite | retention and durable commit enforced |
| AI automatic reply | only evaluated intents within hard spend cap | latency measured separately |

Start synthetic ingress testing at 10 webhook requests/sec for five minutes with realistic batched/status payloads, no real mass sending. Verify commit durability, CPU/DB saturation, queue drain time and tenant fairness. This is a test profile, not a throughput claim. Growth load tests occur in staging/AWS under provider-approved testing conditions. Public uptime SLA is deferred until monitoring and hosting capability justify it.

## Telemetry

Structured logs include request/correlation/event/job/tenant IDs, action, outcome, duration and non-sensitive error category. Redact message bodies, phone numbers where feasible, credentials and raw AI prompts. Trace ingress → outbox → worker → intent/attempt → status projection. Keep an admin health dashboard with oldest queue/outbox ages, backlog by class, dead-letter count, scheduler delay, signature failures, credential health, send_unknown count, AI spend and error ratios.

Alerts are actionable: persistence failure, missed cron/worker heartbeat, rising queue age, no status linkage, expired channel token, account quality/restriction, DB/storage quota, AI hard-cap proximity or suspected cross-tenant access. Route through an owner-chosen operational channel during implementation; no notification service is connected yet.

## Metric definitions

- **Accepted sends:** intents with provider acknowledgement; distinct logical message IDs.
- **Delivered:** observed delivery fact; denominator for delivery rate is accepted messages in a defined cohort, with delayed/unknown shown.
- **Read:** observed read fact, not proof for all recipients; read rate describes observable events.
- **First response time:** earliest qualifying human/service reply after relevant inbound event; define business-hours and bot inclusion separately.
- **Resolution time:** configured open/close episodes, not last message time.
- **Campaign conversion:** explicitly mapped CRM/store event within declared attribution window; no unsupported causal claim.
- **AI containment:** bot-handled episodes without handoff within a defined window, reviewed against customer outcomes.
- **Provider cost:** estimate vs reconciled provider statement; distinct from internal attempts and subscription billing.

Reports display timeframe, timezone, freshness, definition version and missing data. Projections are rebuildable from event facts; rebuilding must not execute outbound actions.

## Runbooks

**Provider token expired:** pause affected channel → retain queued intents → notify owner → reconnect with verified asset ownership → refresh capabilities/templates → revalidate non-expired intents → controlled resume. Do not rotate another tenant's token or bulk retry unknown sends.

**Queue backlog / missed worker:** check heartbeat and oldest age → pause campaign expansion → identify worker/DB/cron failure → restore bounded processing → prioritise inbound/service → monitor drain/fairness → review expired schedules and unknown sends before resume.

**DLQ / poison event:** inspect redacted reason and original event ID → repair schema/configuration → replay with preserved logical ID in staging → retry safely in pilot → verify no repeated side effect. Record operator and reason.

**Ambiguous send:** freeze only affected intent → gather attempt and callback evidence → reconcile if supported → retain unknown state if unprovable → allow audited reviewed resend with new linked decision. Do not equate “no delivery callback yet” with “not sent”.

**AI malfunction / overspend:** tenant/global AI kill switch → invalidate pending generations/jobs → retain human inbox → inspect source/model/tool trace → update version → evaluation → controlled re-enable.

**Possible tenant leak:** stop affected paths/support sessions → revoke implicated access → preserve redacted audit evidence → scope database/file/realtime/knowledge impact → fix and verify denial cases → follow actual incident/privacy obligations before reopening.

**App deployment failure:** keep webhook/queue durability running → rollback compatible app version → verify auth/API/inbox → investigate migration compatibility → resume sends only when dispatch paths remain correct.

## Backup, retention and recovery

Supabase database backups do not by themselves back up stored file contents. Plan separate object backups/exports and policy/secret recovery. Features and recovery options depend on the selected plan. [Supabase backups](https://supabase.com/docs/guides/platform/backups)

Pilot proposal: encrypted daily DB export where plan-native recovery is insufficient, separate private object inventory/backup, migrations and configuration in Git, secrets in an independent secure store. Restore drill before real pilot data. Starting pilot objective RPO ≤ 24 hours / RTO ≤ 8 hours only after drill evidence; accepted event loss since the last backup remains possible after catastrophic storage failure. Stronger AWS/paid-plan recovery targets require tested point-in-time backup and independent object recovery.

Proposed default retention for owner approval: raw webhook payload 7 days; detailed job attempts 30 days; operational logs 30 days; conversation/media 90 days for pilot; minimised audit events 180 days. These are design defaults, not legal retention advice. Customer contract/purpose can change them. Scheduler cleanup and deletion are bounded durable jobs. Avoid storing production exports on developer laptops unencrypted.

## Definition of done

Required feature and API behaviour implemented; runtime schemas match docs; relevant denial/reliability tests pass; SQL migration reviewed; dashboard handles empty/loading/error/blocked states; logs and recovery path exist; secret scan clean; deployment/restart smoke passes; no demo data shown as live. Pilot can expand only after all core Q gates pass and outstanding provider approval gates are closed.
