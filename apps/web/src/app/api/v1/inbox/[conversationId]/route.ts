import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, requireTenantRole, requireUser } from "@/server/supabase";

const updateSchema = z.object({
  tenantId: z.uuid(),
  status: z.enum(["new", "open", "pending", "waiting_customer", "waiting_internal", "escalated", "resolved", "blocked", "spam"]).optional(),
  assignedUserId: z.uuid().nullable().optional(),
  teamId: z.uuid().nullable().optional(),
  ownership: z.enum(["human", "automation"]).optional(),
}).refine((value) => value.status !== undefined || value.assignedUserId !== undefined || value.teamId !== undefined || value.ownership !== undefined, { message: "At least one change is required" });

const noteSchema = z.object({ tenantId: z.uuid(), body: z.string().trim().min(1).max(4000) });

export async function PATCH(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  const id = requestId(request);
  try {
    const { conversationId } = await context.params;
    z.uuid().parse(conversationId);
    const input = updateSchema.parse(await readJson(request));
    const { client, user } = await requireUser(request);
    const { data: membership } = await client.from("memberships").select("role").eq("tenant_id", input.tenantId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) throw new ApiAuthError("tenant_access_denied", 403);
    if ((input.assignedUserId !== undefined || input.teamId !== undefined) && !["owner", "manager"].includes(membership.role)) throw new ApiAuthError("manager_required", 403);
    if (input.assignedUserId) {
      const { data: assignee } = await client.from("memberships").select("user_id").eq("tenant_id", input.tenantId).eq("user_id", input.assignedUserId).eq("status", "active").maybeSingle();
      if (!assignee) throw new ApiAuthError("invalid_assignee", 400);
    }
    if (input.teamId) {
      const { data: team } = await client.from("teams").select("id").eq("tenant_id", input.tenantId).eq("id", input.teamId).maybeSingle();
      if (!team) throw new ApiAuthError("invalid_team", 400);
    }
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status !== undefined) changes.status = input.status;
    if (input.assignedUserId !== undefined) changes.assigned_user_id = input.assignedUserId;
    if (input.teamId !== undefined) changes.team_id = input.teamId;
    if (input.ownership !== undefined) { changes.ownership = input.ownership; changes.ownership_generation = undefined; }
    if (changes.ownership_generation === undefined) delete changes.ownership_generation;
    const { data: current } = await client.from("conversations").select("ownership,ownership_generation").eq("id", conversationId).eq("tenant_id", input.tenantId).single();
    if (input.ownership !== undefined && current && current.ownership !== input.ownership) changes.ownership_generation = current.ownership_generation + 1;
    const { data, error } = await client.from("conversations").update(changes).eq("id", conversationId).eq("tenant_id", input.tenantId).select("id,status,assigned_user_id,team_id,ownership,ownership_generation").single();
    if (error) throw error;
    return ok(data, id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  const id = requestId(request);
  try {
    const { conversationId } = await context.params;
    z.uuid().parse(conversationId);
    const input = noteSchema.parse(await readJson(request));
    const { client, user } = await requireTenantRole(request, input.tenantId, ["owner", "manager", "agent"]);
    const { data, error } = await client.from("conversation_notes").insert({ tenant_id: input.tenantId, conversation_id: conversationId, author_id: user.id, body: input.body }).select("id,body,author_id,created_at").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
