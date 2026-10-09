import { commerceSandboxImportSchema } from "@passion-fruit/contracts";
import { failure,ok,readJson,requestId } from "@/server/http";
import { requireTenantRole } from "@/server/supabase";

export async function POST(request:Request){const id=requestId(request);try{const input=commerceSandboxImportSchema.parse(await readJson(request));const{client}=await requireTenantRole(request,input.tenantId,["owner","manager"]);const{data,error}=await client.rpc("import_sandbox_commerce_fixture",{p_connection_id:input.connectionId,p_product:input.product,p_order:input.order});if(error)throw error;return ok(data,id,201)}catch(error){return failure(error,id)}}
