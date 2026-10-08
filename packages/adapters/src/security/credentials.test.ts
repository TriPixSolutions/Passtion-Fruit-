import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "./credentials";

describe("credential encryption", () => {
  it("round trips an access token without storing plaintext", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptCredential("meta-access-token", key);
    expect(encrypted.ciphertext).not.toContain("meta-access-token");
    expect(decryptCredential(encrypted, key)).toBe("meta-access-token");
  });

  it("rejects a key that is not exactly 32 bytes", () => {
    expect(() => encryptCredential("token", Buffer.alloc(16).toString("base64"))).toThrow(/32-byte key/);
  });
});
