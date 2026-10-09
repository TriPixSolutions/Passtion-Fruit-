import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { createAdminClient, requireTenantRole, requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });
const createSchema = z.object({ tenantId: z.uuid(), name: z.string().trim().min(2).max(80), capacity: z.number().int().min(1).max(1000).default(10) });

async function teamPayload(request: Request, tenantId: string) {
  const { client } = await requireUser(request);
  const [{ data: teams, error: teamError }, { data: memberships, error: memberError }, { data: links, error: linkError }] = await Promise.all([
    client.from("teams").select("id,name,capacity,created_at").eq("tenant_id", tenantId).order("name"),
    client.from("memberships").select("user_id,role,status,created_at").eq("tenant_id", tenantId).order("created_at"),
    client.from("team_members").select("team_id,user_id").eq("tenant_id", tenantId),
  ]);
  if (teamError || memberError || linkError) throw teamError ?? memberError ?? linkError;
  const admin = createAdminClient();
  const users = await Promise.all((memberships ?? []).map(async (membership) => {
    const { data } = await admin.auth.admin.getUserById(membership.user_id);
    return { ...membership, email: data.user?.email ?? "Member", display_name: String(data.user?.user_metadata?.display_name ?? data.user?.email?.split("@")[0] ?? membership.role), team_ids: (links ?? []).filter((link) => link.user_id === membership.user_id).map((link) => link.team_id) };
  }));
  return { teams: teams ?? [], members: users };
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    await requireTenantRole(request, input.tenantId, ["owner","manager","agent","analyst"]);
    return ok(await teamPayload(request, input.tenantId), id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = createSchema.parse(await readJson(request));
    const { client } = await requireTenantRole(request, input.tenantId, ["owner","manager"]);
    const { data, error } = await client.from("teams").insert({ tenant_id: input.tenantId, name: input.name, capacity: input.capacity }).select("id,name,capacity,created_at").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
