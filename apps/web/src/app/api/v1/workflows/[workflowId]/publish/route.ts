import { validateWorkflowGraph, type WorkflowGraph } from "@passion-fruit/domain";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const bodySchema = z.object({ version: z.number().int().positive() });

export async function POST(request: Request, context: { params: Promise<{ workflowId: string }> }) {
  const id = requestId(request);
  try {
    const { workflowId } = await context.params;
    z.uuid().parse(workflowId);
    const { version } = bodySchema.parse(await readJson(request));
    const { client } = await requireUser(request);
    const { data: record, error: readError } = await client.from("workflow_versions").select("graph").eq("workflow_id", workflowId).eq("version", version).single();
    if (readError || !record) throw readError ?? new Error("Workflow version not found");
    const validation = validateWorkflowGraph(record.graph as WorkflowGraph);
    if (!validation.valid) return Response.json({ error: { code: "invalid_workflow", message: "Workflow graph is invalid", requestId: id, details: validation.errors } }, { status: 400 });
    const { error } = await client.rpc("publish_workflow", { p_workflow_id: workflowId, p_version: version });
    if (error) throw error;
    return ok({ workflowId, version, status: "active" }, id);
  } catch (error) { return failure(error, id); }
}
