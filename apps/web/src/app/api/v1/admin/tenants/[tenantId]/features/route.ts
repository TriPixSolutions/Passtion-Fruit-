import { z } from "zod";
import { featureKeys } from "@passion-fruit/contracts";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, createAdminClient, requireUser } from "@/server/supabase";

const bodySchema = z.object({
  features: z.array(z.object({ key: z.enum(featureKeys), enabled: z.boolean(), limits: z.record(z.string(), z.unknown()).default({}) })).min(1).max(featureKeys.length),
});

export async function PATCH(request: Request, context: RouteContext<"/api/v1/admin/tenants/[tenantId]/features">) {
  const id = requestId(request);
  try {
    const { tenantId } = await context.params;
    z.uuid().parse(tenantId);
    const input = bodySchema.parse(await readJson(request));
    const { client, user } = await requireUser(request);
    const { data: platformAdmin } = await client.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!platformAdmin) throw new ApiAuthError("platform_admin_required", 403);
    const admin = createAdminClient();
    const rows = input.features.map((feature) => ({ tenant_id: tenantId, feature_key: feature.key, enabled: feature.enabled, limits: feature.limits, updated_by: user.id, updated_at: new Date().toISOString() }));
    const { data, error } = await admin.from("tenant_features").upsert(rows, { onConflict: "tenant_id,feature_key" }).select("feature_key,enabled,limits,revision");
    if (error) throw error;
    await admin.from("audit_events").insert({ tenant_id: tenantId, actor_id: user.id, actor_type: "user", action: "tenant.features_updated", target_type: "tenant", target_id: tenantId, metadata: { featureKeys: input.features.map((feature) => feature.key) } });
    return ok(data ?? [], id);
  } catch (error) {
    return failure(error, id);
  }
}
