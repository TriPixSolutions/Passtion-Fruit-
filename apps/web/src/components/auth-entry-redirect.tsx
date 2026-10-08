"use client";

import { useEffect } from "react";

export function AuthEntryRedirect() {
  useEffect(() => {
    const { hash, search } = window.location;
    const query = new URLSearchParams(search);
    const fragment = new URLSearchParams(hash.replace(/^#/, ""));

    if (fragment.get("error_code") === "otp_expired") {
      window.location.replace("/login?error=otp_expired");
      return;
    }

    if (query.has("code")) {
      window.location.replace(`/auth/callback${search}`);
      return;
    }

    if (fragment.get("type") === "invite" || fragment.has("access_token")) {
      window.location.replace(`/auth/set-password${hash}`);
    }
  }, []);

  return null;
}
