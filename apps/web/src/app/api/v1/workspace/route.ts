import { failure, ok, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { client, user } = await requireUser(request);
    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("tenant_id,role,status,tenants(id,name,slug,status)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return ok({ workspace: null, features: [], channels: [], platformAdmin: false }, id);

    const [{ data: features, error: featureError }, { data: channels, error: channelError }, { data: platformAdmin, error: adminError }] = await Promise.all([
      client.from("tenant_features").select("feature_key,enabled,limits").eq("tenant_id", membership.tenant_id).eq("enabled", true).order("feature_key"),
      client.from("channels").select("id,display_name,provider,status,capabilities").eq("tenant_id", membership.tenant_id).order("created_at"),
      client.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if (featureError || channelError || adminError) throw featureError ?? channelError ?? adminError;
    const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
    return ok({
      workspace: tenant ? { ...tenant, role: membership.role } : null,
      features: (features ?? []).map((feature) => ({ key: feature.feature_key, limits: feature.limits })),
      channels: channels ?? [],
      platformAdmin: Boolean(platformAdmin),
    }, id);
  } catch (error) {
    return failure(error, id);
  }
}
