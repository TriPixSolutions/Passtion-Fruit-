import "server-only";
import { decryptCredential, MetaCloudApiClient } from "@passion-fruit/adapters";
import type { MessageContent, MessageStatus } from "@passion-fruit/domain";
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
    const value = media as { id?: unknown; mime_type?: unknown; caption?: unknown };
    return { type, mediaId: value.id, mimeType: value.mime_type, caption: value.caption };
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
  const { data: channel } = await admin.from("channels").select("id").eq("tenant_id", receipt.tenant_id).eq("phone_number_id", receipt.phone_number_id).single();
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
        const { error: messageError } = await admin.from("messages").upsert({
          tenant_id: receipt.tenant_id,
          conversation_id: conversation.id,
          channel_id: channel.id,
          contact_id: contact.id,
          direction: "inbound",
          origin: "customer",
          status: "received",
          provider_message_id: providerMessageId,
          content: inboundContent(providerMessage),
          created_at: occurredAt,
        }, { onConflict: "tenant_id,provider_message_id", ignoreDuplicates: true });
        if (messageError) return { success: false, error: messageError.message };
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
  if (contact.consent_status === "opted_out") {
    await admin.from("messages").update({ status: "cancelled", error_code: "contact_opted_out" }).eq("id", message.id);
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
