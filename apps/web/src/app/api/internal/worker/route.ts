import { createHash, timingSafeEqual } from "node:crypto";
import { workerEnvironment } from "@/server/env";
import { failure, ok, requestId } from "@/server/http";
import { runWorkerBatch } from "@/server/worker";

function authorised(request: Request, expected: string): boolean {
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const left = createHash("sha256").update(supplied).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const env = workerEnvironment();
    if (!authorised(request, env.workerSecret)) return Response.json({ error: { code: "worker_auth_failed", message: "Worker authentication failed", requestId: id } }, { status: 401 });
    return ok(await runWorkerBatch(), id);
  } catch (error) {
    return failure(error, id);
  }
}
