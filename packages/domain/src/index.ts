export type TenantId = string;
export type MessageOrigin = "manual" | "campaign" | "reminder" | "workflow" | "ai";
export type MessageStatus =
  | "queued"
  | "dispatching"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown"
  | "cancelled";

export type JobKind = "inbound" | "outbound" | "campaign" | "schedule" | "workflow" | "ai" | "integration";

export interface WorkflowNode {
  id: string;
  type: "trigger" | "condition" | "message" | "delay" | "assign" | "agent" | "end";
  config?: Record<string, unknown>;
}

export interface WorkflowEdge { source: string; target: string; branch?: string }
export interface WorkflowGraph { nodes: WorkflowNode[]; edges: WorkflowEdge[] }

export interface WorkflowValidationResult { valid: boolean; errors: string[] }

export function validateWorkflowGraph(graph: WorkflowGraph): WorkflowValidationResult {
  const errors: string[] = [];
  if (graph.nodes.length === 0) errors.push("Workflow must contain at least one node");
  if (graph.nodes.length > 200) errors.push("Workflow cannot contain more than 200 nodes");
  if (graph.edges.length > 400) errors.push("Workflow cannot contain more than 400 edges");
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id.trim()) errors.push("Every node needs an id");
    if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
  }
  const triggers = graph.nodes.filter((node) => node.type === "trigger");
  if (triggers.length !== 1) errors.push("Workflow must contain exactly one trigger");
  for (const edge of graph.edges) {
    if (!ids.has(edge.source)) errors.push(`Edge source does not exist: ${edge.source}`);
    if (!ids.has(edge.target)) errors.push(`Edge target does not exist: ${edge.target}`);
    if (edge.source === edge.target) errors.push(`Node cannot connect to itself: ${edge.source}`);
  }
  if (triggers[0] && graph.edges.some((edge) => edge.target === triggers[0].id)) errors.push("Trigger cannot have an incoming edge");
  return { valid: errors.length === 0, errors };
}

export interface TenantContext {
  tenantId: TenantId;
  actorId: string;
  actorType: "user" | "worker" | "platform_support";
  correlationId: string;
}

export type MessageContent =
  | { type: "text"; text: string }
  | {
      type: "template";
      name: string;
      language: string;
      components?: Array<Record<string, unknown>>;
    };

export interface OutboundMessageCommand {
  tenantId: TenantId;
  channelId: string;
  contactId: string;
  conversationId?: string;
  idempotencyKey: string;
  origin: MessageOrigin;
  content: MessageContent;
  expectedOwnershipGeneration?: number;
  expiresAt: string;
}

const terminalStatuses = new Set<MessageStatus>(["read", "failed", "unknown", "cancelled"]);

const transitions: Record<MessageStatus, ReadonlySet<MessageStatus>> = {
  queued: new Set(["dispatching", "cancelled", "failed"]),
  dispatching: new Set(["accepted", "failed", "unknown"]),
  accepted: new Set(["sent", "delivered", "read", "failed"]),
  sent: new Set(["delivered", "read", "failed"]),
  delivered: new Set(["read"]),
  read: new Set(),
  failed: new Set(),
  unknown: new Set(),
  cancelled: new Set(),
};

export function canTransitionMessage(from: MessageStatus, to: MessageStatus): boolean {
  return from === to || transitions[from].has(to);
}

export function assertMessageTransition(from: MessageStatus, to: MessageStatus): void {
  if (!canTransitionMessage(from, to)) {
    throw new Error(`Invalid message transition: ${from} -> ${to}`);
  }
}

export function isTerminalMessageStatus(status: MessageStatus): boolean {
  return terminalStatuses.has(status);
}

export function normaliseIdempotencyKey(value: string): string {
  const key = value.trim();
  if (key.length < 8 || key.length > 128) {
    throw new Error("Idempotency key must be between 8 and 128 characters");
  }
  return key;
}

export function calculateRetryDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, 15 * 60_000);
  const exponential = Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 15 * 60_000);
  return exponential + Math.floor(Math.random() * Math.min(1_000, exponential / 4));
}
