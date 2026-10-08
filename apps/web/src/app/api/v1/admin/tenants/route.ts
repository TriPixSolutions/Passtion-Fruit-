import { createTenantSchema } from "@passion-fruit/contracts";
import { failure, ok, readJson, requestId } from "@/server/http";
import { createAdminClient, requireUser, ApiAuthError } from "@/server/supabase";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = createTenantSchema.parse(await readJson(request));
    const { client, user } = await requireUser(request);
    const { data: platformAdmin } = await client.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!platformAdmin) throw new ApiAuthError("platform_admin_required", 403);

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
