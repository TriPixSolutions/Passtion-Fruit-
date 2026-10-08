import { describe, expect, it } from "vitest";
import { MetaCloudApiClient } from "./client";

describe("MetaCloudApiClient", () => {
  it("sends the official text message shape and returns the provider id", async () => {
    let requestBody: unknown;
    const client = new MetaCloudApiClient({
      accessToken: "test-token",
      graphVersion: "v24.0",
      phoneNumberId: "123456",
      fetch: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({ messages: [{ id: "wamid.123" }] });
      },
    });
    await expect(client.send("919999999999", { type: "text", text: "Hello" })).resolves.toEqual({
      outcome: "accepted",
      providerMessageId: "wamid.123",
    });
    expect(requestBody).toMatchObject({ messaging_product: "whatsapp", to: "919999999999", type: "text" });
  });

  it("marks transport failures as ambiguous", async () => {
    const client = new MetaCloudApiClient({
      accessToken: "test-token",
      graphVersion: "v24.0",
      phoneNumberId: "123456",
      fetch: async () => { throw new Error("socket closed"); },
    });
    await expect(client.send("919999999999", { type: "text", text: "Hello" })).resolves.toMatchObject({ outcome: "unknown" });
  });

  it("verifies the phone-number asset before storing a token", async () => {
    const client = new MetaCloudApiClient({
      accessToken: "test-token",
      graphVersion: "v24.0",
      phoneNumberId: "123456",
      fetch: async () => Response.json({ id: "123456", display_phone_number: "+91 99999 99999", verified_name: "Serein Labs", quality_rating: "GREEN" }),
    });
    await expect(client.inspectPhoneNumber()).resolves.toMatchObject({ id: "123456", verifiedName: "Serein Labs" });
  });
});
