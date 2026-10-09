import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireTenantRole, requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });
const createSchema = z.object({ tenantId: z.uuid(), name: z.string().trim().min(1).max(40), color: z.enum(["sage","blue","amber","violet","rose","slate"]).default("sage") });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("tags").select("id,name,color").eq("tenant_id", input.tenantId).order("name");
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = createSchema.parse(await readJson(request));
    const { client } = await requireTenantRole(request, input.tenantId, ["owner","manager"]);
    const { data, error } = await client.from("tags").insert({ tenant_id: input.tenantId, name: input.name, color: input.color }).select("id,name,color").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
