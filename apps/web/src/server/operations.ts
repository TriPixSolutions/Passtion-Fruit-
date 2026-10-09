import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const operationMetrics = ["dead_jobs", "retry_jobs", "failed_webhooks", "stale_outbox", "unknown_messages"] as const;
export type OperationMetric = typeof operationMetrics[number];
export type OperationsSnapshot = {capturedAt:string;worker:{status:string;startedAt:string;finishedAt:string|null;claimed:number;completed:number;failed:number;durationMs:number|null}|null;jobs:{queued:number;processing:number;retry:number;dead:number;completed24h:number;oldestReadySeconds:number|null};webhooks:{pending:number;processed24h:number;failed:number;quarantined:number};outbox:{unpublished:number;stale:number};messages:{unknown:number;failed:number};byKind:Record<string,{queued:number;processing:number;retry:number;dead:number}>};
const count=(rows:Array<Record<string,unknown>>,key:string,value:string)=>rows.filter((row)=>row[key]===value).length;

export async function operationsSnapshot(admin:SupabaseClient,tenantId:string):Promise<OperationsSnapshot>{
  const now=new Date().toISOString(),since24h=new Date(Date.now()-86_400_000).toISOString(),since30d=new Date(Date.now()-30*86_400_000).toISOString(),staleBefore=new Date(Date.now()-5*60_000).toISOString();
  const results=await Promise.all([
    admin.from("jobs").select("kind,status,available_at,created_at,updated_at").eq("tenant_id",tenantId).gte("created_at",since30d).limit(10000),
    admin.from("webhook_receipts").select("state,received_at").eq("tenant_id",tenantId).gte("received_at",since30d).limit(10000),
    admin.from("outbox").select("published_at,created_at").eq("tenant_id",tenantId).is("published_at",null).limit(10000),
    admin.from("messages").select("status,updated_at").eq("tenant_id",tenantId).in("status",["unknown","failed"]).gte("updated_at",since24h).limit(10000),
    admin.from("worker_runs").select("status,started_at,finished_at,claimed,completed,failed,duration_ms").order("started_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  const firstError=results.find((result)=>result.error)?.error;if(firstError)throw firstError;
  const jobs=(results[0].data??[]) as Array<Record<string,unknown>>,webhooks=(results[1].data??[]) as Array<Record<string,unknown>>,outbox=(results[2].data??[]) as Array<Record<string,unknown>>,messages=(results[3].data??[]) as Array<Record<string,unknown>>;
  const ready=jobs.filter((row)=>["queued","retry"].includes(String(row.status))&&String(row.available_at)<=now);const oldest=ready.map((row)=>new Date(String(row.created_at)).getTime()).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  const byKind:OperationsSnapshot["byKind"]={};for(const row of jobs){const kind=String(row.kind);byKind[kind]??={queued:0,processing:0,retry:0,dead:0};const status=String(row.status) as keyof typeof byKind[string];if(status in byKind[kind])byKind[kind][status]+=1}
  const run=results[4].data as {status:string;started_at:string;finished_at:string|null;claimed:number;completed:number;failed:number;duration_ms:number|null}|null;
  return{capturedAt:now,worker:run?{status:run.status,startedAt:run.started_at,finishedAt:run.finished_at,claimed:run.claimed,completed:run.completed,failed:run.failed,durationMs:run.duration_ms}:null,jobs:{queued:count(jobs,"status","queued"),processing:count(jobs,"status","processing"),retry:count(jobs,"status","retry"),dead:count(jobs,"status","dead"),completed24h:jobs.filter((row)=>row.status==="completed"&&String(row.updated_at)>=since24h).length,oldestReadySeconds:oldest?Math.max(0,Math.round((Date.now()-oldest)/1000)):null},webhooks:{pending:count(webhooks,"state","pending"),processed24h:webhooks.filter((row)=>row.state==="processed"&&String(row.received_at)>=since24h).length,failed:count(webhooks,"state","failed"),quarantined:count(webhooks,"state","quarantined")},outbox:{unpublished:outbox.length,stale:outbox.filter((row)=>String(row.created_at)<staleBefore).length},messages:{unknown:count(messages,"status","unknown"),failed:count(messages,"status","failed")},byKind};
}
export async function operationMetricValue(admin:SupabaseClient,tenantId:string,metric:OperationMetric,windowMinutes:number){
  const since=new Date(Date.now()-windowMinutes*60_000).toISOString();let query;
  if(metric==="dead_jobs")query=admin.from("jobs").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("status","dead").gte("updated_at",since);
  else if(metric==="retry_jobs")query=admin.from("jobs").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("status","retry").gte("updated_at",since);
  else if(metric==="failed_webhooks")query=admin.from("webhook_receipts").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).in("state",["failed","quarantined"]).gte("received_at",since);
  else if(metric==="stale_outbox")query=admin.from("outbox").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).is("published_at",null).gte("created_at",since).lt("created_at",new Date(Date.now()-5*60_000).toISOString());
  else query=admin.from("messages").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("status","unknown").gte("updated_at",since);
  const{count,error}=await query;if(error)throw error;return count??0;
}
