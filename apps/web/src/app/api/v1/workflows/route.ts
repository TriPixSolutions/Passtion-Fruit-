import { createHash } from "node:crypto";
import { workflowDraftSchema } from "@passion-fruit/contracts";
import { validateWorkflowGraph, type WorkflowGraph } from "@passion-fruit/domain";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireTenantRole, requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("workflow_definitions").select("id,name,status,active_version,updated_at,workflow_versions(version,graph,published_at)").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
    if (error) throw error;
    const workflowIds=(data??[]).map((workflow)=>workflow.id);
    const { data: runs, error: runError } = workflowIds.length
      ? await client.from("workflow_runs").select("id,workflow_id,status,attempt,current_node_id,state,started_at,finished_at,workflow_run_steps(id,node_id,node_type,status,error,started_at,finished_at)").eq("tenant_id",tenantId).in("workflow_id",workflowIds).order("started_at",{ascending:false}).limit(100)
      : { data: [], error: null };
    if(runError)throw runError;
    return ok((data??[]).map((workflow)=>({...workflow,workflow_runs:(runs??[]).filter((run)=>run.workflow_id===workflow.id).slice(0,10)})), id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = workflowDraftSchema.parse(await readJson(request));
    const validation = validateWorkflowGraph(input.graph as unknown as WorkflowGraph);
    if (!validation.valid) return Response.json({ error: { code: "invalid_workflow", message: "Workflow graph is invalid", requestId: id, details: validation.errors } }, { status: 400 });
    const { client, user } = await requireTenantRole(request, input.tenantId, ["owner","manager"]);
    const { data: workflow, error: workflowError } = await client.from("workflow_definitions").insert({ tenant_id: input.tenantId, name: input.name, status: "draft", created_by: user.id }).select("id,name,status").single();
    if (workflowError || !workflow) throw workflowError ?? new Error("Workflow creation failed");
    const graphJson = JSON.stringify(input.graph);
    const { error: versionError } = await client.from("workflow_versions").insert({ workflow_id: workflow.id, tenant_id: input.tenantId, version: 1, graph: input.graph, checksum: createHash("sha256").update(graphJson).digest("hex") });
    if (versionError) {
      await client.from("workflow_definitions").delete().eq("id", workflow.id).eq("tenant_id", input.tenantId);
      throw versionError;
    }
    return ok({ ...workflow, version: 1 }, id, 201);
  } catch (error) { return failure(error, id); }
}
