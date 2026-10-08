"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "otp_expired") {
      setError("That invitation link has expired. Open the newest Passion Fruit invitation email and use its link.");
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      const client = createBrowserSupabaseClient();
      const { data, error: authError } = await client.auth.signInWithPassword({ email: String(values.get("email")), password: String(values.get("password")) });
      if (authError) throw authError;
      router.replace(data.user.user_metadata?.must_change_password ? "/auth/set-password" : "/app");
      router.refresh();
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : "Sign in failed"); setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><Brand/><div className="auth-copy"><span className="eyebrow">Secure workspace</span><h1>Welcome back.</h1><p>Sign in with the account created by your Passion Fruit administrator.</p></div><form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button button-dark full" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form><p className="auth-foot">Account access and enabled modules are managed by your workspace administrator.</p></section></main>;
}
