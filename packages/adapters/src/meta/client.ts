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
