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

export type WorkflowAction =
  | { type: "message"; nodeId: string; content: MessageContent; delaySeconds: number }
  | { type: "assign"; nodeId: string; userId?: string };

function nextWorkflowEdge(graph: WorkflowGraph, source: string, branch?: string): WorkflowEdge | undefined {
  const outgoing = graph.edges.filter((edge) => edge.source === source);
  if (branch) return outgoing.find((edge) => edge.branch === branch) ?? outgoing.find((edge) => !edge.branch);
  return outgoing.find((edge) => !edge.branch) ?? outgoing[0];
}

function workflowConditionMatches(config: Record<string, unknown> | undefined, triggerText: string): boolean {
  const operator = config?.operator;
  const expected = typeof config?.value === "string" ? config.value : "";
  const actual = triggerText.trim().toLowerCase();
  const target = expected.trim().toLowerCase();
  if (operator === "equals") return actual === target;
  if (operator === "starts_with") return actual.startsWith(target);
  if (operator === "ends_with") return actual.endsWith(target);
  return actual.includes(target);
}

export function planWorkflowExecution(graph: WorkflowGraph, triggerText = ""): WorkflowAction[] {
  const validation = validateWorkflowGraph(graph);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  let node = graph.nodes.find((candidate) => candidate.type === "trigger");
  let delaySeconds = 0;
  const actions: WorkflowAction[] = [];
  const visited = new Set<string>();

  for (let step = 0; node && step < graph.nodes.length + 1; step += 1) {
    if (visited.has(node.id)) throw new Error(`Workflow cycle detected at node: ${node.id}`);
    visited.add(node.id);
    let branch: string | undefined;

    if (node.type === "condition") branch = workflowConditionMatches(node.config, triggerText) ? "true" : "false";
    if (node.type === "delay") {
      const seconds = Number(node.config?.seconds ?? 0);
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 30 * 24 * 60 * 60) throw new Error(`Invalid delay at node: ${node.id}`);
      delaySeconds += Math.floor(seconds);
    }
    if (node.type === "message") {
      const content = node.config?.content as MessageContent | undefined;
      if (!content || (content.type !== "text" && content.type !== "template")) throw new Error(`Invalid message at node: ${node.id}`);
      actions.push({ type: "message", nodeId: node.id, content, delaySeconds });
    }
    if (node.type === "assign") {
      const userId = typeof node.config?.userId === "string" ? node.config.userId : undefined;
      actions.push({ type: "assign", nodeId: node.id, ...(userId ? { userId } : {}) });
    }
    if (node.type === "agent") throw new Error(`AI agent execution is not configured for node: ${node.id}`);
    if (node.type === "end") break;

    const edge = nextWorkflowEdge(graph, node.id, branch);
    node = edge ? byId.get(edge.target) : undefined;
  }
  return actions;
}

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
