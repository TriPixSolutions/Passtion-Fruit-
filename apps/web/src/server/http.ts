import { ZodError } from "zod";
import { ApiAuthError } from "./supabase";

export function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
}

export async function readJson(request: Request, maxBytes = 256_000): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new PayloadTooLargeError();
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw new PayloadTooLargeError();
  try { return JSON.parse(body); } catch { throw new InvalidJsonError(); }
}

class PayloadTooLargeError extends Error {}
class InvalidJsonError extends Error {}

export function ok<T>(data: T, id: string, status = 200): Response {
  return Response.json({ data, requestId: id }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": id } });
}

export function failure(error: unknown, id: string): Response {
  if (error instanceof PayloadTooLargeError) {
    return Response.json({ error: { code: "payload_too_large", message: "Request body is too large", requestId: id } }, { status: 413 });
  }
  if (error instanceof InvalidJsonError) {
    return Response.json({ error: { code: "invalid_json", message: "Request body must be valid JSON", requestId: id } }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: { code: "invalid_request", message: "Request validation failed", requestId: id, details: error.issues } }, { status: 400 });
  }
  if (error instanceof ApiAuthError) {
    return Response.json({ error: { code: error.code, message: error.message, requestId: id } }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const configurationError = message.startsWith("Missing required server environment variable:");
  console.error(JSON.stringify({ event: "api_request_failed", requestId: id, category: configurationError ? "configuration" : "internal" }));
  return Response.json(
    { error: { code: configurationError ? "service_not_configured" : "internal_error", message: configurationError ? message : "The request could not be completed", requestId: id } },
    { status: configurationError ? 503 : 500 },
  );
}
