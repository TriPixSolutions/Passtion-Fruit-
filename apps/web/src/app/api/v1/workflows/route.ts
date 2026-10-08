import { createHash } from "node:crypto";
import { workflowDraftSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("workflow_definitions").select("id,name,status,active_version,updated_at,workflow_versions(version,graph,published_at)").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = workflowDraftSchema.parse(await readJson(request));
    const { client, user } = await requireUser(request);
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
