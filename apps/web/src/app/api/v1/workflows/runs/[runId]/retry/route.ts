import { z } from "zod";
import { failure,ok,requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";
export async function POST(request:Request,context:{params:Promise<{runId:string}>}){const id=requestId(request);try{const{runId}=await context.params;z.uuid().parse(runId);const{client}=await requireUser(request);const{data,error}=await client.rpc("retry_workflow_run",{p_run_id:runId});if(error)throw error;return ok({runId,attempt:data,status:"running"},id,202)}catch(error){return failure(error,id)}}
