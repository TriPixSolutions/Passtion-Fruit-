import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, requireUser } from "@/server/supabase";

const updateSchema = z.object({
  tenantId: z.uuid(),
  displayName: z.string().trim().min(1).max(120).optional(),
  lifecycleStage: z.enum(["lead","qualified","opportunity","customer","repeat_customer","win_back","inactive"]).optional(),
  leadScore: z.number().int().min(0).max(100).optional(),
  source: z.string().trim().max(80).nullable().optional(),
  consentStatus: z.enum(["unknown","opted_in","opted_out"]).optional(),
  consentSource: z.string().trim().min(2).max(120).optional(),
  assignedUserId: z.uuid().nullable().optional(),
  teamId: z.uuid().nullable().optional(),
  tagIds: z.array(z.uuid()).max(30).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ contactId: string }> }) {
  const id = requestId(request);
  try {
    const { contactId } = await context.params;
    z.uuid().parse(contactId);
    const input = updateSchema.parse(await readJson(request));
    const { client, user } = await requireUser(request);
    const { data: membership } = await client.from("memberships").select("role").eq("tenant_id", input.tenantId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership || !["owner","manager","agent"].includes(membership.role)) throw new ApiAuthError("tenant_access_denied", 403);
    if ((input.assignedUserId !== undefined || input.teamId !== undefined) && !["owner","manager"].includes(membership.role)) throw new ApiAuthError("manager_required", 403);
    if (input.consentStatus && !input.consentSource) throw new ApiAuthError("consent_source_required", 400);
    if (input.assignedUserId) {
      const { data } = await client.from("memberships").select("user_id").eq("tenant_id", input.tenantId).eq("user_id", input.assignedUserId).eq("status", "active").maybeSingle();
      if (!data) throw new ApiAuthError("invalid_assignee", 400);
    }
    if (input.teamId) {
      const { data } = await client.from("teams").select("id").eq("tenant_id", input.tenantId).eq("id", input.teamId).maybeSingle();
      if (!data) throw new ApiAuthError("invalid_team", 400);
    }
    if (input.tagIds) {
      const { data } = input.tagIds.length ? await client.from("tags").select("id").eq("tenant_id", input.tenantId).in("id", input.tagIds) : { data: [] };
      if ((data ?? []).length !== input.tagIds.length) throw new ApiAuthError("invalid_tag", 400);
    }
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.displayName !== undefined) changes.display_name = input.displayName;
    if (input.lifecycleStage !== undefined) changes.lifecycle_stage = input.lifecycleStage;
    if (input.leadScore !== undefined) changes.lead_score = input.leadScore;
    if (input.source !== undefined) changes.source = input.source;
    if (input.assignedUserId !== undefined) changes.assigned_user_id = input.assignedUserId;
    if (input.teamId !== undefined) changes.team_id = input.teamId;
    if (input.consentStatus !== undefined) {
      changes.consent_status = input.consentStatus;
      changes.consent_source = input.consentSource;
      changes.consent_updated_at = new Date().toISOString();
    }
    const { data: contact, error } = await client.from("contacts").update(changes).eq("id", contactId).eq("tenant_id", input.tenantId).select("id,wa_id,phone_e164,display_name,consent_status,consent_source,consent_updated_at,lifecycle_stage,lead_score,source,assigned_user_id,team_id,updated_at").single();
    if (error) throw error;
    if (input.tagIds) {
      const { error: clearError } = await client.from("contact_tags").delete().eq("tenant_id", input.tenantId).eq("contact_id", contactId);
      if (clearError) throw clearError;
      if (input.tagIds.length) {
        const { error: tagError } = await client.from("contact_tags").insert(input.tagIds.map((tagId) => ({ tenant_id: input.tenantId, contact_id: contactId, tag_id: tagId })));
        if (tagError) throw tagError;
      }
    }
    return ok(contact, id);
  } catch (error) { return failure(error, id); }
}
