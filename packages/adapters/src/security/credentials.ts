import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyFromBase64(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("PF_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptCredential(plaintext: string, base64Key: string): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromBase64(base64Key), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptCredential(value: EncryptedCredential, base64Key: string): string {
  const decipher = createDecipheriv("aes-256-gcm", keyFromBase64(base64Key), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
