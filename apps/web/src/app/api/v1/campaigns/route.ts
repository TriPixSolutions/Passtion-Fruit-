import { campaignDraftSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { ApiAuthError, requireTenantRole, requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const { tenantId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("campaigns").select("id,name,status,channel_id,template,audience_filter,scheduled_at,audience_snapshot_at,eligible_count,excluded_count,created_at,updated_at,campaign_recipients(status)").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = await Promise.all((data ?? []).map(async (campaign) => {
      const statuses = (campaign.campaign_recipients ?? []) as Array<{status:string}>;
      const delivery = statuses.reduce<Record<string,number>>((result,row)=>{result[row.status]=(result[row.status]??0)+1;return result},{});
      if (!["draft","scheduled","paused"].includes(campaign.status)) return { ...campaign, campaign_recipients: undefined, delivery, audience_preview: { eligible: campaign.eligible_count, excluded: campaign.excluded_count } };
      const { data: preview, error: previewError } = await client.rpc("preview_campaign_audience", { p_campaign_id: campaign.id });
      if (previewError) throw previewError;
      const first = preview?.[0] ?? { eligible: 0, opted_out: 0, suppressed: 0, filter_mismatch: 0 };
      return { ...campaign, campaign_recipients: undefined, delivery, audience_preview: { ...first, excluded: first.opted_out + first.suppressed + first.filter_mismatch } };
    }));
    return ok(rows, id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = campaignDraftSchema.parse(await readJson(request));
    if (input.scheduledAt && new Date(input.scheduledAt).getTime() <= Date.now()) throw new Error("scheduledAt must be in the future");
    const { client, user } = await requireTenantRole(request, input.tenantId, ["owner","manager"]);
    if (input.audienceFilter.tagIds.length) {
      const { data: tags, error: tagError } = await client.from("tags").select("id").eq("tenant_id", input.tenantId).in("id", input.audienceFilter.tagIds);
      if (tagError) throw tagError;
      if ((tags ?? []).length !== input.audienceFilter.tagIds.length) throw new ApiAuthError("invalid_audience_tag", 400);
    }
    const { data, error } = await client.from("campaigns").insert({ tenant_id: input.tenantId, name: input.name, status: input.scheduledAt ? "scheduled" : "draft", channel_id: input.channelId, template: input.template, audience_filter: input.audienceFilter, scheduled_at: input.scheduledAt, created_by: user.id }).select("id,name,status,created_at").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
