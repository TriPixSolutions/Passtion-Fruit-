import { z } from "zod";
import { failure, ok, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client
      .from("conversations")
      .select("id,status,ownership,assigned_user_id,last_message_at,contacts(id,wa_id,display_name,consent_status),messages(id,direction,origin,status,content,created_at)")
      .eq("tenant_id", query.tenantId)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(50)
      .limit(30, { referencedTable: "messages" });
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) {
    return failure(error, id);
  }
}
