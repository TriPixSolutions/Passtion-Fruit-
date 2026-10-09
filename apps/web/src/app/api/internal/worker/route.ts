import { createHash, timingSafeEqual } from "node:crypto";
import { failure, ok, requestId } from "@/server/http";
import { createAdminClient } from "@/server/supabase";
import { runWorkerBatch } from "@/server/worker";

async function authorised(request: Request): Promise<boolean> {
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  if (!supplied) return false;

  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const environmentSecret = process.env.PF_WORKER_TRIGGER_SECRET;
  if (environmentSecret) {
    const environmentDigest = createHash("sha256").update(environmentSecret).digest();
    if (timingSafeEqual(suppliedDigest, environmentDigest)) return true;
  }

  const { data, error } = await createAdminClient()
    .from("worker_trigger_secrets")
    .select("id")
    .eq("id", 1)
    .eq("secret_sha256", suppliedDigest.toString("hex"))
    .maybeSingle();
  return !error && Boolean(data);
}

export async function POST(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  try {
    if (!(await authorised(request))) return Response.json({ error: { code: "worker_auth_failed", message: "Worker authentication failed", requestId: id } }, { status: 401 });
    const admin = createAdminClient();
    const { data: run, error: runError } = await admin.from("worker_runs").insert({ request_id: id, status: "running" }).select("id").single();
    if (runError || !run) throw runError ?? new Error("worker_run_create_failed");
    try {
      const result = await runWorkerBatch();
      const { error: finishError } = await admin.from("worker_runs").update({ status: "succeeded", ...result, duration_ms: Date.now() - started, finished_at: new Date().toISOString() }).eq("id", run.id);
      if (finishError) throw finishError;
      return ok(result, id);
    } catch (workerError) {
      await admin.from("worker_runs").update({ status: "failed", duration_ms: Date.now() - started, error_category: "worker_batch_failed", finished_at: new Date().toISOString() }).eq("id", run.id);
      throw workerError;
    }
  } catch (error) {
    return failure(error, id);
  }
}
