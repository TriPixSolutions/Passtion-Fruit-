import { z } from "zod";
import { failure, requestId } from "@/server/http";
import { ApiAuthError, createAdminClient, requireUser } from "@/server/supabase";

export async function GET(request:Request,context:{params:Promise<{messageId:string}>}){
  const id=requestId(request);
  try{
    const{messageId}=await context.params;z.uuid().parse(messageId);
    const{client}=await requireUser(request);
    const{data:message,error}=await client.from("messages").select("id,content").eq("id",messageId).maybeSingle();
    if(error)throw error;if(!message)throw new ApiAuthError("media_not_found",404);
    const content=message.content as{mediaPath?:unknown};
    if(typeof content.mediaPath!=="string"||!content.mediaPath)throw new ApiAuthError("media_not_found",404);
    const{data,error:signError}=await createAdminClient().storage.from("message-media").createSignedUrl(content.mediaPath,60);
    if(signError||!data?.signedUrl)throw signError??new Error("media_link_failed");
    return Response.redirect(data.signedUrl,302);
  }catch(error){return failure(error,id)}
}
