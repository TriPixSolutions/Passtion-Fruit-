import { contactSchema } from "@passion-fruit/contracts";
import { z } from "zod";
import { failure, ok, readJson, requestId } from "@/server/http";
import { requireUser } from "@/server/supabase";

const querySchema = z.object({ tenantId: z.uuid(), search: z.string().trim().max(100).optional() });

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { client } = await requireUser(request);
    let query = client.from("contacts").select("id,wa_id,phone_e164,display_name,consent_status,attributes,updated_at").eq("tenant_id", input.tenantId).order("updated_at", { ascending: false }).limit(100);
    if (input.search) {
      const search = input.search.replace(/[^\p{L}\p{N}+ _-]/gu, "");
      if (search) query = query.or(`display_name.ilike.%${search}%,wa_id.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return ok(data ?? [], id);
  } catch (error) { return failure(error, id); }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = contactSchema.parse(await readJson(request));
    const { client } = await requireUser(request);
    const { data, error } = await client.from("contacts").upsert({ tenant_id: input.tenantId, wa_id: input.waId, phone_e164: `+${input.waId}`, display_name: input.displayName, consent_status: input.consentStatus, attributes: input.attributes }, { onConflict: "tenant_id,wa_id" }).select("id,wa_id,display_name,consent_status").single();
    if (error) throw error;
    return ok(data, id, 201);
  } catch (error) { return failure(error, id); }
}
