import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireTenantRole, requireUser } from "@/server/supabase";

const querySchema=z.object({tenantId:z.uuid()});
const createSchema=z.object({tenantId:z.uuid(),shortcut:z.string().trim().regex(/^\/[a-z0-9_-]{2,30}$/),title:z.string().trim().min(2).max(80),body:z.string().trim().min(1).max(4000)});
export async function GET(request:Request){const id=requestId(request);try{const input=querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));const{client}=await requireUser(request);const{data,error}=await client.from("saved_replies").select("id,shortcut,title,body,active,updated_at").eq("tenant_id",input.tenantId).eq("active",true).order("shortcut");if(error)throw error;return ok(data??[],id)}catch(error){return failure(error,id)}}
export async function POST(request:Request){const id=requestId(request);try{const input=createSchema.parse(await readJson(request));const{client,user}=await requireTenantRole(request,input.tenantId,["owner","manager"]);const{data,error}=await client.from("saved_replies").upsert({tenant_id:input.tenantId,shortcut:input.shortcut,title:input.title,body:input.body,active:true,created_by:user.id,updated_at:new Date().toISOString()},{onConflict:"tenant_id,shortcut"}).select("id,shortcut,title,body,active,updated_at").single();if(error)throw error;return ok(data,id,201)}catch(error){return failure(error,id)}}
