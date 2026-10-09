import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, requireTenantRole } from "@/server/supabase";

const updateSchema = z.object({ tenantId: z.uuid(), name: z.string().trim().min(2).max(80).optional(), capacity: z.number().int().min(1).max(1000).optional(), memberIds: z.array(z.uuid()).max(1000).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ teamId: string }> }) {
  const id = requestId(request);
  try {
    const { teamId } = await context.params;
    z.uuid().parse(teamId);
    const input = updateSchema.parse(await readJson(request));
    const { client } = await requireTenantRole(request, input.tenantId, ["owner","manager"]);
    const { data: team } = await client.from("teams").select("id").eq("id", teamId).eq("tenant_id", input.tenantId).maybeSingle();
    if (!team) throw new ApiAuthError("team_not_found", 404);
    if (input.memberIds) {
      const { data } = input.memberIds.length ? await client.from("memberships").select("user_id").eq("tenant_id", input.tenantId).eq("status", "active").in("user_id", input.memberIds) : { data: [] };
      if ((data ?? []).length !== input.memberIds.length) throw new ApiAuthError("invalid_team_member", 400);
      const { error: clearError } = await client.from("team_members").delete().eq("tenant_id", input.tenantId).eq("team_id", teamId);
      if (clearError) throw clearError;
      if (input.memberIds.length) {
        const { error: linkError } = await client.from("team_members").insert(input.memberIds.map((userId) => ({ tenant_id: input.tenantId, team_id: teamId, user_id: userId })));
        if (linkError) throw linkError;
      }
    }
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) changes.name = input.name;
    if (input.capacity !== undefined) changes.capacity = input.capacity;
    const { data, error } = await client.from("teams").update(changes).eq("id", teamId).eq("tenant_id", input.tenantId).select("id,name,capacity,updated_at").single();
    if (error) throw error;
    return ok(data, id);
  } catch (error) { return failure(error, id); }
}
