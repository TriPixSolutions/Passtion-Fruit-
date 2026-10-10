import type { MessageContent } from "@passion-fruit/domain";

export type MetaSendResult =
  | { outcome: "accepted"; providerMessageId: string }
  | { outcome: "rejected"; code: string; message: string; retryable: boolean; retryAfterMs?: number }
  | { outcome: "unknown"; reason: string };

export interface MetaClientOptions {
  accessToken: string;
  graphVersion: string;
  phoneNumberId: string;
  fetch?: typeof fetch;
}

export type MetaMessageTemplate = { id:string;name:string;language:string;category:string;status:string;components:Array<Record<string,unknown>>;qualityScore?:Record<string,unknown> };
export type MetaMediaDownload = { bytes: Uint8Array; mimeType: string; sha256?: string; fileSize: number };

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

export class MetaCloudApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MetaClientOptions) {
    if (!/^v\d+\.\d+$/.test(options.graphVersion)) throw new Error("PF_META_GRAPH_VERSION must look like vXX.X");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async inspectPhoneNumber(): Promise<{ id: string; displayPhoneNumber?: string; verifiedName?: string; qualityRating?: string }> {
    const fields = new URLSearchParams({ fields: "id,display_phone_number,verified_name,quality_rating" });
    const response = await this.fetchImpl(
      `https://graph.facebook.com/${this.options.graphVersion}/${encodeURIComponent(this.options.phoneNumberId)}?${fields}`,
      { headers: { Authorization: `Bearer ${this.options.accessToken}` } },
    );
    const payload = await response.json().catch(() => ({})) as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.id) throw new Error(payload.error?.message ?? "Meta phone number verification failed");
    return { id: payload.id, displayPhoneNumber: payload.display_phone_number, verifiedName: payload.verified_name, qualityRating: payload.quality_rating };
  }

  async listMessageTemplates(whatsappBusinessAccountId:string):Promise<MetaMessageTemplate[]>{
    const fields="id,name,language,category,status,components,quality_score";let url=`https://graph.facebook.com/${this.options.graphVersion}/${encodeURIComponent(whatsappBusinessAccountId)}/message_templates?${new URLSearchParams({fields,limit:"100"})}`;const templates:MetaMessageTemplate[]=[];
    for(let page=0;url&&page<20;page+=1){const parsed=new URL(url);if(parsed.protocol!=="https:"||parsed.hostname!=="graph.facebook.com")throw new Error("Meta returned an invalid template pagination URL");const response=await this.fetchImpl(url,{headers:{Authorization:`Bearer ${this.options.accessToken}`}});const payload=await response.json().catch(()=>({})) as {data?:Array<{id?:string;name?:string;language?:string;category?:string;status?:string;components?:Array<Record<string,unknown>>;quality_score?:Record<string,unknown>}>;paging?:{next?:string};error?:{message?:string}};if(!response.ok||!Array.isArray(payload.data))throw new Error(payload.error?.message??"Meta template synchronization failed");for(const item of payload.data){if(item.id&&item.name&&item.language&&item.category&&item.status)templates.push({id:item.id,name:item.name,language:item.language,category:item.category,status:item.status,components:item.components??[],qualityScore:item.quality_score})}url=payload.paging?.next??""}
    if(url)throw new Error("Meta template pagination exceeded the safety limit");
    return templates;
  }

  async downloadMedia(mediaId: string): Promise<MetaMediaDownload> {
    const metadataResponse = await this.fetchImpl(
      `https://graph.facebook.com/${this.options.graphVersion}/${encodeURIComponent(mediaId)}`,
      { headers: { Authorization: `Bearer ${this.options.accessToken}` } },
    );
    const metadata = await metadataResponse.json().catch(() => ({})) as { url?: string; mime_type?: string; file_size?: number; sha256?: string; error?: { message?: string } };
    if (!metadataResponse.ok || !metadata.url || !metadata.mime_type) throw new Error(metadata.error?.message ?? "Meta media metadata could not be loaded");
    if (metadata.file_size && metadata.file_size > MAX_MEDIA_BYTES) throw new Error("Meta media exceeds the 20 MB pilot limit");
    const mediaUrl = new URL(metadata.url);
    const trustedHost = ["facebook.com", "fbcdn.net", "fbsbx.com"].some((suffix) => mediaUrl.hostname === suffix || mediaUrl.hostname.endsWith(`.${suffix}`));
    if (mediaUrl.protocol !== "https:" || !trustedHost) throw new Error("Meta returned an invalid media download URL");
    const mediaResponse = await this.fetchImpl(mediaUrl, { headers: { Authorization: `Bearer ${this.options.accessToken}` } });
    if (!mediaResponse.ok) throw new Error("Meta media download failed");
    const declaredLength = Number(mediaResponse.headers.get("content-length") ?? metadata.file_size ?? 0);
    if (declaredLength > MAX_MEDIA_BYTES) throw new Error("Meta media exceeds the 20 MB pilot limit");
    const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
    if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error("Meta media exceeds the 20 MB pilot limit");
    return { bytes, mimeType: metadata.mime_type, sha256: metadata.sha256, fileSize: bytes.byteLength };
  }

  async send(to: string, content: MessageContent, signal?: AbortSignal): Promise<MetaSendResult> {
    const body = content.type === "text"
      ? { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: content.text } }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: { name: content.name, language: { code: content.language }, components: content.components ?? [] },
        };

    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://graph.facebook.com/${this.options.graphVersion}/${encodeURIComponent(this.options.phoneNumberId)}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.options.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        },
      );
    } catch (error) {
      return { outcome: "unknown", reason: error instanceof Error ? error.message : "network_failure" };
    }

    const payload = await response.json().catch(() => ({})) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; message?: string; error_subcode?: number; is_transient?: boolean };
    };

    if (response.ok && payload.messages?.[0]?.id) {
      return { outcome: "accepted", providerMessageId: payload.messages[0].id };
    }

    const retryAfter = response.headers.get("retry-after");
    return {
      outcome: "rejected",
      code: String(payload.error?.error_subcode ?? payload.error?.code ?? response.status),
      message: payload.error?.message ?? "Meta rejected the message",
      retryable: Boolean(payload.error?.is_transient) || response.status === 429 || response.status >= 500,
      retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined,
    };
  }
}
