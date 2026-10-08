/** Design-only contracts. No transport, crypto, persistence or SDK implementation. */
export type TenantId = string;
export type ISOInstant = string;
export type JobKind = "inbound" | "outbound" | "schedule" | "workflow" | "ai" | "integration";

export interface TenantContext {
  tenantId: TenantId;
  actorId: string;
  actorType: "user" | "worker" | "platform_support";
  correlationId: string;
  authRevision: number;
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "media"; assetId: string; mediaType: "image" | "document" | "audio" | "video"; caption?: string }
  | { type: "template"; templateId: string; templateVersion: number; language: string; parameters: Record<string, string> };

export interface SendCommand {
  channelId: string;
  contactId: string;
  conversationId?: string;
  idempotencyKey: string;
  content: MessageContent;
  origin: "manual" | "campaign" | "reminder" | "workflow" | "ai";
  expectedOwnershipGeneration?: number;
  expiresAt: ISOInstant;
}

export type ProviderSendResult =
  | { outcome: "accepted"; providerMessageId: string }
  | { outcome: "rejected"; code: string; safeToRetry: boolean; retryAfterMs?: number }
  | { outcome: "unknown"; attemptReference: string; reason: string };

/** Credentials are resolved inside the adapter, never in public DTOs or queue payloads. */
export interface MessageProvider {
  send(ctx: TenantContext, intentId: string, attemptId: string, abortSignal: AbortSignal): Promise<ProviderSendResult>;
  refreshChannelCapabilities(ctx: TenantContext, channelId: string): Promise<void>;
}

export interface JobReference {
  jobId: string;
  tenantId: TenantId;
  kind: JobKind;
  schemaVersion: number;
}

export interface QueueDelivery {
  reference: JobReference;
  receipt: string;
}

/** Queue delivery is at least once; durable logical completion belongs in the DB. */
export interface QueueBroker {
  publish(reference: JobReference): Promise<void>;
  receive(kind: JobKind, maxItems: number, visibilitySeconds: number): Promise<QueueDelivery[]>;
  acknowledge(receipt: string): Promise<void>;
  defer(receipt: string, delaySeconds: number): Promise<void>;
}

export interface AuthorisationDecision {
  allowed: boolean;
  reasonCode?: string;
  grantRevision: number;
}

export interface EntitlementService {
  evaluate(ctx: TenantContext, feature: string, action: string, resourceId?: string): Promise<AuthorisationDecision>;
  reserve(ctx: TenantContext, meter: string, logicalKey: string, quantity: number): Promise<{ reservationId: string }>;
}

export interface ObjectStore {
  createUpload(ctx: TenantContext, assetId: string, mimeType: string, sizeBytes: number): Promise<{ url: string; expiresAt: ISOInstant }>;
  createReadUrl(ctx: TenantContext, assetId: string, ttlSeconds: number): Promise<string>;
  delete(ctx: TenantContext, assetId: string): Promise<void>;
}

export interface AIReplyProposal {
  runId: string;
  conversationId: string;
  ownershipGeneration: number;
  sourceReferences: string[];
  text?: string;
  disposition: "propose_reply" | "request_human" | "no_action";
  estimatedCostMinorUnits: number;
  currency: string;
}

export interface AIProvider {
  propose(ctx: TenantContext, agentVersionId: string, conversationId: string, abortSignal: AbortSignal): Promise<AIReplyProposal>;
}

export interface DomainEvent {
  eventId: string;
  schemaVersion: number;
  tenantId: TenantId;
  type: string;
  aggregateId: string;
  occurredAt: ISOInstant;
  correlationId: string;
  causationId?: string;
  payloadRef: string;
}
