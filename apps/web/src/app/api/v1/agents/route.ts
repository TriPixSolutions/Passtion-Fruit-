import { agentSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("ai_agents").select("id,name,purpose,mode,allowed_tools,daily_budget_minor,version,updated_at").eq("tenant_id", tenantId).order("created_at");
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = agentSchema.parse(await readJson(request));
    const { client } = await requireUser(request);
    if (input.mode === "auto_reply") {
      const { data: grant } = await client.from("tenant_features").select("enabled").eq("tenant_id", input.tenantId).eq("feature_key", "ai_auto_reply").maybeSingle();
      if (!grant?.enabled) throw new ApiAuthError("ai_auto_reply_disabled", 403);
    }
    const { data, error } = await client.from("ai_agents").insert({ tenant_id: input.tenantId, name: input.name, purpose: input.purpose, mode: input.mode, instructions: input.instructions, allowed_tools: input.allowedTools, daily_budget_minor: input.dailyBudgetMinor }).select("id,name,mode,version").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
