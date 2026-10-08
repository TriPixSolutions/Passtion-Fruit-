import { NextResponse } from "next/server";
import { createUserClient } from "@/server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedDestination = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : null;
  if (!code) return NextResponse.redirect(new URL("/demo?auth=invalid", url.origin));

  try {
    const client = await createUserClient(request);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data: current, error: userError } = await client.auth.getUser();
    if (userError || !current.user) throw userError ?? new Error("Authentication session missing");
    const { error: activationError } = await client.rpc("activate_my_memberships");
    if (activationError) throw activationError;
    const destination = current.user.user_metadata?.must_change_password
      ? "/auth/set-password"
      : requestedDestination ?? "/app";
    return NextResponse.redirect(new URL(destination, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/demo?auth=failed", url.origin));
  }
}
