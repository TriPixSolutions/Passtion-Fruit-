"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    async function establishRecoverySession() {
      const client = createBrowserSupabaseClient();
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = query.get("code");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      try {
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
        }
        const { data } = await client.auth.getSession();
        if (!data.session) throw new Error("This password link is invalid or has expired. Request a new link and try again.");
        window.history.replaceState({}, "", "/auth/set-password");
        setReady(true);
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Password session could not be opened");
      }
    }
    void establishRecoverySession();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password"));
    if (password !== String(values.get("confirmation"))) { setError("Passwords do not match"); setBusy(false); return; }
    try {
      const client = createBrowserSupabaseClient();
      const { data: current } = await client.auth.getUser();
      if (!current.user) throw new Error("Your sign-in session has expired");
      const { error: updateError } = await client.auth.updateUser({ password, data: { ...current.user.user_metadata, must_change_password: false } });
      if (updateError) throw updateError;
      const { error: activationError } = await client.rpc("activate_my_memberships");
      if (activationError) throw activationError;
      router.replace("/app"); router.refresh();
    } catch (passwordError) { setError(passwordError instanceof Error ? passwordError.message : "Password update failed"); setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><Brand/><div className="auth-copy"><span className="eyebrow">First sign-in</span><h1>Create your password.</h1><p>Choose a secure password to activate your Passion Fruit workspace.</p></div><form onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required/></label><label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button button-dark full" disabled={busy || !ready}>{busy?"Saving…":ready?"Save password":"Preparing secure session…"}</button></form></section></main>;
}
