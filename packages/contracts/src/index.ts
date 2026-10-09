import { z } from "zod";

export const featureKeys = [
  "shared_inbox",
  "manual_messages",
  "contacts",
  "campaigns",
  "schedules",
  "workflows",
  "ai_assist",
  "ai_auto_reply",
  "analytics",
  "commerce",
  "crm",
] as const;

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(50),
  ownerEmail: z.email().toLowerCase(),
  accessMethod: z.enum(["invite", "temporary_password"]).default("invite"),
  temporaryPassword: z.string().min(12).max(128).optional(),
  features: z.array(z.enum(featureKeys)).max(featureKeys.length).default(["shared_inbox", "manual_messages", "contacts"]),
}).refine((value) => value.accessMethod !== "temporary_password" || Boolean(value.temporaryPassword), {
  message: "A temporary password is required for temporary_password access",
  path: ["temporaryPassword"],
});

export const messageContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(4096) }),
  z.object({
    type: z.literal("template"),
    name: z.string().trim().min(1).max(512),
    language: z.string().trim().min(2).max(20),
    components: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
]);

export const sendMessageSchema = z.object({
  tenantId: z.uuid(),
  channelId: z.uuid(),
  contactId: z.uuid(),
  conversationId: z.uuid().optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
  origin: z.enum(["manual", "campaign", "reminder", "workflow", "ai"]),
  content: messageContentSchema,
  expectedOwnershipGeneration: z.number().int().nonnegative().optional(),
  expiresAt: z.iso.datetime(),
});

export const connectMetaChannelSchema = z.object({
  tenantId: z.uuid(),
  displayName: z.string().trim().min(2).max(80),
  phoneNumberId: z.string().trim().min(5).max(64),
  whatsappBusinessAccountId: z.string().trim().min(5).max(64),
  accessToken: z.string().trim().min(20),
});

export const contactSchema = z.object({
  tenantId: z.uuid(),
  waId: z.string().regex(/^\d{6,20}$/),
  displayName: z.string().trim().min(1).max(120).optional(),
  consentStatus: z.enum(["unknown", "opted_in", "opted_out"]).default("unknown"),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export const scheduleMessageSchema = z.object({
  tenantId: z.uuid(),
  channelId: z.uuid(),
  contactId: z.uuid(),
  conversationId: z.uuid().optional(),
  content: messageContentSchema,
  dueAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  idempotencyKey: z.string().trim().min(8).max(128),
}).refine((value) => new Date(value.expiresAt) > new Date(value.dueAt), { message: "expiresAt must be later than dueAt", path: ["expiresAt"] });

export const agentSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  purpose: z.string().trim().min(2).max(240),
  mode: z.enum(["disabled", "suggest", "auto_reply"]).default("suggest"),
  instructions: z.string().trim().max(12_000).default(""),
  allowedTools: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  dailyBudgetMinor: z.number().int().nonnegative().max(1_000_000).default(0),
  tone: z.enum(["professional","helpful","friendly","concise"]).default("helpful"),
  supportedLanguages: z.array(z.string().trim().min(2).max(12)).min(1).max(20).default(["en"]),
  confidenceThreshold: z.number().min(0).max(1).default(0.65),
  guardrails: z.object({ handoffOnMissingSource: z.boolean().default(true), handoffOnSensitiveIntent: z.boolean().default(true), prohibitedTopics: z.array(z.string().trim().min(1).max(120)).max(50).default([]) }).default({ handoffOnMissingSource:true, handoffOnSensitiveIntent:true, prohibitedTopics:[] }),
});

export const workflowDraftSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  graph: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())).max(200),
    edges: z.array(z.record(z.string(), z.unknown())).max(400),
  }),
});

export const campaignDraftSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  channelId: z.uuid(),
  template: z.object({
    type: z.literal("template"),
    name: z.string().trim().min(1).max(512),
    language: z.string().trim().min(2).max(20),
    components: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  audienceFilter: z.object({
    lifecycleStages: z.array(z.enum(["lead","qualified","opportunity","customer","repeat_customer","win_back","inactive"])).max(7).default([]),
    tagIds: z.array(z.uuid()).max(30).default([]),
    minLeadScore: z.number().int().min(0).max(100).default(0),
    source: z.string().trim().max(80).optional(),
  }).strict().default({ lifecycleStages: [], tagIds: [], minLeadScore: 0 }),
  scheduledAt: z.iso.datetime().optional(),
});

export const commerceConnectionSchema = z.object({
  tenantId: z.uuid(),
  category: z.enum(["store","crm"]).default("store"),
  provider: z.enum(["shopify","woocommerce","custom"]),
  name: z.string().trim().min(2).max(100),
  baseUrl: z.url().max(500).optional(),
  sandbox: z.boolean().default(false),
});

export const commerceSandboxImportSchema = z.object({
  tenantId: z.uuid(),
  connectionId: z.uuid(),
  product: z.object({ externalId:z.string().trim().min(1).max(120), title:z.string().trim().min(1).max(240), sku:z.string().trim().max(120).optional(), priceMinor:z.number().int().nonnegative().max(1_000_000_000), currency:z.string().regex(/^[A-Z]{3}$/).default("INR"), inventoryQuantity:z.number().int().min(0).max(100_000).optional() }),
  order: z.object({ externalId:z.string().trim().min(1).max(120), orderNumber:z.string().trim().min(1).max(120), customerName:z.string().trim().max(160).optional(), customerPhone:z.string().trim().max(32).optional(), totalMinor:z.number().int().nonnegative().max(1_000_000_000), currency:z.string().regex(/^[A-Z]{3}$/).default("INR"), financialStatus:z.enum(["pending","authorized","paid","partially_refunded","refunded","voided"]).default("paid"), fulfillmentStatus:z.enum(["unfulfilled","partial","fulfilled","cancelled","returned"]).default("unfulfilled"), placedAt:z.iso.datetime() }),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ConnectMetaChannelInput = z.infer<typeof connectMetaChannelSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;
export type AgentInput = z.infer<typeof agentSchema>;
export type WorkflowDraftInput = z.infer<typeof workflowDraftSchema>;
export type CampaignDraftInput = z.infer<typeof campaignDraftSchema>;
export type CommerceConnectionInput = z.infer<typeof commerceConnectionSchema>;
export type CommerceSandboxImportInput = z.infer<typeof commerceSandboxImportSchema>;

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string; details?: unknown };
}

export interface ApiSuccessBody<T> {
  data: T;
  requestId: string;
}
