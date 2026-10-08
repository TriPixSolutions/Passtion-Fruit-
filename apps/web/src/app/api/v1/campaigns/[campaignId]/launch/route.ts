import { z } from "zod";
import { failure, ok, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const id = requestId(request);
  try {
    const { campaignId } = await context.params;
    z.uuid().parse(campaignId);
    const { client } = await requireUser(request);
    const configuredLimit = Number(process.env.PF_PILOT_MAX_CAMPAIGN_RECIPIENTS ?? 100);
    const maxRecipients = Math.max(1, Math.min(configuredLimit, 1000));
    const { data: recipientCount, error } = await client.rpc("launch_campaign", { p_campaign_id: campaignId, p_max_recipients: maxRecipients });
    if (error) throw error;
    return ok({ campaignId, state: "running", recipientCount }, id, 202);
  } catch (error) { return failure(error, id); }
}
