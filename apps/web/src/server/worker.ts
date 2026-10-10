import "server-only";
import { createHash } from "node:crypto";
import { decryptCredential, MetaCloudApiClient } from "@passion-fruit/adapters";
import { planWorkflowExecution, type MessageContent, type MessageStatus, type WorkflowGraph } from "@passion-fruit/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase";
import { workerEnvironment } from "./env";

interface ClaimedJob {
  queue_message_id: number;
  job_id: string;
  tenant_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
}

interface JobResult { success: boolean; error?: string; retryDelaySeconds?: number }

const statusRank: Record<string, number> = { queued: 0, dispatching: 1, accepted: 2, sent: 3, delivered: 4, read: 5 };
const providerStatuses = new Set(["sent", "delivered", "read", "failed"]);

function inboundContent(message: Record<string, unknown>): Record<string, unknown> {
  const type = typeof message.type === "string" ? message.type : "unknown";
  if (type === "text") return { type, text: (message.text as { body?: unknown } | undefined)?.body ?? "" };
  if (type === "button") return { type, text: (message.button as { text?: unknown } | undefined)?.text ?? "" };
  if (type === "interactive") return { type, interactive: message.interactive ?? {} };
  const media = message[type];
  if (media && typeof media === "object") {
    const value = media as { id?: unknown; mime_type?: unknown; caption?: unknown; filename?: unknown };
    return { type, mediaId: value.id, mimeType: value.mime_type, caption: value.caption, fileName: value.filename };
  }
  return { type, unsupported: true };
}

async function processStatuses(admin: SupabaseClient, tenantId: string, statuses: Array<Record<string, unknown>>) {
  for (const statusEvent of statuses) {
    const providerId = typeof statusEvent.id === "string" ? statusEvent.id : null;
    const next = typeof statusEvent.status === "string" ? statusEvent.status : null;
    if (!providerId || !next || !providerStatuses.has(next)) continue;
    const { data: message } = await admin.from("messages").select("id,status").eq("tenant_id", tenantId).eq("provider_message_id", providerId).maybeSingle();
    if (!message) continue;
    const eventKey = `${providerId}:${next}:${String(statusEvent.timestamp ?? "")}`;
    await admin.from("message_status_events").upsert({ tenant_id: tenantId, message_id: message.id, provider_event_key: eventKey, status: next, payload: statusEvent }, { onConflict: "tenant_id,provider_event_key", ignoreDuplicates: true });
    const failureMayApply = next === "failed" && !["delivered", "read"].includes(message.status);
    if (failureMayApply || (statusRank[next] ?? -1) >= (statusRank[message.status] ?? -1)) {
      const timestamp = statusEvent.timestamp ? new Date(Number(statusEvent.timestamp) * 1000).toISOString() : new Date().toISOString();
      const times = next === "delivered" ? { delivered_at: timestamp } : next === "read" ? { read_at: timestamp } : {};
      await admin.from("messages").update({ status: next, ...times, updated_at: new Date().toISOString() }).eq("id", message.id).eq("tenant_id", tenantId);
      const recipientStatus = next === "sent" ? "accepted" : next;
      const { data: recipients } = await admin.from("campaign_recipients").update({ status: recipientStatus }).eq("tenant_id", tenantId).eq("message_id", message.id).select("campaign_id");
      for (const recipient of recipients ?? []) {
        const { count } = await admin.from("campaign_recipients").select("contact_id", { count: "exact", head: true }).eq("campaign_id", recipient.campaign_id).in("status", ["pending", "queued", "accepted"]);
        if ((count ?? 0) === 0) await admin.from("campaigns").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", recipient.campaign_id);
      }
    }
  }
}

async function processInbound(admin: SupabaseClient, job: ClaimedJob): Promise<JobResult> {
  const receiptId = String(job.payload.receipt_id ?? "");
  const { data: receipt, error } = await admin.from("webhook_receipts").select("id,tenant_id,phone_number_id,payload,state").eq("id", receiptId).single();
  if (error || !receipt?.tenant_id) return { success: false, error: error?.message ?? "receipt_not_found" };
  const { data: channel } = await admin.from("channels").select("id,phone_number_id,credential_id").eq("tenant_id", receipt.tenant_id).eq("phone_number_id", receipt.phone_number_id).single();
  if (!channel) return { success: false, error: "channel_not_found" };

  const payload = receipt.payload as { entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }> };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      await processStatuses(admin, receipt.tenant_id, (value.statuses as Array<Record<string, unknown>> | undefined) ?? []);
      const contacts = (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }> | undefined) ?? [];
      for (const providerMessage of (value.messages as Array<Record<string, unknown>> | undefined) ?? []) {
        const waId = typeof providerMessage.from === "string" ? providerMessage.from : contacts[0]?.wa_id;
        const providerMessageId = typeof providerMessage.id === "string" ? providerMessage.id : null;
        if (!waId || !providerMessageId) continue;
        const displayName = contacts.find((contact) => contact.wa_id === waId)?.profile?.name ?? null;
        const { data: contact, error: contactError } = await admin
          .from("contacts")
          .upsert({ tenant_id: receipt.tenant_id, wa_id: waId, phone_e164: `+${waId}`, display_name: displayName, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,wa_id" })
          .select("id")
          .single();
        if (contactError || !contact) return { success: false, error: contactError?.message ?? "contact_upsert_failed" };
        const { data: conversation, error: conversationError } = await admin
          .from("conversations")
          .upsert({ tenant_id: receipt.tenant_id, channel_id: channel.id, contact_id: contact.id, status: "open", last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "tenant_id,channel_id,contact_id" })
          .select("id")
          .single();
        if (conversationError || !conversation) return { success: false, error: conversationError?.message ?? "conversation_upsert_failed" };
        const occurredAt = providerMessage.timestamp ? new Date(Number(providerMessage.timestamp) * 1000).toISOString() : new Date().toISOString();
        const content = inboundContent(providerMessage);
        const mediaId = typeof content.mediaId === "string" ? content.mediaId : null;
        if (mediaId && ["image","audio","video","document","sticker"].includes(String(content.type))) {
          const { data: credential, error: credentialError } = await admin.from("integration_credentials").select("ciphertext,iv,auth_tag").eq("id",channel.credential_id).eq("tenant_id",receipt.tenant_id).single();
          if (credentialError || !credential) return { success:false,error:credentialError?.message??"credential_unavailable" };
          const env=workerEnvironment();
          const token=decryptCredential({ciphertext:credential.ciphertext,iv:credential.iv,authTag:credential.auth_tag},env.credentialKey);
          const provider=new MetaCloudApiClient({accessToken:token,graphVersion:env.graphVersion,phoneNumberId:channel.phone_number_id});
          const downloaded=await provider.downloadMedia(mediaId);
          const key=createHash("sha256").update(providerMessageId).digest("hex");
          const path=`${receipt.tenant_id}/${conversation.id}/${key}`;
          const {error:uploadError}=await admin.storage.from("message-media").upload(path,downloaded.bytes,{contentType:downloaded.mimeType,upsert:true});
          if(uploadError)return{success:false,error:uploadError.message};
          content.mediaPath=path;content.mimeType=downloaded.mimeType;content.fileSize=downloaded.fileSize;content.sha256=downloaded.sha256;delete content.mediaId;
        }
        const { data: savedMessage, error: messageError } = await admin.from("messages").upsert({
          tenant_id: receipt.tenant_id,
          conversation_id: conversation.id,
          channel_id: channel.id,
          contact_id: contact.id,
          direction: "inbound",
          origin: "customer",
          status: "received",
          provider_message_id: providerMessageId,
          content,
          created_at: occurredAt,
        }, { onConflict: "tenant_id,provider_message_id", ignoreDuplicates: true }).select("id").maybeSingle();
        if (messageError) return { success: false, error: messageError.message };
        const inboundMessageId = savedMessage?.id ?? (await admin.from("messages").select("id").eq("tenant_id", receipt.tenant_id).eq("provider_message_id", providerMessageId).maybeSingle()).data?.id;
        if (inboundMessageId) {
          const { error: workflowError } = await admin.rpc("enqueue_inbound_workflows", { p_message_id: inboundMessageId });
          if (workflowError) return { success: false, error: workflowError.message };
        }
      }
    }
  }
  await admin.from("webhook_receipts").update({ state: "processed", processed_at: new Date().toISOString() }).eq("id", receipt.id);
  return { success: true };
}

async function processOutbound(admin: SupabaseClient, job: ClaimedJob): Promise<JobResult> {
  const env = workerEnvironment();
  if (!env.liveSendsEnabled) return { success: false, error: "live_sends_disabled", retryDelaySeconds: 300 };
  const messageId = String(job.payload.message_id ?? "");
  const { data: message, error } = await admin.from("messages").select("*").eq("id", messageId).single();
  if (error || !message) return { success: false, error: error?.message ?? "message_not_found" };
  if (["accepted", "sent", "delivered", "read", "unknown", "cancelled"].includes(message.status)) return { success: true };
  if (message.expires_at && new Date(message.expires_at).getTime() <= Date.now()) {
    await admin.from("messages").update({ status: "cancelled", error_code: "expired", updated_at: new Date().toISOString() }).eq("id", message.id);
    if (message.origin === "campaign") await admin.from("campaign_recipients").update({ status: "skipped" }).eq("message_id", message.id);
    return { success: true };
  }

  const [{ data: channel }, { data: contact }] = await Promise.all([
    admin.from("channels").select("id,phone_number_id,credential_id,status").eq("id", message.channel_id).eq("tenant_id", message.tenant_id).single(),
    admin.from("contacts").select("wa_id,consent_status").eq("id", message.contact_id).eq("tenant_id", message.tenant_id).single(),
  ]);
  if (!channel || channel.status !== "active" || !contact) return { success: false, error: "channel_or_contact_unavailable" };
  const { data: suppression } = await admin.from("contact_suppressions").select("id").eq("tenant_id", message.tenant_id).eq("contact_id", message.contact_id).eq("active", true).maybeSingle();
  const consentBlocked = message.origin === "campaign" ? contact.consent_status !== "opted_in" : contact.consent_status === "opted_out";
  if (consentBlocked || suppression) {
    await admin.from("messages").update({ status: "cancelled", error_code: suppression ? "contact_suppressed" : "contact_consent_blocked" }).eq("id", message.id);
    if (message.origin === "campaign") await admin.from("campaign_recipients").update({ status: "skipped" }).eq("message_id", message.id);
    return { success: true };
  }
  const { data: credential } = await admin.from("integration_credentials").select("ciphertext,iv,auth_tag").eq("id", channel.credential_id).eq("tenant_id", message.tenant_id).single();
  if (!credential) return { success: false, error: "credential_unavailable" };

  const attemptNo = job.attempts;
  const { data: attempt } = await admin.from("message_attempts").upsert({ tenant_id: message.tenant_id, message_id: message.id, attempt_no: attemptNo, outcome: "started" }, { onConflict: "message_id,attempt_no" }).select("id").single();
  await admin.from("messages").update({ status: "dispatching", updated_at: new Date().toISOString() }).eq("id", message.id);
  const token = decryptCredential({ ciphertext: credential.ciphertext, iv: credential.iv, authTag: credential.auth_tag }, env.credentialKey);
  const provider = new MetaCloudApiClient({ accessToken: token, graphVersion: env.graphVersion, phoneNumberId: channel.phone_number_id });
  const result = await provider.send(contact.wa_id, message.content as MessageContent);
  const finishedAt = new Date().toISOString();
  if (result.outcome === "accepted") {
    await admin.from("message_attempts").update({ outcome: "accepted", provider_reference: result.providerMessageId, finished_at: finishedAt }).eq("id", attempt?.id);
    await admin.from("messages").update({ status: "accepted", provider_message_id: result.providerMessageId, accepted_at: finishedAt, updated_at: finishedAt }).eq("id", message.id);
    if (message.origin === "campaign") await admin.from("campaign_recipients").update({ status: "accepted" }).eq("message_id", message.id);
    return { success: true };
  }
  if (result.outcome === "unknown") {
    await admin.from("message_attempts").update({ outcome: "unknown", error_detail: result.reason, finished_at: finishedAt }).eq("id", attempt?.id);
    await admin.from("messages").update({ status: "unknown", error_code: "ambiguous_send", updated_at: finishedAt }).eq("id", message.id);
    if (message.origin === "campaign") await admin.from("campaign_recipients").update({ status: "failed" }).eq("message_id", message.id);
    return { success: true };
  }
  await admin.from("message_attempts").update({ outcome: "rejected", error_code: result.code, error_detail: result.message, finished_at: finishedAt }).eq("id", attempt?.id);
  await admin.from("messages").update({ status: result.retryable ? "queued" : "failed", error_code: result.code, updated_at: finishedAt }).eq("id", message.id);
  if (message.origin === "campaign" && !result.retryable) await admin.from("campaign_recipients").update({ status: "failed" }).eq("message_id", message.id);
  return { success: !result.retryable, error: result.message, retryDelaySeconds: result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : Math.min(900, 2 ** job.attempts) };
}

async function processWorkflow(admin: SupabaseClient, job: ClaimedJob): Promise<JobResult> {
  const runId = String(job.payload.run_id ?? "");
  const { data: run, error: runError } = await admin.from("workflow_runs").select("id,tenant_id,workflow_id,workflow_version,conversation_id,trigger_message_id,status,attempt").eq("id", runId).single();
  if (runError || !run) return { success: false, error: runError?.message ?? "workflow_run_not_found" };
  if (["completed", "cancelled"].includes(run.status)) return { success: true };

  try {
    const [{ data: version }, { data: conversation }, { data: triggerMessage }] = await Promise.all([
      admin.from("workflow_versions").select("graph").eq("workflow_id", run.workflow_id).eq("version", run.workflow_version).eq("tenant_id", run.tenant_id).single(),
      admin.from("conversations").select("id,channel_id,contact_id,ownership_generation").eq("id", run.conversation_id).eq("tenant_id", run.tenant_id).single(),
      admin.from("messages").select("content").eq("id", run.trigger_message_id).eq("tenant_id", run.tenant_id).single(),
    ]);
    if (!version || !conversation) throw new Error("workflow_context_unavailable");
    const triggerText = triggerMessage?.content?.type === "text" && typeof triggerMessage.content.text === "string" ? triggerMessage.content.text : "";
    const actions = planWorkflowExecution(version.graph as WorkflowGraph, triggerText);
    let ownershipGeneration = conversation.ownership_generation;

    for (const action of actions) {
      await admin.from("workflow_runs").update({ current_node_id: action.nodeId }).eq("id", run.id).eq("tenant_id", run.tenant_id);
      const { data: step, error: stepError } = await admin.from("workflow_run_steps").upsert({ tenant_id: run.tenant_id, run_id: run.id, node_id: action.nodeId, node_type: action.type, attempt: run.attempt, status: "running", input: action, output: {}, error: null, started_at: new Date().toISOString(), finished_at: null }, { onConflict: "run_id,node_id,attempt" }).select("id").single();
      if (stepError || !step) throw stepError ?? new Error("workflow_step_create_failed");
      try {
        let output: Record<string, unknown> = {};
        if (action.type === "assign") {
          ownershipGeneration += 1;
          const { error } = await admin.from("conversations").update({ ownership: "human", assigned_user_id: action.userId ?? null, ownership_generation: ownershipGeneration, updated_at: new Date().toISOString() }).eq("id", conversation.id).eq("tenant_id", run.tenant_id);
          if (error) throw error; output = { ownership: "human", assignedUserId: action.userId ?? null };
        } else if (action.type === "contact") {
          if (action.lifecycleStage) { const { error } = await admin.from("contacts").update({ lifecycle_stage: action.lifecycleStage, updated_at: new Date().toISOString() }).eq("id", conversation.contact_id).eq("tenant_id", run.tenant_id); if (error) throw error; }
          if (action.tagId) { const { data: tag } = await admin.from("tags").select("id").eq("id", action.tagId).eq("tenant_id", run.tenant_id).maybeSingle(); if (!tag) throw new Error("workflow_tag_not_found"); const { error } = await admin.from("contact_tags").upsert({ tenant_id: run.tenant_id, contact_id: conversation.contact_id, tag_id: action.tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true }); if (error) throw error; }
          output = { lifecycleStage: action.lifecycleStage ?? null, tagId: action.tagId ?? null };
        } else if (action.type === "status") {
          const allowed = new Set(["new","open","pending","waiting_customer","waiting_internal","escalated","resolved","blocked","spam"]); if (!allowed.has(action.status)) throw new Error("workflow_conversation_status_invalid");
          const { error } = await admin.from("conversations").update({ status: action.status, updated_at: new Date().toISOString() }).eq("id", conversation.id).eq("tenant_id", run.tenant_id); if (error) throw error; output = { status: action.status };
        } else if (action.type === "note") {
          const { data: note, error } = await admin.from("conversation_notes").insert({ tenant_id: run.tenant_id, conversation_id: conversation.id, body: action.body }).select("id").single(); if (error || !note) throw error ?? new Error("workflow_note_failed"); output = { noteId: note.id };
        } else {
          const idempotencyKey = `workflow:${run.id}:${action.nodeId}`;
          if (action.delaySeconds > 0) {
            const dueAt = new Date(Date.now() + action.delaySeconds * 1000);
            const { error } = await admin.from("scheduled_messages").upsert({ tenant_id: run.tenant_id, channel_id: conversation.channel_id, contact_id: conversation.contact_id, conversation_id: conversation.id, content: action.content, origin: "workflow", due_at: dueAt.toISOString(), expires_at: new Date(dueAt.getTime() + 24 * 60 * 60_000).toISOString(), status: "scheduled", idempotency_key: idempotencyKey }, { onConflict: "tenant_id,idempotency_key", ignoreDuplicates: true });
            if (error) throw error; output = { scheduledAt: dueAt.toISOString() };
          } else {
            let messageId = (await admin.from("messages").select("id").eq("tenant_id", run.tenant_id).eq("idempotency_key", idempotencyKey).maybeSingle()).data?.id;
            if (!messageId) { const { data: message, error } = await admin.from("messages").insert({ tenant_id: run.tenant_id, conversation_id: conversation.id, channel_id: conversation.channel_id, contact_id: conversation.contact_id, direction: "outbound", origin: "workflow", status: "queued", idempotency_key: idempotencyKey, content: action.content, expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString() }).select("id").single(); if (error || !message) throw error ?? new Error("workflow_message_create_failed"); messageId = message.id; }
            const existingJob = await admin.from("jobs").select("id").eq("kind", "outbound").eq("payload->>message_id", messageId).neq("status", "dead").limit(1).maybeSingle();
            if (!existingJob.data) { const { data: outboundJob, error } = await admin.from("jobs").insert({ tenant_id: run.tenant_id, kind: "outbound", payload: { message_id: messageId } }).select("id").single(); if (error || !outboundJob) throw error ?? new Error("workflow_job_create_failed"); const { error: outboxError } = await admin.from("outbox").insert({ tenant_id: run.tenant_id, topic: "job.outbound", payload: { job_id: outboundJob.id, kind: "outbound" } }); if (outboxError) throw outboxError; }
            output = { messageId };
          }
        }
        await admin.from("workflow_run_steps").update({ status: "completed", output, finished_at: new Date().toISOString() }).eq("id", step.id);
      } catch (actionError) {
        const detail = actionError instanceof Error ? actionError.message : "workflow_step_failed";
        await admin.from("workflow_run_steps").update({ status: "failed", error: detail, finished_at: new Date().toISOString() }).eq("id", step.id);
        throw actionError;
      }
    }

    await admin.from("workflow_runs").update({ status: "completed", state: { action_count: actions.length }, finished_at: new Date().toISOString() }).eq("id", run.id).eq("tenant_id", run.tenant_id);
    return { success: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "workflow_execution_failed";
    await admin.from("workflow_runs").update({ status: "failed", state: { error: detail }, finished_at: new Date().toISOString() }).eq("id", run.id).eq("tenant_id", run.tenant_id);
    return { success: false, error: detail };
  }
}

async function processCampaign(admin: SupabaseClient, job: ClaimedJob): Promise<JobResult> {
  const campaignId = String(job.payload.campaign_id ?? "");
  if (!campaignId) return { success: false, error: "campaign_id_missing" };
  const { error } = await admin.rpc("expand_campaign_batch", { p_campaign_id: campaignId, p_limit: 25 });
  return error ? { success: false, error: error.message, retryDelaySeconds: 60 } : { success: true };
}

export async function runWorkerBatch(): Promise<{ claimed: number; completed: number; failed: number }> {
  const admin = createAdminClient();
  const env = workerEnvironment();
  const claimLimit = env.liveSendsEnabled
    ? Math.max(1, Math.min(env.batchSize, Math.floor(env.timeBudgetSeconds * env.phoneSendsPerSecond * 0.75)))
    : env.batchSize;
  const { error: scheduleError } = await admin.rpc("dispatch_due_schedules", { p_limit: claimLimit * 2 });
  if (scheduleError) throw scheduleError;
  const { error: campaignScheduleError } = await admin.rpc("dispatch_due_campaigns", { p_limit: claimLimit });
  if (campaignScheduleError) throw campaignScheduleError;
  const { data, error } = await admin.rpc("claim_jobs", { p_limit: claimLimit, p_visibility_seconds: Math.max(90, env.timeBudgetSeconds * 3) });
  if (error) throw error;
  const jobs = (data ?? []) as ClaimedJob[];
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    let result: JobResult;
    try {
      result = job.kind === "inbound"
        ? await processInbound(admin, job)
        : job.kind === "outbound"
          ? await processOutbound(admin, job)
          : job.kind === "workflow"
            ? await processWorkflow(admin, job)
          : job.kind === "campaign"
            ? await processCampaign(admin, job)
            : { success: false, error: `unsupported_job_kind:${job.kind}`, retryDelaySeconds: 300 };
    } catch (jobError) {
      result = { success: false, error: jobError instanceof Error ? jobError.message : "job_failed", retryDelaySeconds: Math.min(900, 2 ** job.attempts) };
    }
    const { error: finishError } = await admin.rpc("finish_job", {
      p_queue_message_id: job.queue_message_id,
      p_job_id: job.job_id,
      p_success: result.success,
      p_error: result.error ?? null,
      p_retry_delay_seconds: result.retryDelaySeconds ?? 30,
    });
    if (finishError) throw finishError;
    if (result.success) completed += 1; else failed += 1;
    if (job.kind === "outbound" && env.liveSendsEnabled) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(1000 / env.phoneSendsPerSecond)));
    }
  }
  return { claimed: jobs.length, completed, failed };
}
