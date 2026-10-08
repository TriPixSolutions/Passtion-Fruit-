import { z } from "zod";
import { failure, ok, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const [contacts, openConversations, outbound, delivered, failed] = await Promise.all([
      client.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      client.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "open"),
      client.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound"),
      client.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["delivered", "read"]),
      client.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["failed", "unknown"]),
    ]);
    const firstError = [contacts, openConversations, outbound, delivered, failed].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    const outboundCount = outbound.count ?? 0;
    return ok({ contacts: contacts.count ?? 0, openConversations: openConversations.count ?? 0, outbound: outboundCount, delivered: delivered.count ?? 0, failedOrUnknown: failed.count ?? 0, deliveryRate: outboundCount ? Math.round(((delivered.count ?? 0) / outboundCount) * 1000) / 10 : null }, id);
  } catch (error) { return failure(error, id); }
}
