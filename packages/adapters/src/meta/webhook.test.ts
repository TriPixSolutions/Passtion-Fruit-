import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractPhoneNumberId, fingerprintWebhook, verifyMetaSignature } from "./webhook";

describe("Meta webhook verification", () => {
  it("verifies only a valid raw body signature", () => {
    const raw = new TextEncoder().encode('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac("sha256", "secret").update(raw).digest("hex")}`;
    expect(verifyMetaSignature(raw, signature, "secret")).toBe(true);
    expect(verifyMetaSignature(new TextEncoder().encode("changed"), signature, "secret")).toBe(false);
    expect(fingerprintWebhook(raw)).toHaveLength(64);
  });

  it("extracts the provider-owned phone number id", () => {
    expect(extractPhoneNumberId({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "123" } } }] }] })).toBe("123");
  });
});
