import { z } from "zod";
import { failure, ok, requestId } from "@/server/http";
import { ApiAuthError, requireTenantRole, requireUser } from "@/server/supabase";
import { syncMetaTemplates } from "@/server/meta-templates";
import { templateSetupPolicy } from "@/server/meta-template-policy";

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const id = requestId(request);
  try {
    const { campaignId } = await context.params;
    z.uuid().parse(campaignId);
    const auth = await requireUser(request);
    const {data:campaign,error:campaignError}=await auth.client.from("campaigns").select("tenant_id,channel_id,template").eq("id",campaignId).single();
    if(campaignError||!campaign)throw campaignError??new Error("campaign_not_found");
    const {client}=await requireTenantRole(request,campaign.tenant_id,["owner","manager"]);
    await syncMetaTemplates(campaign.tenant_id,campaign.channel_id);
    const template=campaign.template as {name?:string;language?:string};
    const{data:approved,error:templateError}=await client.from("whatsapp_message_templates").select("id,components").eq("tenant_id",campaign.tenant_id).eq("channel_id",campaign.channel_id).eq("name",template.name??"").eq("language",template.language??"").eq("status","APPROVED").maybeSingle();
    if(templateError)throw templateError;if(!approved)throw new ApiAuthError("approved_template_required",409);
    if(!templateSetupPolicy(approved.components).sendableWithoutSetup)throw new ApiAuthError("template_configuration_required",409);
    const configuredLimit = Number(process.env.PF_PILOT_MAX_CAMPAIGN_RECIPIENTS ?? 100);
    const maxRecipients = Math.max(1, Math.min(configuredLimit, 1000));
    const { data: recipientCount, error } = await client.rpc("launch_campaign", { p_campaign_id: campaignId, p_max_recipients: maxRecipients });
    if (error) throw error;
    return ok({ campaignId, state: "running", recipientCount }, id, 202);
  } catch (error) { return failure(error, id); }
}
