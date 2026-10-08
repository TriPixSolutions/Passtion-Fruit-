import { sendMessageSchema } from "@passion-fruit/contracts";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = sendMessageSchema.parse(await readJson(request));
    const { client } = await requireUser(request);
    const { data: messageId, error } = await client.rpc("enqueue_outbound_message", {
      p_tenant_id: input.tenantId,
      p_channel_id: input.channelId,
      p_contact_id: input.contactId,
      p_conversation_id: input.conversationId ?? null,
      p_idempotency_key: input.idempotencyKey,
      p_origin: input.origin,
      p_content: input.content,
      p_expected_ownership_generation: input.expectedOwnershipGeneration ?? null,
      p_expires_at: input.expiresAt,
    });
    if (error) throw error;
    return ok({ messageId, state: "queued" }, id, 202);
  } catch (error) {
    return failure(error, id);
  }
}
