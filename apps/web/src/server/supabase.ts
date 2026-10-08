import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { databaseEnvironment } from "./env";

export function createAdminClient(): SupabaseClient {
  const env = databaseEnvironment();
  return createClient(env.url, env.serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createUserClient(request?: Request): Promise<SupabaseClient> {
  const env = databaseEnvironment();
  const bearer = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    return createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component cannot write cookies. Route Handlers can.
        }
      },
    },
  });
}

export async function requireUser(request?: Request) {
  const client = await createUserClient(request);
  const bearer = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data, error } = bearer ? await client.auth.getUser(bearer) : await client.auth.getUser();
  if (error || !data.user) throw new ApiAuthError("authentication_required", 401);
  if (data.user.user_metadata?.must_change_password) throw new ApiAuthError("password_change_required", 403);
  return { client, user: data.user };
}

export async function requireTenantRole(request: Request, tenantId: string, roles: string[]) {
  const auth = await requireUser(request);
  const { data, error } = await auth.client
    .from("memberships")
    .select("role,status")
    .eq("tenant_id", tenantId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data || !roles.includes(data.role)) throw new ApiAuthError("tenant_access_denied", 403);
  return auth;
}

export class ApiAuthError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}
