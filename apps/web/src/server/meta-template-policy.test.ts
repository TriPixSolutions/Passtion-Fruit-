import { describe, expect, it } from "vitest";
import { templateSetupPolicy } from "./meta-template-policy";

describe("templateSetupPolicy", () => {
  it("accepts a plain approved template without runtime values", () => {
    expect(templateSetupPolicy([
      { type: "HEADER", format: "TEXT", text: "Hello" },
      { type: "BODY", text: "Welcome to Passion Fruit" },
    ])).toEqual({ sendableWithoutSetup: true, requirements: [] });
  });

  it("detects variables, media and carousel setup", () => {
    const result = templateSetupPolicy([
      { type: "HEADER", format: "IMAGE" },
      { type: "BODY", text: "Hi {{1}}, order {{2}} is ready" },
      { type: "BUTTONS", buttons: [{ type: "URL", url: "https://example.com/{{1}}" }] },
      { type: "CAROUSEL", cards: [] },
    ]);
    expect(result.sendableWithoutSetup).toBe(false);
    expect(result.requirements).toEqual(expect.arrayContaining(["media_header", "body_parameters", "dynamic_button", "carousel"]));
  });

  it("fails closed for an invalid provider definition", () => {
    expect(templateSetupPolicy(null)).toEqual({ sendableWithoutSetup: false, requirements: ["invalid_definition"] });
  });
});
