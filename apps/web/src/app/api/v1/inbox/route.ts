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
      .select("id,channel_id,contact_id,status,ownership,ownership_generation,assigned_user_id,team_id,last_message_at,created_at,contacts(id,wa_id,display_name,consent_status),messages(id,direction,origin,status,content,created_at),conversation_notes(id,body,author_id,created_at)")
      .eq("tenant_id", query.tenantId)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(50)
      .limit(30, { referencedTable: "messages" });
    if (error) throw error;
    const [{ data: memberships, error: memberError }, { data: teams, error: teamError }, { data: savedReplies, error: replyError }, { data: slaPolicies, error: slaError }] = await Promise.all([
      client.from("memberships").select("user_id,role,status").eq("tenant_id", query.tenantId).eq("status", "active"),
      client.from("teams").select("id,name,capacity").eq("tenant_id", query.tenantId).order("name"),
      client.from("saved_replies").select("id,shortcut,title,body").eq("tenant_id", query.tenantId).eq("active", true).order("shortcut"),
      client.from("sla_policies").select("id,name,first_response_minutes,resolution_minutes").eq("tenant_id", query.tenantId).eq("active", true).eq("is_default", true).limit(1),
    ]);
    if (memberError || teamError || replyError || slaError) throw memberError ?? teamError ?? replyError ?? slaError;
    const userIds = (memberships ?? []).map((membership) => membership.user_id);
    const { data: profiles, error: profileError } = userIds.length ? await client.from("profiles").select("id,display_name").in("id", userIds) : { data: [], error: null };
    if (profileError) throw profileError;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    return ok({ conversations: data ?? [], members: (memberships ?? []).map((membership) => ({ ...membership, display_name: profileById.get(membership.user_id) ?? membership.role })), teams: teams ?? [], savedReplies: savedReplies ?? [], slaPolicy: slaPolicies?.[0] ?? null }, id);
  } catch (error) {
    return failure(error, id);
  }
}
