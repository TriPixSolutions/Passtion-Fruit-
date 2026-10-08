import type {
  AgentInput,
  ApiErrorBody,
  ApiSuccessBody,
  CampaignDraftInput,
  ContactInput,
  CreateTenantInput,
  ScheduleMessageInput,
  SendMessageInput,
  WorkflowDraftInput,
} from "@passion-fruit/contracts";

export class PassionFruitApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly requestId?: string) {
    super(message);
  }
}

export interface PassionFruitClientOptions {
  baseUrl: string;
  accessToken?: () => string | Promise<string>;
  fetch?: typeof fetch;
}

export class PassionFruitClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PassionFruitClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async createTenant(input: CreateTenantInput) {
    return this.request<{ tenantId: string; invitedUserId: string }>("/api/v1/admin/tenants", { method: "POST", body: JSON.stringify(input) });
  }

  async sendMessage(input: SendMessageInput) {
    return this.request<{ messageId: string; state: string }>("/api/v1/messages", { method: "POST", body: JSON.stringify(input) });
  }

  async listInbox(tenantId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/inbox?tenantId=${encodeURIComponent(tenantId)}`);
  }

  async createContact(input: ContactInput) {
    return this.request<{ id: string }>("/api/v1/contacts", { method: "POST", body: JSON.stringify(input) });
  }

  async scheduleMessage(input: ScheduleMessageInput) {
    return this.request<{ id: string; status: string; due_at: string }>("/api/v1/schedules", { method: "POST", body: JSON.stringify(input) });
  }

  async createAgent(input: AgentInput) {
    return this.request<{ id: string; name: string; mode: string; version: number }>("/api/v1/agents", { method: "POST", body: JSON.stringify(input) });
  }

  async createWorkflow(input: WorkflowDraftInput) {
    return this.request<{ id: string; name: string; status: string; version: number }>("/api/v1/workflows", { method: "POST", body: JSON.stringify(input) });
  }

  async createCampaignDraft(input: CampaignDraftInput) {
    return this.request<{ id: string; name: string; status: string }>("/api/v1/campaigns", { method: "POST", body: JSON.stringify(input) });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.accessToken?.();
    const response = await this.fetchImpl(new URL(path, this.options.baseUrl), {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
    const body = await response.json() as ApiSuccessBody<T> | ApiErrorBody;
    if (!response.ok || "error" in body) {
      const error = "error" in body ? body.error : { code: "http_error", message: response.statusText, requestId: undefined };
      throw new PassionFruitApiError(response.status, error.code, error.message, error.requestId);
    }
    return body.data;
  }
}
