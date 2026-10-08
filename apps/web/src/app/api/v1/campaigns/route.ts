import { campaignDraftSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("campaigns").select("id,name,status,channel_id,template,audience_filter,scheduled_at,created_at,updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = campaignDraftSchema.parse(await readJson(request));
    if (input.scheduledAt && new Date(input.scheduledAt).getTime() <= Date.now()) throw new Error("scheduledAt must be in the future");
    const { client, user } = await requireUser(request);
    const { data, error } = await client.from("campaigns").insert({ tenant_id: input.tenantId, name: input.name, status: input.scheduledAt ? "scheduled" : "draft", channel_id: input.channelId, template: input.template, audience_filter: input.audienceFilter, scheduled_at: input.scheduledAt, created_by: user.id }).select("id,name,status,created_at").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
