# Passion Fruit TypeScript SDK

The SDK wraps the authenticated `/api/v1` surface and preserves the API error code, HTTP status and request ID.

```ts
import { PassionFruitClient } from "@passion-fruit/sdk";

const client = new PassionFruitClient({
  baseUrl: "https://app.example.com",
  accessToken: async () => supabaseSession.access_token,
});

await client.sendMessage({
  tenantId,
  channelId,
  contactId,
  idempotencyKey: crypto.randomUUID(),
  origin: "manual",
  content: { type: "text", text: "Your order is ready." },
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
});
```

Use a fresh Supabase user access token. Never place the Supabase server key, a Meta access token or the internal worker secret in an SDK client.
