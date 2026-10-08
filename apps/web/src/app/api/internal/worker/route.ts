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
  try {
    if (!(await authorised(request))) return Response.json({ error: { code: "worker_auth_failed", message: "Worker authentication failed", requestId: id } }, { status: 401 });
    return ok(await runWorkerBatch(), id);
  } catch (error) {
    return failure(error, id);
  }
}
