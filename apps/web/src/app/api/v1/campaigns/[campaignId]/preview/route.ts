import { z } from "zod";
import { failure, ok, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

export async function GET(request:Request,context:{params:Promise<{campaignId:string}>}){const id=requestId(request);try{const{campaignId}=await context.params;z.uuid().parse(campaignId);const{client}=await requireUser(request);const{data,error}=await client.rpc("preview_campaign_audience",{p_campaign_id:campaignId});if(error)throw error;return ok(data?.[0]??{eligible:0,opted_out:0,suppressed:0,filter_mismatch:0},id)}catch(error){return failure(error,id)}}
