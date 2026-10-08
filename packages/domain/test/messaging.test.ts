import { describe, expect, it, vi } from "vitest";
import {
  assertMessageTransition,
  calculateRetryDelayMs,
  canTransitionMessage,
  normaliseIdempotencyKey,
  validateWorkflowGraph,
} from "../src/index";

describe("message state machine", () => {
  it("allows forward provider status progression", () => {
    expect(canTransitionMessage("accepted", "delivered")).toBe(true);
    expect(canTransitionMessage("delivered", "read")).toBe(true);
  });

  it("rejects a terminal state moving backwards", () => {
    expect(() => assertMessageTransition("read", "sent")).toThrow(/Invalid message transition/);
  });
});

describe("workflow graph validation", () => {
  it("accepts a connected minimal workflow", () => {
    expect(validateWorkflowGraph({ nodes: [{ id: "start", type: "trigger" }, { id: "reply", type: "message" }], edges: [{ source: "start", target: "reply" }] })).toEqual({ valid: true, errors: [] });
  });

  it("rejects duplicate ids and invalid edges", () => {
    const result = validateWorkflowGraph({ nodes: [{ id: "same", type: "trigger" }, { id: "same", type: "message" }], edges: [{ source: "missing", target: "same" }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(["Duplicate node id: same", "Edge source does not exist: missing"]));
  });
});

describe("message safety helpers", () => {
  it("normalises valid idempotency keys", () => {
    expect(normaliseIdempotencyKey("  order-2048-reply  ")).toBe("order-2048-reply");
  });

  it("bounds provider retry delays", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(calculateRetryDelayMs(1)).toBe(1_000);
    expect(calculateRetryDelayMs(20)).toBe(900_000);
    expect(calculateRetryDelayMs(1, 2_000_000)).toBe(900_000);
    vi.restoreAllMocks();
  });
});
