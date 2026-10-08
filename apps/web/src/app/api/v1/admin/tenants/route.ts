import { createTenantSchema } from "@passion-fruit/contracts";
import { failure, ok, readJson, requestId } from "@/server/http";
import { createAdminClient, requireUser, ApiAuthError } from "@/server/supabase";

async function requirePlatformAdmin(request: Request) {
  const { client, user } = await requireUser(request);
  const { data } = await client.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new ApiAuthError("platform_admin_required", 403);
  return user;
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requirePlatformAdmin(request);
    const admin = createAdminClient();
    const [{ data: tenants, error: tenantError }, { data: owners, error: ownerError }, { data: features, error: featureError }, { data: channels, error: channelError }, { data: authUsers, error: authError }] = await Promise.all([
      admin.from("tenants").select("id,name,slug,status,timezone,created_at,updated_at").order("created_at"),
      admin.from("memberships").select("tenant_id,user_id,status").eq("role", "owner"),
      admin.from("tenant_features").select("tenant_id,feature_key,enabled,limits,revision").order("feature_key"),
      admin.from("channels").select("tenant_id,id,status,display_name,phone_number_id"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (tenantError || ownerError || featureError || channelError || authError) throw tenantError ?? ownerError ?? featureError ?? channelError ?? authError;
    const emailById = new Map(authUsers.users.map((entry) => [entry.id, entry.email ?? "Unknown owner"]));
    const rows = await Promise.all((tenants ?? []).map(async (tenant) => {
      const [{ count: outbound }, { count: contacts }] = await Promise.all([
        admin.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("direction", "outbound"),
        admin.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      ]);
      const owner = (owners ?? []).find((entry) => entry.tenant_id === tenant.id && entry.status === "active") ?? (owners ?? []).find((entry) => entry.tenant_id === tenant.id);
      return {
        ...tenant,
        ownerEmail: owner ? emailById.get(owner.user_id) ?? "Unknown owner" : "No owner",
        features: (features ?? []).filter((entry) => entry.tenant_id === tenant.id).map(({ feature_key, enabled, limits, revision }) => ({ key: feature_key, enabled, limits, revision })),
        channels: (channels ?? []).filter((entry) => entry.tenant_id === tenant.id),
        usage: { outboundMessages: outbound ?? 0, contacts: contacts ?? 0 },
      };
    }));
    return ok(rows, id);
  } catch (error) {
    return failure(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = createTenantSchema.parse(await readJson(request));
    const user = await requirePlatformAdmin(request);

    const admin = createAdminClient();
    const redirectTo = new URL("/auth/callback", process.env.PF_APP_URL ?? new URL(request.url).origin).toString();
    const { data: invitation, error: inviteError } = input.accessMethod === "temporary_password"
      ? await admin.auth.admin.createUser({
          email: input.ownerEmail,
          password: input.temporaryPassword!,
          email_confirm: true,
          user_metadata: { display_name: input.name, must_change_password: true },
        })
      : await admin.auth.admin.inviteUserByEmail(input.ownerEmail, {
          redirectTo,
          data: { display_name: input.name, must_change_password: false },
        });
    if (inviteError || !invitation.user) throw inviteError ?? new Error("Owner account creation failed");

    const { data: tenantId, error: provisionError } = await admin.rpc("provision_tenant", {
      p_name: input.name,
      p_slug: input.slug,
      p_owner_user_id: invitation.user.id,
      p_feature_keys: input.features,
    });
    if (provisionError || !tenantId) {
      await admin.auth.admin.deleteUser(invitation.user.id);
      throw provisionError ?? new Error("Tenant provisioning failed");
    }
    return ok({ tenantId, invitedUserId: invitation.user.id }, id, 201);
  } catch (error) {
    return failure(error, id);
  }
}
