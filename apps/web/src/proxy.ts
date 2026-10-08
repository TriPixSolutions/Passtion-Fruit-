import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.PF_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await client.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const protectedPage = pathname === "/admin" || pathname === "/app" || pathname.startsWith("/app/");
  if (protectedPage && !data?.claims) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  const metadata = data?.claims?.user_metadata as { must_change_password?: boolean } | undefined;
  if (protectedPage && metadata?.must_change_password) return NextResponse.redirect(new URL("/auth/set-password", request.url));
  if (pathname === "/admin" && data?.claims) {
    const { data: admin } = await client.from("platform_admins").select("user_id").eq("user_id", data.claims.sub).maybeSingle();
    if (!admin) return NextResponse.redirect(new URL("/app", request.url));
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/auth/:path*", "/login", "/api/v1/:path*"],
};
