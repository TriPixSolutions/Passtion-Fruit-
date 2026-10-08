import { scheduleMessageSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("scheduled_messages").select("id,contact_id,content,due_at,expires_at,status,created_at").eq("tenant_id", tenantId).order("due_at").limit(100);
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = scheduleMessageSchema.parse(await readJson(request));
    if (new Date(input.dueAt).getTime() <= Date.now()) throw new Error("dueAt must be in the future");
    const { client, user } = await requireUser(request);
    const { data, error } = await client.from("scheduled_messages").insert({ tenant_id: input.tenantId, channel_id: input.channelId, contact_id: input.contactId, conversation_id: input.conversationId, content: input.content, due_at: input.dueAt, expires_at: input.expiresAt, idempotency_key: input.idempotencyKey, created_by: user.id }).select("id,status,due_at").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
