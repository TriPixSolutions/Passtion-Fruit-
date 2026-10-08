import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function hmacSha256(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, body)));
}

async function sha256(body: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", body)));
}

function phoneNumberId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const entry = (payload as { entry?: unknown[] }).entry?.[0];
  if (!entry || typeof entry !== "object") return null;
  const change = (entry as { changes?: unknown[] }).changes?.[0];
  if (!change || typeof change !== "object") return null;
  const value = (change as { value?: { metadata?: { phone_number_id?: unknown } } }).value;
  return typeof value?.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : null;
}

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);

  if (request.method === "GET") {
    const mode = requestUrl.searchParams.get("hub.mode");
    const token = requestUrl.searchParams.get("hub.verify_token");
    const challenge = requestUrl.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge && token && constantTimeEqual(token, Deno.env.get("PF_META_WEBHOOK_VERIFY_TOKEN") ?? "")) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("Verification failed", { status: 403 });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 1_000_000) return new Response("Payload too large", { status: 413 });

  const appSecret = Deno.env.get("PF_META_APP_SECRET") ?? "";
  if (!appSecret) return new Response("Webhook is not configured", { status: 503 });
  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength > 1_000_000) return new Response("Payload too large", { status: 413 });

  const supplied = request.headers.get("x-hub-signature-256");
  if (!supplied?.startsWith("sha256=") || !constantTimeEqual(supplied.slice(7), await hmacSha256(appSecret, rawBody))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await supabase.rpc("ingest_meta_webhook", {
    p_phone_number_id: phoneNumberId(payload),
    p_fingerprint: await sha256(rawBody),
    p_payload: payload,
  });
  if (error) {
    console.error(JSON.stringify({ event: "meta_webhook_persist_failed", code: error.code }));
    return new Response("Persistence unavailable", { status: 503 });
  }

  return new Response("EVENT_RECEIVED", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
});
