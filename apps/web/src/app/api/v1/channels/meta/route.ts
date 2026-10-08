import { MetaCloudApiClient } from "@passion-fruit/adapters/meta";
import { encryptCredential } from "@passion-fruit/adapters/security";
import { connectMetaChannelSchema } from "@passion-fruit/contracts";
import { workerEnvironment } from "@/server/env";
import { failure, ok, readJson, requestId } from "@/server/http";
import { createAdminClient, requireTenantRole } from "@/server/supabase";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = connectMetaChannelSchema.parse(await readJson(request));
    const { user } = await requireTenantRole(request, input.tenantId, ["owner", "manager"]);
    const env = workerEnvironment();
    const provider = new MetaCloudApiClient({ accessToken: input.accessToken, graphVersion: env.graphVersion, phoneNumberId: input.phoneNumberId });
    const verifiedAsset = await provider.inspectPhoneNumber();
    if (verifiedAsset.id !== input.phoneNumberId) throw new Error("Meta returned a different phone number asset");
    const encrypted = encryptCredential(input.accessToken, env.credentialKey);
    const admin = createAdminClient();
    const { data: credential, error: credentialError } = await admin
      .from("integration_credentials")
      .insert({
        tenant_id: input.tenantId,
        provider: "meta_whatsapp",
        key_id: env.credentialKeyId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
      })
      .select("id")
      .single();
    if (credentialError || !credential) throw credentialError ?? new Error("Credential storage failed");

    const { data: channel, error: channelError } = await admin
      .from("channels")
      .insert({
        tenant_id: input.tenantId,
        provider: "meta_whatsapp",
        display_name: input.displayName,
        phone_number_id: input.phoneNumberId,
        whatsapp_business_account_id: input.whatsappBusinessAccountId,
        credential_id: credential.id,
        status: "active",
      })
      .select("id,status")
      .single();
    if (channelError || !channel) {
      await admin.from("integration_credentials").delete().eq("id", credential.id);
      throw channelError ?? new Error("Channel creation failed");
    }
    await admin.from("audit_events").insert({ tenant_id: input.tenantId, actor_id: user.id, actor_type: "user", action: "channel.connected", target_type: "channel", target_id: channel.id });
    return ok({ ...channel, provider: { displayPhoneNumber: verifiedAsset.displayPhoneNumber, verifiedName: verifiedAsset.verifiedName, qualityRating: verifiedAsset.qualityRating } }, id, 201);
  } catch (error) {
    return failure(error, id);
  }
}
