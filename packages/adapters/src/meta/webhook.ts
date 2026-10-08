import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(rawBody: Uint8Array, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;
  const suppliedHex = signatureHeader.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function fingerprintWebhook(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function extractPhoneNumberId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const entry = (payload as { entry?: unknown[] }).entry?.[0];
  if (!entry || typeof entry !== "object") return null;
  const change = (entry as { changes?: unknown[] }).changes?.[0];
  if (!change || typeof change !== "object") return null;
  const value = (change as { value?: { metadata?: { phone_number_id?: unknown } } }).value;
  return typeof value?.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : null;
}
