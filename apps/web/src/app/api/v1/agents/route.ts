import { agentSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, requireTenantRole, requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("ai_agents").select("id,name,purpose,mode,instructions,allowed_tools,daily_budget_minor,version,tone,supported_languages,confidence_threshold,guardrails,published_at,updated_at").eq("tenant_id", tenantId).order("created_at");
    if (error) throw error;
    const agentIds=(data??[]).map((agent)=>agent.id);
    const [{data:sources,error:sourceError},{data:evaluations,error:evaluationError}]=agentIds.length?await Promise.all([
      client.from("agent_knowledge_sources").select("id,agent_id,name,kind,status,created_at").eq("tenant_id",tenantId).in("agent_id",agentIds).neq("status","archived").order("created_at",{ascending:false}),
      client.from("agent_evaluations").select("id,agent_id,prompt,response,confidence,outcome,handoff_reason,created_at").eq("tenant_id",tenantId).in("agent_id",agentIds).order("created_at",{ascending:false}).limit(100),
    ]):[{data:[],error:null},{data:[],error:null}];
    if(sourceError||evaluationError)throw sourceError??evaluationError;
    return ok((data??[]).map((agent)=>({...agent,knowledge_sources:(sources??[]).filter((source)=>source.agent_id===agent.id),evaluations:(evaluations??[]).filter((evaluation)=>evaluation.agent_id===agent.id).slice(0,10)})), id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = agentSchema.parse(await readJson(request));
    const { client } = await requireTenantRole(request, input.tenantId, ["owner","manager"]);
    if (input.mode === "auto_reply") {
      const { data: grant } = await client.from("tenant_features").select("enabled").eq("tenant_id", input.tenantId).eq("feature_key", "ai_auto_reply").maybeSingle();
      if (!grant?.enabled) throw new ApiAuthError("ai_auto_reply_disabled", 403);
    }
    const { data, error } = await client.from("ai_agents").insert({ tenant_id: input.tenantId, name: input.name, purpose: input.purpose, mode: input.mode, instructions: input.instructions, allowed_tools: input.allowedTools, daily_budget_minor: input.dailyBudgetMinor, tone:input.tone, supported_languages:input.supportedLanguages, confidence_threshold:input.confidenceThreshold, guardrails:input.guardrails }).select("id,name,mode,version").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
